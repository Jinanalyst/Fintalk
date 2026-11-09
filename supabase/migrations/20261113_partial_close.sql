-- ============================================================================
-- 부분 청산 + 지정가 청산 (reduce-only 주문)
-- 여러 번 실행해도 안전합니다. Supabase SQL Editor 에 통째로 붙여넣어 실행하세요.
-- ============================================================================

-- 거래 사유에 'limit'(지정가 청산) 추가
alter table public.paper_trades drop constraint if exists paper_trades_reason_check;
alter table public.paper_trades add constraint paper_trades_reason_check
  check (reason in ('manual','tp','sl','liquidation','limit'));

-- 지정가 청산 주문: 포지션이 사라지면 함께 삭제됩니다.
create table if not exists public.paper_close_orders (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  position_id uuid not null references public.paper_positions(id) on delete cascade,
  price       numeric not null check (price > 0),
  qty         numeric not null check (qty > 0),
  status      text not null default 'open' check (status in ('open','filled','cancelled')),
  created_at  timestamptz not null default now()
);
create index if not exists paper_close_orders_pos_idx on public.paper_close_orders(position_id, status);

alter table public.paper_close_orders enable row level security;
drop policy if exists paper_close_orders_read on public.paper_close_orders;
create policy paper_close_orders_read on public.paper_close_orders for select using (user_id = auth.uid());
revoke insert, update, delete on public.paper_close_orders from anon, authenticated;

-- 정산: p_qty 가 있으면 그만큼만 청산(부분 청산). 증거금·진입 수수료는 청산 비율만큼 나눠 정산합니다.
drop function if exists public._paper_close(uuid, numeric, text);
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
end $$;

revoke all on function public._paper_close(uuid, numeric, text, numeric) from public, anon, authenticated;

-- 가격 갱신 + 체결/청산 매칭 (지정가 청산 처리 추가)
create or replace function public.paper_tick(p_secret text, p_prices jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  k text; v numeric; r record; px numeric;
begin
  if p_secret is null or p_secret is distinct from (select value from public.paper_config where key = 'tick_secret') then
    raise exception 'forbidden';
  end if;

  for k, v in select key, value::numeric from jsonb_each_text(p_prices) loop
    if k in ('BTCUSDT','ETHUSDT','SOLUSDT','XRPUSDT','DOGEUSDT','BNBUSDT') and v > 0 then
      insert into public.paper_prices(symbol, price, updated_at) values (k, v, now())
      on conflict (symbol) do update set price = excluded.price, updated_at = excluded.updated_at;
    end if;
  end loop;

  -- 지정가 체결: 롱은 가격 <= 지정가, 숏은 가격 >= 지정가
  for r in
    select o.* from public.paper_orders o join public.paper_prices p on p.symbol = o.symbol
    where o.status = 'open'
      and ((o.side = 'long' and p.price <= o.price) or (o.side = 'short' and p.price >= o.price))
    for update of o
  loop
    perform public._paper_open(r.user_id, r.symbol, r.side, r.qty, r.price, r.leverage, r.margin, r.fee, r.tp, r.sl);
    update public.paper_orders set status = 'filled' where id = r.id;
  end loop;

  -- 강제청산 → 손절 → 익절 순서로 확인
  for r in
    select pos.id, pos.side, pos.liq_price, pos.tp, pos.sl, p.price
    from public.paper_positions pos join public.paper_prices p on p.symbol = pos.symbol
  loop
    px := r.price;
    if (r.side = 'long' and px <= r.liq_price) or (r.side = 'short' and px >= r.liq_price) then
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
end $$;

-- 시장가 청산 (p_pct: 1~100 %)
drop function if exists public.paper_close_position(uuid);
create or replace function public.paper_close_position(p_id uuid, p_pct numeric default 100)
returns void language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  pos public.paper_positions%rowtype;
  mark public.paper_prices%rowtype;
begin
  if uid is null then raise exception '로그인이 필요합니다.'; end if;
  if p_pct is null or p_pct <= 0 or p_pct > 100 then raise exception '청산 비율은 1~100%% 입니다.'; end if;
  select * into pos from public.paper_positions where id = p_id and user_id = uid;
  if not found then raise exception '포지션을 찾을 수 없습니다.'; end if;
  select * into mark from public.paper_prices where symbol = pos.symbol;
  if not found or mark.updated_at < now() - interval '2 minutes' then
    raise exception '시세가 갱신되지 않았습니다. 잠시 후 다시 시도해 주세요.';
  end if;
  perform public._paper_close(p_id, mark.price, 'manual', pos.qty * p_pct / 100);
end $$;

-- 지정가 청산 주문 등록 (reduce-only): 롱은 현재가보다 높게, 숏은 현재가보다 낮게
create or replace function public.paper_place_close_order(p_id uuid, p_pct numeric, p_price numeric)
returns void language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  pos public.paper_positions%rowtype;
  mark public.paper_prices%rowtype;
  q numeric; pending numeric; n int;
begin
  if uid is null then raise exception '로그인이 필요합니다.'; end if;
  if p_pct is null or p_pct <= 0 or p_pct > 100 then raise exception '청산 비율은 1~100%% 입니다.'; end if;
  if p_price is null or p_price <= 0 then raise exception '가격이 올바르지 않습니다.'; end if;
  select * into pos from public.paper_positions where id = p_id and user_id = uid for update;
  if not found then raise exception '포지션을 찾을 수 없습니다.'; end if;
  select * into mark from public.paper_prices where symbol = pos.symbol;
  if not found then raise exception '시세가 없습니다.'; end if;

  if (pos.side = 'long' and p_price <= mark.price) or (pos.side = 'short' and p_price >= mark.price) then
    raise exception '지정가 청산은 %가 현재가보다 %야 합니다. 바로 청산하려면 시장가를 이용해 주세요.',
      case when pos.side = 'long' then '롱은 가격이' else '숏은 가격이' end,
      case when pos.side = 'long' then '높아' else '낮아' end;
  end if;

  q := pos.qty * p_pct / 100;
  select coalesce(sum(qty), 0), count(*) into pending, n
    from public.paper_close_orders where position_id = p_id and status = 'open';
  if n >= 10 then raise exception '지정가 청산 주문은 포지션당 10개까지 가능합니다.'; end if;
  if pending + q > pos.qty * 1.000001 then raise exception '지정가 청산 수량이 포지션 수량을 넘습니다. 기존 청산 주문을 먼저 취소해 주세요.'; end if;

  insert into public.paper_close_orders(user_id, position_id, price, qty) values (uid, p_id, p_price, q);
end $$;

create or replace function public.paper_cancel_close_order(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception '로그인이 필요합니다.'; end if;
  update public.paper_close_orders set status = 'cancelled' where id = p_id and user_id = auth.uid() and status = 'open';
  if not found then raise exception '취소할 수 있는 주문이 아닙니다.'; end if;
end $$;

revoke all on function public.paper_close_position(uuid, numeric), public.paper_place_close_order(uuid, numeric, numeric), public.paper_cancel_close_order(uuid) from public, anon;
grant execute on function public.paper_close_position(uuid, numeric), public.paper_place_close_order(uuid, numeric, numeric), public.paper_cancel_close_order(uuid) to authenticated;
revoke all on function public.paper_tick(text, jsonb) from public, anon, authenticated;
grant execute on function public.paper_tick(text, jsonb) to anon, authenticated;
