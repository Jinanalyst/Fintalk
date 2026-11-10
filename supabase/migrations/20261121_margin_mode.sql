-- ============================================================================
-- 마진 모드: 격리(isolated) / 교차(cross)
--   · 격리: 포지션마다 넣은 증거금만 위험에 노출. 청산가는 그 포지션의 평단·레버리지로 계산 (기존 방식).
--   · 교차: 주문 가능 잔고 + 교차 포지션들의 증거금·미실현 손익 전체가 담보.
--       교차 담보 자산 = 잔고 + Σ(증거금 + 미실현 손익),  유지증거금 = Σ(명목가치 × 0.5%)
--       담보 자산 <= 유지증거금 이면 교차 포지션을 전부 강제청산하고 잔고도 0 이 됩니다.
--       포지션별 청산가는 "다른 포지션 가격은 지금 그대로" 라고 가정하고 계산해 paper_positions.liq_price 에 저장합니다.
--   · 같은 종목에서는 마진 모드를 섞을 수 없습니다. (열린 포지션·주문이 있으면 모드 고정)
--   · 합치기 기준: 종목·방향·레버리지·마진 모드가 모두 같을 때만 한 포지션으로 합칩니다.
-- 선행: 20261111 ~ 20261120 (특히 20261116_merge_positions, 20261118_leverage_150, 20261119_all_symbols)
-- 여러 번 실행해도 안전합니다.
-- ============================================================================

alter table public.paper_positions add column if not exists margin_mode text not null default 'isolated';
alter table public.paper_orders    add column if not exists margin_mode text not null default 'isolated';
alter table public.paper_positions drop constraint if exists paper_positions_margin_mode_check;
alter table public.paper_positions add  constraint paper_positions_margin_mode_check check (margin_mode in ('isolated','cross'));
alter table public.paper_orders    drop constraint if exists paper_orders_margin_mode_check;
alter table public.paper_orders    add  constraint paper_orders_margin_mode_check    check (margin_mode in ('isolated','cross'));

-- ───────── 교차 청산가 갱신 ─────────
-- 한 사용자의 교차 포지션 전부의 liq_price 를 현재 시세·잔고 기준으로 다시 계산합니다.
create or replace function public._paper_refresh_cross_liq(p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  with base as (
    select pos.id, pos.side, pos.qty, pos.entry_price, pos.margin,
           (p.price - pos.entry_price) * pos.qty * (case when pos.side = 'long' then 1 else -1 end) as upnl,
           pos.qty * p.price * 0.005 as mm
      from public.paper_positions pos
      join public.paper_prices p on p.symbol = pos.symbol
     where pos.user_id = p_user and pos.margin_mode = 'cross'
  ),
  tot as (
    select coalesce((select balance from public.paper_accounts where user_id = p_user), 0)
           + coalesce(sum(margin), 0) + coalesce(sum(upnl - mm), 0) as w
      from base
  ),
  calc as (
    select b.id, b.side, b.qty, b.entry_price,
           -- 이 포지션을 뺀 나머지 담보: 이 포지션의 (미실현 손익 - 유지증거금) 만 제외 (증거금은 담보에 포함)
           t.w - (b.upnl - b.mm) as rest
      from base b cross join tot t
  )
  update public.paper_positions pos
     set liq_price = greatest(
           case when c.side = 'long'
             then (c.entry_price * c.qty - c.rest) / (c.qty * 0.995)
             else (c.rest + c.entry_price * c.qty) / (c.qty * 1.005) end,
           0.00000001)
    from calc c
   where pos.id = c.id;
end $$;

-- 교차 강제청산: 사용자의 교차 포지션을 현재가로 모두 정산하고 잔고를 0 으로 만듭니다.
create or replace function public._paper_liquidate_cross(p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  r record;
  gross numeric;
begin
  for r in
    select pos.*, p.price as mark
      from public.paper_positions pos
      join public.paper_prices p on p.symbol = pos.symbol
     where pos.user_id = p_user and pos.margin_mode = 'cross'
     for update of pos
  loop
    gross := (r.mark - r.entry_price) * r.qty * (case when r.side = 'long' then 1 else -1 end);
    insert into public.paper_trades(user_id, symbol, side, qty, entry_price, exit_price, leverage, margin, pnl, fee, reason, opened_at)
    values (r.user_id, r.symbol, r.side, r.qty, r.entry_price, r.mark, r.leverage, r.margin, gross - r.open_fee, r.open_fee, 'liquidation', r.opened_at);
    delete from public.paper_positions where id = r.id;
  end loop;
  -- 교차는 잔고 전체가 담보이므로 남은 잔고도 함께 소진됩니다. (격리 포지션 증거금은 별도라 영향 없음)
  update public.paper_accounts set balance = 0 where user_id = p_user;
end $$;

revoke all on function public._paper_refresh_cross_liq(uuid) from public, anon, authenticated;
revoke all on function public._paper_liquidate_cross(uuid) from public, anon, authenticated;

-- ───────── 포지션 열기 (마진 모드 반영) ─────────
drop function if exists public._paper_open(uuid, text, text, numeric, numeric, int, numeric, numeric, numeric, numeric);
create or replace function public._paper_open(p_user uuid, p_symbol text, p_side text, p_qty numeric, p_price numeric,
  p_lev int, p_margin numeric, p_fee numeric, p_tp numeric, p_sl numeric, p_mode text default 'isolated')
returns void language plpgsql security definer set search_path = public as $$
declare
  pos public.paper_positions%rowtype;
  nq numeric; ne numeric;
begin
  select * into pos from public.paper_positions
   where user_id = p_user and symbol = p_symbol and side = p_side and leverage = p_lev and margin_mode = p_mode
   order by opened_at limit 1 for update;

  if found then
    nq := pos.qty + p_qty;
    ne := (pos.entry_price * pos.qty + p_price * p_qty) / nq;
    update public.paper_positions
       set qty = nq,
           entry_price = ne,
           margin = pos.margin + p_margin,
           open_fee = pos.open_fee + p_fee,
           tp = coalesce(p_tp, pos.tp),
           sl = coalesce(p_sl, pos.sl),
           liq_price = public._paper_liq_price(p_side, ne, p_lev)
     where id = pos.id;
  else
    insert into public.paper_positions(user_id, symbol, side, qty, entry_price, leverage, margin, open_fee, tp, sl, liq_price, margin_mode)
    values (p_user, p_symbol, p_side, p_qty, p_price, p_lev, p_margin, p_fee, p_tp, p_sl,
            public._paper_liq_price(p_side, p_price, p_lev), p_mode);
  end if;

  if p_mode = 'cross' then
    perform public._paper_refresh_cross_liq(p_user);
  end if;
end $$;

revoke all on function public._paper_open(uuid, text, text, numeric, numeric, int, numeric, numeric, numeric, numeric, text) from public, anon, authenticated;

-- ───────── 정산: 교차 포지션이 줄거나 사라지면 청산가를 다시 계산 ─────────
create or replace function public._paper_close(p_id uuid, p_exit numeric, p_reason text, p_qty numeric default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  pos public.paper_positions%rowtype;
  q numeric; ratio numeric; m numeric; of numeric;
  gross numeric; close_fee numeric; refund numeric; net numeric;
begin
  select * into pos from public.paper_positions where id = p_id for update;
  if not found then return; end if;

  q := least(coalesce(p_qty, pos.qty), pos.qty);
  if q <= 0 then return; end if;
  ratio := q / pos.qty;
  m := pos.margin * ratio;
  of := pos.open_fee * ratio;

  gross := (p_exit - pos.entry_price) * q * (case when pos.side = 'long' then 1 else -1 end);
  close_fee := q * p_exit * public._paper_fee_rate();

  if p_reason = 'liquidation' then
    refund := 0;
    net := -m - of;
    close_fee := 0;
  else
    refund := greatest(m + gross - close_fee, 0);
    net := gross - close_fee - of;
  end if;

  update public.paper_accounts set balance = balance + refund where user_id = pos.user_id;

  insert into public.paper_trades(user_id, symbol, side, qty, entry_price, exit_price, leverage, margin, pnl, fee, reason, opened_at)
  values (pos.user_id, pos.symbol, pos.side, q, pos.entry_price, p_exit, pos.leverage, m, net, of + close_fee, p_reason, pos.opened_at);

  if ratio >= 0.999999 then
    delete from public.paper_positions where id = p_id;  -- 지정가 청산 주문도 함께 삭제
  else
    update public.paper_positions
       set qty = qty - q, margin = margin - m, open_fee = open_fee - of
     where id = p_id;
  end if;

  if pos.margin_mode = 'cross' then
    perform public._paper_refresh_cross_liq(pos.user_id);
  end if;
end $$;

revoke all on function public._paper_close(uuid, numeric, text, numeric) from public, anon, authenticated;

-- ───────── 주문 (마진 모드 인자 추가) ─────────
drop function if exists public.paper_place_order(text, text, numeric, int, numeric, numeric, numeric);
create or replace function public.paper_place_order(
  p_symbol text, p_side text, p_size_usdt numeric, p_leverage int,
  p_limit numeric default null, p_tp numeric default null, p_sl numeric default null,
  p_margin_mode text default 'isolated')
returns text language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  mark public.paper_prices%rowtype;
  px numeric; qty numeric; margin numeric; fee numeric; bal numeric;
  n int; other int;
begin
  if uid is null then raise exception '로그인이 필요합니다.'; end if;
  if p_side not in ('long','short') then raise exception '방향이 올바르지 않습니다.'; end if;
  if p_margin_mode not in ('isolated','cross') then raise exception '마진 모드가 올바르지 않습니다.'; end if;
  if p_leverage < 1 or p_leverage > 150 then raise exception '레버리지는 1~150배입니다.'; end if;
  if p_size_usdt is null or p_size_usdt < 10 then raise exception '주문 규모는 최소 10 USDT 입니다.'; end if;
  if p_size_usdt > 1000000 then raise exception '주문 규모가 너무 큽니다.'; end if;

  select * into mark from public.paper_prices where symbol = p_symbol;
  if not found or mark.updated_at < now() - interval '2 minutes' then
    raise exception '시세가 갱신되지 않았습니다. 잠시 후 다시 시도해 주세요.';
  end if;

  insert into public.paper_accounts(user_id) values (uid) on conflict do nothing;
  select balance into bal from public.paper_accounts where user_id = uid for update;

  -- 같은 종목에 다른 마진 모드의 포지션·주문이 있으면 모드를 바꿀 수 없음
  select (select count(*) from public.paper_positions where user_id = uid and symbol = p_symbol and margin_mode <> p_margin_mode)
       + (select count(*) from public.paper_orders where user_id = uid and symbol = p_symbol and status = 'open' and margin_mode <> p_margin_mode)
    into other;
  if other > 0 then
    raise exception '이 종목에 % 마진 모드의 포지션/주문이 있어 마진 모드를 바꿀 수 없습니다.',
      case when p_margin_mode = 'cross' then '격리' else '교차' end;
  end if;

  select (select count(*) from public.paper_positions where user_id = uid)
       + (select count(*) from public.paper_orders where user_id = uid and status = 'open') into n;
  if n >= 30 then raise exception '포지션과 미체결 주문은 합쳐서 30개까지 가능합니다.'; end if;

  px := coalesce(p_limit, mark.price);
  if p_limit is not null then
    -- 즉시 체결될 지정가는 거부 (시장가를 이용하도록)
    if (p_side = 'long' and p_limit >= mark.price) or (p_side = 'short' and p_limit <= mark.price) then
      raise exception '지정가가 현재가와 겹칩니다. 시장가로 주문하거나 가격을 조정해 주세요.';
    end if;
  end if;

  perform public._paper_validate_tpsl(p_side, px, p_tp, p_sl);

  qty := p_size_usdt / px;
  margin := p_size_usdt / p_leverage;
  fee := p_size_usdt * public._paper_fee_rate();
  if margin + fee > bal then raise exception '잔고가 부족합니다. (필요 % USDT)', round(margin + fee, 2); end if;

  update public.paper_accounts set balance = balance - margin - fee where user_id = uid;

  if p_limit is null then
    perform public._paper_open(uid, p_symbol, p_side, qty, px, p_leverage, margin, fee, p_tp, p_sl, p_margin_mode);
    return 'filled';
  end if;

  insert into public.paper_orders(user_id, symbol, side, price, qty, leverage, margin, fee, tp, sl, margin_mode)
  values (uid, p_symbol, p_side, px, qty, p_leverage, margin, fee, p_tp, p_sl, p_margin_mode);
  return 'open';
end $$;

revoke all on function public.paper_place_order(text, text, numeric, int, numeric, numeric, numeric, text) from public, anon;
grant execute on function public.paper_place_order(text, text, numeric, int, numeric, numeric, numeric, text) to authenticated;

-- ───────── 가격 갱신 + 체결/청산 매칭 ─────────
create or replace function public.paper_tick(p_secret text, p_prices jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  r record; px numeric;
begin
  if p_secret is null or p_secret is distinct from (select value from public.paper_config where key = 'tick_secret') then
    raise exception 'forbidden';
  end if;

  insert into public.paper_prices(symbol, price, updated_at)
  select key, value::numeric, now()
    from jsonb_each_text(p_prices)
   where key ~ '^[A-Z0-9]{1,20}USDT$' and value ~ '^[0-9]+([.][0-9]+)?([eE][-+]?[0-9]+)?$' and value::numeric > 0
  on conflict (symbol) do update set price = excluded.price, updated_at = excluded.updated_at;

  -- 지정가 체결: 롱은 가격 <= 지정가, 숏은 가격 >= 지정가
  for r in
    select o.* from public.paper_orders o join public.paper_prices p on p.symbol = o.symbol
    where o.status = 'open'
      and ((o.side = 'long' and p.price <= o.price) or (o.side = 'short' and p.price >= o.price))
    for update of o
  loop
    perform public._paper_open(r.user_id, r.symbol, r.side, r.qty, r.price, r.leverage, r.margin, r.fee, r.tp, r.sl, r.margin_mode);
    update public.paper_orders set status = 'filled' where id = r.id;
  end loop;

  -- 격리 포지션: 강제청산 → 손절 → 익절. 교차 포지션: 손절 → 익절 (강제청산은 아래에서 계좌 단위로 판단)
  for r in
    select pos.id, pos.side, pos.liq_price, pos.tp, pos.sl, pos.margin_mode, p.price
    from public.paper_positions pos join public.paper_prices p on p.symbol = pos.symbol
  loop
    px := r.price;
    if r.margin_mode = 'isolated' and ((r.side = 'long' and px <= r.liq_price) or (r.side = 'short' and px >= r.liq_price)) then
      perform public._paper_close(r.id, r.liq_price, 'liquidation');
    elsif r.sl is not null and ((r.side = 'long' and px <= r.sl) or (r.side = 'short' and px >= r.sl)) then
      perform public._paper_close(r.id, r.sl, 'sl');
    elsif r.tp is not null and ((r.side = 'long' and px >= r.tp) or (r.side = 'short' and px <= r.tp)) then
      perform public._paper_close(r.id, r.tp, 'tp');
    end if;
  end loop;

  -- 지정가 청산: 롱은 가격 >= 지정가(위에서 매도), 숏은 가격 <= 지정가(아래에서 매수)
  for r in
    select co.id, co.position_id, co.price, co.qty
    from public.paper_close_orders co
    join public.paper_positions pos on pos.id = co.position_id
    join public.paper_prices p on p.symbol = pos.symbol
    where co.status = 'open'
      and ((pos.side = 'long' and p.price >= co.price) or (pos.side = 'short' and p.price <= co.price))
    order by co.created_at
  loop
    perform public._paper_close(r.position_id, r.price, 'limit', r.qty);
    update public.paper_close_orders set status = 'filled' where id = r.id;
  end loop;

  -- 교차 마진: 계좌별 담보 자산(잔고 + Σ증거금 + Σ미실현손익) <= 유지증거금(Σ명목가치×0.5%) 이면 교차 포지션 전부 강제청산
  for r in
    select pos.user_id
      from public.paper_positions pos
      join public.paper_prices p on p.symbol = pos.symbol
      join public.paper_accounts a on a.user_id = pos.user_id
     where pos.margin_mode = 'cross'
     group by pos.user_id, a.balance
    having a.balance + sum(pos.margin + (p.price - pos.entry_price) * pos.qty * (case when pos.side = 'long' then 1 else -1 end))
           <= sum(pos.qty * p.price * 0.005)
  loop
    perform public._paper_liquidate_cross(r.user_id);
  end loop;

  -- 남은 교차 포지션의 청산가를 현재 시세 기준으로 갱신
  for r in select distinct user_id from public.paper_positions where margin_mode = 'cross' loop
    perform public._paper_refresh_cross_liq(r.user_id);
  end loop;
end $$;

revoke all on function public.paper_tick(text, jsonb) from public, anon, authenticated;
grant execute on function public.paper_tick(text, jsonb) to anon, authenticated;

-- ───────── 계좌 초기화 후에도 모드 값은 기본(격리)으로 시작 ─────────
-- (paper_reset_account 는 포지션·주문을 지우므로 별도 변경 없음)
