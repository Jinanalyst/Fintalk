-- ============================================================================
-- 암호화폐 선물 모의투자 (가상 USDT, 실제 자금 없음)
-- 여러 번 실행해도 안전합니다. Supabase SQL Editor 에 통째로 붙여넣어 실행하세요.
--
-- 실행 후 1회: 가격 갱신용 비밀값을 등록하고, 같은 값을 서버 환경변수
-- TRADE_TICK_SECRET 에도 넣어 주세요. (클라이언트는 이 값을 알 수 없습니다.)
--   insert into public.paper_config(key, value) values ('tick_secret', '여기에-긴-랜덤-문자열')
--   on conflict (key) do update set value = excluded.value;
-- ============================================================================

-- ───────── 1. 테이블 ─────────

create table if not exists public.paper_config (
  key   text primary key,
  value text not null
);

create table if not exists public.paper_prices (
  symbol     text primary key,
  price      numeric not null check (price > 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.paper_accounts (
  user_id     uuid primary key references public.profiles(id) on delete cascade,
  balance     numeric not null default 10000 check (balance >= 0),
  reset_count int not null default 0,
  created_at  timestamptz not null default now()
);

create table if not exists public.paper_orders (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  symbol     text not null,
  side       text not null check (side in ('long','short')),
  price      numeric not null check (price > 0),           -- 지정가
  qty        numeric not null check (qty > 0),
  leverage   int not null check (leverage between 1 and 50),
  margin     numeric not null,                              -- 예약된 증거금
  fee        numeric not null,                              -- 예약된 진입 수수료
  tp         numeric,
  sl         numeric,
  status     text not null default 'open' check (status in ('open','filled','cancelled')),
  created_at timestamptz not null default now()
);

create table if not exists public.paper_positions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  symbol      text not null,
  side        text not null check (side in ('long','short')),
  qty         numeric not null check (qty > 0),
  entry_price numeric not null check (entry_price > 0),
  leverage    int not null check (leverage between 1 and 50),
  margin      numeric not null,
  open_fee    numeric not null,
  tp          numeric,
  sl          numeric,
  liq_price   numeric not null,
  opened_at   timestamptz not null default now()
);

create table if not exists public.paper_trades (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  symbol      text not null,
  side        text not null,
  qty         numeric not null,
  entry_price numeric not null,
  exit_price  numeric not null,
  leverage    int not null,
  margin      numeric not null,
  pnl         numeric not null,        -- 수수료 차감 후 손익
  fee         numeric not null,        -- 진입 + 청산 수수료
  reason      text not null check (reason in ('manual','tp','sl','liquidation')),
  opened_at   timestamptz not null,
  closed_at   timestamptz not null default now()
);

create index if not exists paper_orders_user_idx    on public.paper_orders(user_id, status);
create index if not exists paper_positions_user_idx on public.paper_positions(user_id);
create index if not exists paper_trades_user_idx    on public.paper_trades(user_id, closed_at desc);

-- ───────── 2. RLS: 읽기는 본인 것만, 쓰기는 아래 함수로만 ─────────

alter table public.paper_config    enable row level security;  -- 정책 없음 = 아무도 접근 불가
alter table public.paper_prices    enable row level security;
alter table public.paper_accounts  enable row level security;
alter table public.paper_orders    enable row level security;
alter table public.paper_positions enable row level security;
alter table public.paper_trades    enable row level security;

drop policy if exists paper_prices_read    on public.paper_prices;
drop policy if exists paper_accounts_read  on public.paper_accounts;
drop policy if exists paper_orders_read    on public.paper_orders;
drop policy if exists paper_positions_read on public.paper_positions;
drop policy if exists paper_trades_read    on public.paper_trades;

create policy paper_prices_read    on public.paper_prices    for select using (true);
create policy paper_accounts_read  on public.paper_accounts  for select using (user_id = auth.uid());
create policy paper_orders_read    on public.paper_orders    for select using (user_id = auth.uid());
create policy paper_positions_read on public.paper_positions for select using (user_id = auth.uid());
create policy paper_trades_read    on public.paper_trades    for select using (user_id = auth.uid());

revoke insert, update, delete on public.paper_config, public.paper_prices, public.paper_accounts,
  public.paper_orders, public.paper_positions, public.paper_trades from anon, authenticated;

-- ───────── 3. 내부 함수 ─────────

-- 수수료율 0.04%, 유지증거금률 0.5%
create or replace function public._paper_fee_rate() returns numeric language sql immutable as $$ select 0.0004::numeric $$;

create or replace function public._paper_liq_price(p_side text, p_entry numeric, p_lev int)
returns numeric language sql immutable as $$
  select case when p_side = 'long'
    then p_entry * (1 - 1.0 / p_lev + 0.005)
    else p_entry * (1 + 1.0 / p_lev - 0.005) end
$$;

-- 포지션 청산(정산). 청산(liquidation)이면 증거금만 잃고 환급은 0.
create or replace function public._paper_close(p_id uuid, p_exit numeric, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare
  pos public.paper_positions%rowtype;
  gross numeric; close_fee numeric; refund numeric; net numeric;
begin
  select * into pos from public.paper_positions where id = p_id for update;
  if not found then return; end if;

  gross := (p_exit - pos.entry_price) * pos.qty * (case when pos.side = 'long' then 1 else -1 end);
  close_fee := pos.qty * p_exit * public._paper_fee_rate();

  if p_reason = 'liquidation' then
    refund := 0;
    net := -(pos.margin) - pos.open_fee;
    close_fee := 0;
  else
    refund := greatest(pos.margin + gross - close_fee, 0);
    net := gross - close_fee - pos.open_fee;
  end if;

  update public.paper_accounts set balance = balance + refund where user_id = pos.user_id;

  insert into public.paper_trades(user_id, symbol, side, qty, entry_price, exit_price, leverage, margin, pnl, fee, reason, opened_at)
  values (pos.user_id, pos.symbol, pos.side, pos.qty, pos.entry_price, p_exit, pos.leverage, pos.margin, net,
          pos.open_fee + close_fee, p_reason, pos.opened_at);

  delete from public.paper_positions where id = p_id;
end $$;

create or replace function public._paper_open(p_user uuid, p_symbol text, p_side text, p_qty numeric, p_price numeric,
  p_lev int, p_margin numeric, p_fee numeric, p_tp numeric, p_sl numeric)
returns void language sql security definer set search_path = public as $$
  insert into public.paper_positions(user_id, symbol, side, qty, entry_price, leverage, margin, open_fee, tp, sl, liq_price)
  values (p_user, p_symbol, p_side, p_qty, p_price, p_lev, p_margin, p_fee, p_tp, p_sl,
          public._paper_liq_price(p_side, p_price, p_lev));
$$;

create or replace function public._paper_validate_tpsl(p_side text, p_ref numeric, p_tp numeric, p_sl numeric)
returns void language plpgsql immutable as $$
begin
  if p_side = 'long' then
    if p_tp is not null and p_tp <= p_ref then raise exception '롱 익절가는 진입가보다 높아야 합니다.'; end if;
    if p_sl is not null and p_sl >= p_ref then raise exception '롱 손절가는 진입가보다 낮아야 합니다.'; end if;
  else
    if p_tp is not null and p_tp >= p_ref then raise exception '숏 익절가는 진입가보다 낮아야 합니다.'; end if;
    if p_sl is not null and p_sl <= p_ref then raise exception '숏 손절가는 진입가보다 높아야 합니다.'; end if;
  end if;
  if (p_tp is not null and p_tp <= 0) or (p_sl is not null and p_sl <= 0) then raise exception '가격이 올바르지 않습니다.'; end if;
end $$;

-- ───────── 4. 가격 갱신 + 체결/청산 매칭 (서버 전용: 비밀값 필요) ─────────

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
end $$;

-- ───────── 5. 사용자용 함수 ─────────

-- 주문. p_size_usdt = 명목가치(수량×가격). p_limit 이 null 이면 시장가.
create or replace function public.paper_place_order(
  p_symbol text, p_side text, p_size_usdt numeric, p_leverage int,
  p_limit numeric default null, p_tp numeric default null, p_sl numeric default null)
returns text language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  mark public.paper_prices%rowtype;
  px numeric; qty numeric; margin numeric; fee numeric; bal numeric;
  n int;
begin
  if uid is null then raise exception '로그인이 필요합니다.'; end if;
  if p_side not in ('long','short') then raise exception '방향이 올바르지 않습니다.'; end if;
  if p_leverage < 1 or p_leverage > 50 then raise exception '레버리지는 1~50배입니다.'; end if;
  if p_size_usdt is null or p_size_usdt < 10 then raise exception '주문 규모는 최소 10 USDT 입니다.'; end if;
  if p_size_usdt > 1000000 then raise exception '주문 규모가 너무 큽니다.'; end if;

  select * into mark from public.paper_prices where symbol = p_symbol;
  if not found or mark.updated_at < now() - interval '2 minutes' then
    raise exception '시세가 갱신되지 않았습니다. 잠시 후 다시 시도해 주세요.';
  end if;

  insert into public.paper_accounts(user_id) values (uid) on conflict do nothing;
  select balance into bal from public.paper_accounts where user_id = uid for update;

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
    perform public._paper_open(uid, p_symbol, p_side, qty, px, p_leverage, margin, fee, p_tp, p_sl);
    return 'filled';
  end if;

  insert into public.paper_orders(user_id, symbol, side, price, qty, leverage, margin, fee, tp, sl)
  values (uid, p_symbol, p_side, px, qty, p_leverage, margin, fee, p_tp, p_sl);
  return 'open';
end $$;

create or replace function public.paper_close_position(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  pos public.paper_positions%rowtype;
  mark public.paper_prices%rowtype;
begin
  if uid is null then raise exception '로그인이 필요합니다.'; end if;
  select * into pos from public.paper_positions where id = p_id and user_id = uid;
  if not found then raise exception '포지션을 찾을 수 없습니다.'; end if;
  select * into mark from public.paper_prices where symbol = pos.symbol;
  if not found or mark.updated_at < now() - interval '2 minutes' then
    raise exception '시세가 갱신되지 않았습니다. 잠시 후 다시 시도해 주세요.';
  end if;
  perform public._paper_close(p_id, mark.price, 'manual');
end $$;

create or replace function public.paper_cancel_order(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  o public.paper_orders%rowtype;
begin
  if uid is null then raise exception '로그인이 필요합니다.'; end if;
  select * into o from public.paper_orders where id = p_id and user_id = uid and status = 'open' for update;
  if not found then raise exception '취소할 수 있는 주문이 아닙니다.'; end if;
  update public.paper_orders set status = 'cancelled' where id = p_id;
  update public.paper_accounts set balance = balance + o.margin + o.fee where user_id = uid;
end $$;

create or replace function public.paper_set_tpsl(p_id uuid, p_tp numeric, p_sl numeric)
returns void language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  pos public.paper_positions%rowtype;
begin
  if uid is null then raise exception '로그인이 필요합니다.'; end if;
  select * into pos from public.paper_positions where id = p_id and user_id = uid for update;
  if not found then raise exception '포지션을 찾을 수 없습니다.'; end if;
  perform public._paper_validate_tpsl(pos.side, pos.entry_price, p_tp, p_sl);
  update public.paper_positions set tp = p_tp, sl = p_sl where id = p_id;
end $$;

-- 계정 초기화: 포지션·주문 삭제, 잔고 10,000 USDT 로 복구 (체결 내역은 유지)
create or replace function public.paper_reset_account()
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception '로그인이 필요합니다.'; end if;
  delete from public.paper_positions where user_id = uid;
  delete from public.paper_orders where user_id = uid and status = 'open';
  insert into public.paper_accounts(user_id) values (uid)
  on conflict (user_id) do update set balance = 10000, reset_count = public.paper_accounts.reset_count + 1;
end $$;

-- ───────── 6. 실행 권한 ─────────

revoke all on function public._paper_close(uuid, numeric, text) from public, anon, authenticated;
revoke all on function public._paper_open(uuid, text, text, numeric, numeric, int, numeric, numeric, numeric, numeric) from public, anon, authenticated;

revoke all on function public.paper_tick(text, jsonb) from public;
grant execute on function public.paper_tick(text, jsonb) to anon, authenticated;

revoke all on function public.paper_place_order(text, text, numeric, int, numeric, numeric, numeric) from public, anon;
revoke all on function public.paper_close_position(uuid) from public, anon;
revoke all on function public.paper_cancel_order(uuid) from public, anon;
revoke all on function public.paper_set_tpsl(uuid, numeric, numeric) from public, anon;
revoke all on function public.paper_reset_account() from public, anon;
grant execute on function public.paper_place_order(text, text, numeric, int, numeric, numeric, numeric) to authenticated;
grant execute on function public.paper_close_position(uuid) to authenticated;
grant execute on function public.paper_cancel_order(uuid) to authenticated;
grant execute on function public.paper_set_tpsl(uuid, numeric, numeric) to authenticated;
grant execute on function public.paper_reset_account() to authenticated;
