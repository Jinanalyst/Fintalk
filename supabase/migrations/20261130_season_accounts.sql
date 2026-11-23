-- ============================================================================
-- Season accounts: Contest / Practice split, referrals, season sign-up, live MDD, snapshot RPCs.
--
--   · ADDITIVE ONLY. No table, column or row is dropped. Existing paper trading data keeps working:
--     every existing order / position / trade has contest_id = NULL, which now means "Practice".
--   · Practice  = paper_accounts (one per user, resettable, never on the leaderboard)
--     Contest   = contest_accounts (one per user per round, funded when the round starts,
--                 tradable only between starts_at and ends_at, cannot be reset)
--   · The engine functions are re-created with an account (contest) argument. Old signatures of
--     _paper_open / _paper_refresh_cross_liq / _paper_liquidate_cross / paper_place_order /
--     paper_reduce_only are dropped first so calls stay unambiguous (functions only — no data).
--   · Contest leverage cap: contests.max_leverage (Season 1 = 20x).
--   · Referral bonus: invitee joins a round  → invitee and inviter both get +referral_bonus_pct %
--     starting balance in that round, at most once each per round.
--   · Season 1 round is created (and featured) at the end of this file.
--
-- Requires: schema.sql and migrations up to 20261129_contest_rounds.sql. Safe to run more than once.
-- ============================================================================

-- ───────── 1. Round settings ─────────
alter table public.contests add column if not exists registration_ends_at timestamptz;
alter table public.contests add column if not exists max_leverage int not null default 20;
alter table public.contests add column if not exists referral_bonus_pct numeric not null default 10;
alter table public.contests drop constraint if exists contests_max_leverage_check;
alter table public.contests add constraint contests_max_leverage_check check (max_leverage between 1 and 150);
alter table public.contests drop constraint if exists contests_referral_bonus_pct_check;
alter table public.contests add constraint contests_referral_bonus_pct_check check (referral_bonus_pct between 0 and 100);

-- ───────── 2. Contest accounts ─────────
create table if not exists public.contest_accounts (
  contest_id    bigint not null references public.contests(id) on delete cascade,
  user_id       uuid   not null references public.profiles(id) on delete cascade,
  start_balance numeric not null check (start_balance > 0),
  balance       numeric not null check (balance >= 0),
  peak_equity   numeric not null,
  max_dd_pct    numeric not null default 0,
  bonus_applied boolean not null default false,
  final_equity  numeric,              -- frozen right after the round ends
  created_at    timestamptz not null default now(),
  primary key (contest_id, user_id)
);
alter table public.contest_accounts enable row level security;
drop policy if exists contest_accounts_read on public.contest_accounts;
create policy contest_accounts_read on public.contest_accounts for select using (user_id = auth.uid());
revoke insert, update, delete on public.contest_accounts from anon, authenticated;

-- Orders / positions / trades belong to Practice (NULL) or to one round.
-- "no action" on delete: a round that already has trades cannot be deleted by accident.
alter table public.paper_orders    add column if not exists contest_id bigint references public.contests(id);
alter table public.paper_positions add column if not exists contest_id bigint references public.contests(id);
alter table public.paper_trades    add column if not exists contest_id bigint references public.contests(id);
create index if not exists paper_positions_contest_idx on public.paper_positions(contest_id, user_id) where contest_id is not null;
create index if not exists paper_orders_contest_idx    on public.paper_orders(contest_id, user_id) where contest_id is not null;
create index if not exists paper_trades_contest_idx    on public.paper_trades(contest_id, user_id, closed_at) where contest_id is not null;

-- ───────── 3. Referrals ─────────
create table if not exists public.referral_codes (
  user_id    uuid primary key references public.profiles(id) on delete cascade,
  code       text not null unique check (code ~ '^[A-Za-z0-9_-]{4,32}$'),
  created_at timestamptz not null default now()
);
create table if not exists public.referrals (
  invitee    uuid primary key references public.profiles(id) on delete cascade,
  inviter    uuid not null references public.profiles(id) on delete cascade,
  code       text not null,
  created_at timestamptz not null default now(),
  check (invitee <> inviter)
);
create index if not exists referrals_inviter_idx on public.referrals(inviter);
alter table public.referral_codes enable row level security;
alter table public.referrals      enable row level security;
drop policy if exists referral_codes_read on public.referral_codes;
create policy referral_codes_read on public.referral_codes for select using (user_id = auth.uid());
drop policy if exists referrals_read on public.referrals;
create policy referrals_read on public.referrals for select using (inviter = auth.uid() or invitee = auth.uid());
revoke insert, update, delete on public.referral_codes, public.referrals from anon, authenticated;

-- ───────── 4. Account helpers ─────────
-- Balance of Practice (p_contest null) or of a contest account.
create or replace function public._paper_balance(p_user uuid, p_contest bigint, p_lock boolean default false)
returns numeric language plpgsql security definer set search_path = public as $$
declare b numeric;
begin
  if p_contest is null then
    if p_lock then select balance into b from public.paper_accounts where user_id = p_user for update;
    else select balance into b from public.paper_accounts where user_id = p_user; end if;
  else
    if p_lock then select balance into b from public.contest_accounts where contest_id = p_contest and user_id = p_user for update;
    else select balance into b from public.contest_accounts where contest_id = p_contest and user_id = p_user; end if;
  end if;
  return coalesce(b, 0);
end $$;

create or replace function public._paper_balance_add(p_user uuid, p_contest bigint, p_delta numeric)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_contest is null then
    update public.paper_accounts set balance = balance + p_delta where user_id = p_user;
  else
    update public.contest_accounts set balance = balance + p_delta where contest_id = p_contest and user_id = p_user;
  end if;
end $$;

create or replace function public._paper_balance_zero(p_user uuid, p_contest bigint)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_contest is null then
    update public.paper_accounts set balance = 0 where user_id = p_user;
  else
    update public.contest_accounts set balance = 0 where contest_id = p_contest and user_id = p_user;
  end if;
end $$;

-- Practice is always open; a contest account only between starts_at and ends_at.
create or replace function public._contest_live(p_contest bigint)
returns boolean language sql stable security definer set search_path = public as $$
  select p_contest is null
      or exists (select 1 from public.contests c where c.id = p_contest and now() >= c.starts_at and now() < c.ends_at);
$$;

-- Equity of a contest account: free balance + Σ(position margin + unrealized PnL) + Σ(open order margin + fee).
create or replace function public._contest_equity(p_contest bigint, p_user uuid)
returns numeric language sql stable security definer set search_path = public as $$
  select greatest(0,
    coalesce((select a.balance from public.contest_accounts a where a.contest_id = p_contest and a.user_id = p_user), 0)
    + coalesce((select sum(pos.margin + (pr.price - pos.entry_price) * pos.qty * (case when pos.side = 'long' then 1 else -1 end))
                  from public.paper_positions pos join public.paper_prices pr on pr.symbol = pos.symbol
                 where pos.user_id = p_user and pos.contest_id = p_contest), 0)
    + coalesce((select sum(o.margin + o.fee) from public.paper_orders o
                 where o.user_id = p_user and o.contest_id = p_contest and o.status = 'open'), 0));
$$;

-- Does this participant earn the referral bonus in this round? (invited and joined, or invited someone who joined)
create or replace function public._contest_referral_qualifies(p_contest bigint, p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.referrals r
                   join public.participants p on p.contest_id = p_contest and p.user_id = r.invitee
                  where r.invitee = p_user or r.inviter = p_user);
$$;

-- Create the contest account the first time it is needed after the round starts.
create or replace function public._contest_ensure_account(p_contest bigint, p_user uuid)
returns public.contest_accounts language plpgsql security definer set search_path = public as $$
declare
  c public.contests%rowtype;
  a public.contest_accounts%rowtype;
  q boolean; sb numeric;
begin
  select * into a from public.contest_accounts where contest_id = p_contest and user_id = p_user;
  if found then return a; end if;
  select * into c from public.contests where id = p_contest;
  if not found then raise exception 'Season not found.'; end if;
  if not exists (select 1 from public.participants where contest_id = p_contest and user_id = p_user) then
    raise exception 'Join the season first.';
  end if;
  if now() < c.starts_at then raise exception 'The contest has not started yet. Use your Practice account until it begins.'; end if;
  q := public._contest_referral_qualifies(p_contest, p_user);
  sb := c.starting_balance * (1 + case when q then c.referral_bonus_pct / 100 else 0 end);
  insert into public.contest_accounts(contest_id, user_id, start_balance, balance, peak_equity, bonus_applied)
  values (p_contest, p_user, sb, sb, sb, q)
  on conflict (contest_id, user_id) do nothing;
  select * into a from public.contest_accounts where contest_id = p_contest and user_id = p_user;
  return a;
end $$;

-- If an account is already funded (late join), add the bonus now. Only once per account.
create or replace function public._contest_grant_bonus(p_contest bigint, p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
declare amt numeric;
begin
  select c.starting_balance * c.referral_bonus_pct / 100 into amt from public.contests c where c.id = p_contest;
  update public.contest_accounts
     set start_balance = start_balance + amt, balance = balance + amt, peak_equity = peak_equity + amt, bonus_applied = true
   where contest_id = p_contest and user_id = p_user and not bonus_applied and amt > 0;
end $$;

revoke all on function public._paper_balance(uuid, bigint, boolean), public._paper_balance_add(uuid, bigint, numeric),
  public._paper_balance_zero(uuid, bigint), public._contest_ensure_account(bigint, uuid), public._contest_grant_bonus(bigint, uuid),
  public._contest_equity(bigint, uuid), public._contest_referral_qualifies(bigint, uuid), public._contest_live(bigint)
  from public, anon, authenticated;

-- ───────── 5. Cross margin (per account) ─────────
drop function if exists public._paper_refresh_cross_liq(uuid);
create or replace function public._paper_refresh_cross_liq(p_user uuid, p_contest bigint default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  with base as (
    select pos.id, pos.side, pos.qty, pos.entry_price, pos.margin,
           (p.price - pos.entry_price) * pos.qty * (case when pos.side = 'long' then 1 else -1 end) as upnl,
           pos.qty * p.price * 0.005 as mm
      from public.paper_positions pos
      join public.paper_prices p on p.symbol = pos.symbol
     where pos.user_id = p_user and pos.margin_mode = 'cross' and pos.contest_id is not distinct from p_contest
  ),
  tot as (
    select public._paper_balance(p_user, p_contest) + coalesce(sum(margin), 0) + coalesce(sum(upnl - mm), 0) as w
      from base
  ),
  calc as (
    select b.id, b.side, b.qty, b.entry_price, t.w - (b.upnl - b.mm) as rest
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

drop function if exists public._paper_liquidate_cross(uuid);
create or replace function public._paper_liquidate_cross(p_user uuid, p_contest bigint default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  r record;
  gross numeric;
begin
  for r in
    select pos.*, p.price as mark
      from public.paper_positions pos
      join public.paper_prices p on p.symbol = pos.symbol
     where pos.user_id = p_user and pos.margin_mode = 'cross' and pos.contest_id is not distinct from p_contest
     for update of pos
  loop
    gross := (r.mark - r.entry_price) * r.qty * (case when r.side = 'long' then 1 else -1 end);
    insert into public.paper_trades(user_id, symbol, side, qty, entry_price, exit_price, leverage, margin, pnl, fee, reason, opened_at, contest_id)
    values (r.user_id, r.symbol, r.side, r.qty, r.entry_price, r.mark, r.leverage, r.margin, gross - r.open_fee, r.open_fee, 'liquidation', r.opened_at, r.contest_id);
    delete from public.paper_positions where id = r.id;
  end loop;
  perform public._paper_balance_zero(p_user, p_contest);
end $$;

revoke all on function public._paper_refresh_cross_liq(uuid, bigint) from public, anon, authenticated;
revoke all on function public._paper_liquidate_cross(uuid, bigint) from public, anon, authenticated;

-- ───────── 6. Open / close ─────────
drop function if exists public._paper_open(uuid, text, text, numeric, numeric, int, numeric, numeric, numeric, numeric, text);
create or replace function public._paper_open(p_user uuid, p_symbol text, p_side text, p_qty numeric, p_price numeric,
  p_lev int, p_margin numeric, p_fee numeric, p_tp numeric, p_sl numeric, p_mode text default 'isolated', p_contest bigint default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  pos public.paper_positions%rowtype;
  nq numeric; ne numeric;
begin
  select * into pos from public.paper_positions
   where user_id = p_user and symbol = p_symbol and side = p_side and leverage = p_lev and margin_mode = p_mode
     and contest_id is not distinct from p_contest
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
    insert into public.paper_positions(user_id, symbol, side, qty, entry_price, leverage, margin, open_fee, tp, sl, liq_price, margin_mode, contest_id)
    values (p_user, p_symbol, p_side, p_qty, p_price, p_lev, p_margin, p_fee, p_tp, p_sl,
            public._paper_liq_price(p_side, p_price, p_lev), p_mode, p_contest);
  end if;

  if p_mode = 'cross' then
    perform public._paper_refresh_cross_liq(p_user, p_contest);
  end if;
end $$;
revoke all on function public._paper_open(uuid, text, text, numeric, numeric, int, numeric, numeric, numeric, numeric, text, bigint) from public, anon, authenticated;

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

  perform public._paper_balance_add(pos.user_id, pos.contest_id, refund);

  insert into public.paper_trades(user_id, symbol, side, qty, entry_price, exit_price, leverage, margin, pnl, fee, reason, opened_at, contest_id)
  values (pos.user_id, pos.symbol, pos.side, q, pos.entry_price, p_exit, pos.leverage, m, net, of + close_fee, p_reason, pos.opened_at, pos.contest_id);

  if ratio >= 0.999999 then
    delete from public.paper_positions where id = p_id;
  else
    update public.paper_positions
       set qty = qty - q, margin = margin - m, open_fee = open_fee - of
     where id = p_id;
  end if;

  if pos.margin_mode = 'cross' then
    perform public._paper_refresh_cross_liq(pos.user_id, pos.contest_id);
  end if;
end $$;
revoke all on function public._paper_close(uuid, numeric, text, numeric) from public, anon, authenticated;

-- ───────── 7. Orders ─────────
drop function if exists public.paper_place_order(text, text, numeric, int, numeric, numeric, numeric, text);
create or replace function public.paper_place_order(
  p_symbol text, p_side text, p_size_usdt numeric, p_leverage int,
  p_limit numeric default null, p_tp numeric default null, p_sl numeric default null,
  p_margin_mode text default 'isolated', p_contest bigint default null)
returns text language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  c public.contests%rowtype;
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

  if p_contest is not null then
    select * into c from public.contests where id = p_contest;
    if not found then raise exception 'Season not found.'; end if;
    if now() < c.starts_at then raise exception 'The contest has not started yet. Use your Practice account until it begins.'; end if;
    if now() >= c.ends_at then raise exception 'The contest has ended.'; end if;
    if p_leverage > c.max_leverage then raise exception 'Contest accounts are limited to %x leverage.', c.max_leverage; end if;
    if not public.is_active_user() then raise exception 'Your account is restricted.'; end if;
    perform public._contest_ensure_account(p_contest, uid);
  end if;

  select * into mark from public.paper_prices where symbol = p_symbol;
  if not found or mark.updated_at < now() - interval '2 minutes' then
    raise exception '시세가 갱신되지 않았습니다. 잠시 후 다시 시도해 주세요.';
  end if;

  if p_contest is null then
    insert into public.paper_accounts(user_id) values (uid) on conflict do nothing;
  end if;
  bal := public._paper_balance(uid, p_contest, true);

  select (select count(*) from public.paper_positions where user_id = uid and contest_id is not distinct from p_contest and symbol = p_symbol and margin_mode <> p_margin_mode)
       + (select count(*) from public.paper_orders where user_id = uid and contest_id is not distinct from p_contest and symbol = p_symbol and status = 'open' and margin_mode <> p_margin_mode)
    into other;
  if other > 0 then
    raise exception '이 종목에 % 마진 모드의 포지션/주문이 있어 마진 모드를 바꿀 수 없습니다.',
      case when p_margin_mode = 'cross' then '격리' else '교차' end;
  end if;

  select (select count(*) from public.paper_positions where user_id = uid and contest_id is not distinct from p_contest)
       + (select count(*) from public.paper_orders where user_id = uid and contest_id is not distinct from p_contest and status = 'open') into n;
  if n >= 30 then raise exception '포지션과 미체결 주문은 합쳐서 30개까지 가능합니다.'; end if;

  px := coalesce(p_limit, mark.price);
  if p_limit is not null then
    if (p_side = 'long' and p_limit >= mark.price) or (p_side = 'short' and p_limit <= mark.price) then
      raise exception '지정가가 현재가와 겹칩니다. 시장가로 주문하거나 가격을 조정해 주세요.';
    end if;
  end if;

  perform public._paper_validate_tpsl(p_side, px, p_tp, p_sl);

  qty := p_size_usdt / px;
  margin := p_size_usdt / p_leverage;
  fee := p_size_usdt * public._paper_fee_rate();
  if margin + fee > bal then raise exception '잔고가 부족합니다. (필요 % USDT)', round(margin + fee, 2); end if;

  perform public._paper_balance_add(uid, p_contest, -(margin + fee));

  if p_limit is null then
    perform public._paper_open(uid, p_symbol, p_side, qty, px, p_leverage, margin, fee, p_tp, p_sl, p_margin_mode, p_contest);
    return 'filled';
  end if;

  insert into public.paper_orders(user_id, symbol, side, price, qty, leverage, margin, fee, tp, sl, margin_mode, contest_id)
  values (uid, p_symbol, p_side, px, qty, p_leverage, margin, fee, p_tp, p_sl, p_margin_mode, p_contest);
  return 'open';
end $$;
revoke all on function public.paper_place_order(text, text, numeric, int, numeric, numeric, numeric, text, bigint) from public, anon;
grant execute on function public.paper_place_order(text, text, numeric, int, numeric, numeric, numeric, text, bigint) to authenticated;

drop function if exists public.paper_reduce_only(text, text, numeric, numeric);
create or replace function public.paper_reduce_only(p_symbol text, p_side text, p_size_usdt numeric, p_limit numeric default null, p_contest bigint default null)
returns text language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  mark public.paper_prices%rowtype;
  target text;
  px numeric; want numeric; total numeric; remaining numeric; take numeric; avail numeric;
  placed numeric := 0;
  r record;
begin
  if uid is null then raise exception '로그인이 필요합니다.'; end if;
  if p_side not in ('long','short') then raise exception '방향이 올바르지 않습니다.'; end if;
  if p_size_usdt is null or p_size_usdt <= 0 then raise exception '주문 규모를 입력해 주세요.'; end if;
  if not public._contest_live(p_contest) then raise exception 'The contest is not running, so contest positions cannot be changed.'; end if;

  select * into mark from public.paper_prices where symbol = p_symbol;
  if not found or mark.updated_at < now() - interval '2 minutes' then
    raise exception '시세가 갱신되지 않았습니다. 잠시 후 다시 시도해 주세요.';
  end if;

  target := case when p_side = 'long' then 'short' else 'long' end;
  px := coalesce(p_limit, mark.price);
  want := p_size_usdt / px;

  select sum(qty) into total from public.paper_positions
   where user_id = uid and contest_id is not distinct from p_contest and symbol = p_symbol and side = target;
  if total is null or total <= 0 then
    raise exception '줄일 % 포지션이 없습니다. 리듀스 온리는 반대 방향 포지션만 줄일 수 있습니다.', case when target = 'long' then '롱' else '숏' end;
  end if;
  remaining := least(want, total);

  if p_limit is null then
    for r in select id, qty from public.paper_positions
             where user_id = uid and contest_id is not distinct from p_contest and symbol = p_symbol and side = target order by opened_at loop
      exit when remaining <= 0.000000001;
      take := least(remaining, r.qty);
      perform public._paper_close(r.id, mark.price, 'manual', take);
      remaining := remaining - take;
    end loop;
    return 'filled';
  end if;

  if (target = 'long' and p_limit <= mark.price) or (target = 'short' and p_limit >= mark.price) then
    raise exception '리듀스 온리 지정가는 현재가보다 % 가격이어야 합니다. 바로 줄이려면 시장가를 이용해 주세요.',
      case when target = 'long' then '높은' else '낮은' end;
  end if;

  for r in select id, qty from public.paper_positions
           where user_id = uid and contest_id is not distinct from p_contest and symbol = p_symbol and side = target order by opened_at loop
    exit when remaining <= 0.000000001;
    select r.qty - coalesce(sum(qty), 0) into avail
      from public.paper_close_orders where position_id = r.id and status = 'open';
    take := least(remaining, greatest(avail, 0));
    if take > 0.000000001 then
      insert into public.paper_close_orders(user_id, position_id, price, qty) values (uid, r.id, p_limit, take);
      remaining := remaining - take;
      placed := placed + take;
    end if;
  end loop;
  if placed <= 0 then
    raise exception '이미 모든 포지션에 청산 주문이 걸려 있습니다. 기존 청산 주문을 먼저 취소해 주세요.';
  end if;
  return 'open';
end $$;
revoke all on function public.paper_reduce_only(text, text, numeric, numeric, bigint) from public, anon;
grant execute on function public.paper_reduce_only(text, text, numeric, numeric, bigint) to authenticated;

-- Position-level actions: the account comes from the row itself. Contest rows are frozen outside the round.
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
  if not public._contest_live(pos.contest_id) then raise exception 'The contest is not running, so contest positions cannot be changed.'; end if;
  select * into mark from public.paper_prices where symbol = pos.symbol;
  if not found or mark.updated_at < now() - interval '2 minutes' then
    raise exception '시세가 갱신되지 않았습니다. 잠시 후 다시 시도해 주세요.';
  end if;
  perform public._paper_close(p_id, mark.price, 'manual', pos.qty * p_pct / 100);
end $$;

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
  if not public._contest_live(pos.contest_id) then raise exception 'The contest is not running, so contest positions cannot be changed.'; end if;
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
  -- Refund goes back to the account the order came from. (Equity does not change: open-order margin already counts.)
  perform public._paper_balance_add(uid, o.contest_id, o.margin + o.fee);
end $$;

create or replace function public.paper_set_tpsl(p_id uuid, p_tp numeric, p_sl numeric)
returns void language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  pos public.paper_positions%rowtype;
  mark public.paper_prices%rowtype;
begin
  if uid is null then raise exception '로그인이 필요합니다.'; end if;
  select * into pos from public.paper_positions where id = p_id and user_id = uid for update;
  if not found then raise exception '포지션을 찾을 수 없습니다.'; end if;
  if not public._contest_live(pos.contest_id) then raise exception 'The contest is not running, so contest positions cannot be changed.'; end if;
  select * into mark from public.paper_prices where symbol = pos.symbol;
  if not found then raise exception '시세가 없습니다.'; end if;

  if (p_tp is not null and p_tp <= 0) or (p_sl is not null and p_sl <= 0) then raise exception '가격이 올바르지 않습니다.'; end if;

  if pos.side = 'long' then
    if p_tp is not null and p_tp <= mark.price then raise exception '롱 익절가는 현재가보다 높아야 합니다.'; end if;
    if p_sl is not null and p_sl >= mark.price then raise exception '롱 손절가는 현재가보다 낮아야 합니다. (진입가 위로는 올릴 수 있어요)'; end if;
  else
    if p_tp is not null and p_tp >= mark.price then raise exception '숏 익절가는 현재가보다 낮아야 합니다.'; end if;
    if p_sl is not null and p_sl <= mark.price then raise exception '숏 손절가는 현재가보다 높아야 합니다. (진입가 아래로는 내릴 수 있어요)'; end if;
  end if;

  update public.paper_positions set tp = p_tp, sl = p_sl where id = p_id;
end $$;

-- Reset touches Practice only. Contest accounts cannot be reset.
create or replace function public.paper_reset_account()
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception '로그인이 필요합니다.'; end if;
  delete from public.paper_positions where user_id = uid and contest_id is null;
  delete from public.paper_orders where user_id = uid and contest_id is null and status = 'open';
  insert into public.paper_accounts(user_id) values (uid)
  on conflict (user_id) do update set balance = 10000, reset_count = public.paper_accounts.reset_count + 1;
end $$;

-- The old all-time leaderboard counts Practice trades only.
create or replace function public.paper_leaderboard(p_days int default null, p_min_trades int default 3, p_limit int default 100)
returns table (
  id uuid, nickname text, avatar_url text,
  trades bigint, wins bigint, losses bigint, pnl numeric
)
language sql stable security definer set search_path = public as $$
  select p.id, p.nickname, p.avatar_url,
         count(*) as trades,
         count(*) filter (where t.pnl > 0) as wins,
         count(*) filter (where t.pnl < 0) as losses,
         sum(t.pnl) as pnl
  from public.paper_trades t
  join public.profiles p on p.id = t.user_id
  where t.contest_id is null
    and (p_days is null or t.closed_at > now() - make_interval(days => p_days))
  group by p.id, p.nickname, p.avatar_url
  having count(*) >= greatest(1, p_min_trades)
  order by sum(t.pnl) desc
  limit greatest(1, least(p_limit, 500));
$$;

-- ───────── 8. Tick: prices + fills + liquidations + contest MDD ─────────
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

  -- Limit fills (contest orders only while their round is running)
  for r in
    select o.* from public.paper_orders o join public.paper_prices p on p.symbol = o.symbol
    where o.status = 'open'
      and ((o.side = 'long' and p.price <= o.price) or (o.side = 'short' and p.price >= o.price))
      and public._contest_live(o.contest_id)
    for update of o
  loop
    perform public._paper_open(r.user_id, r.symbol, r.side, r.qty, r.price, r.leverage, r.margin, r.fee, r.tp, r.sl, r.margin_mode, r.contest_id);
    update public.paper_orders set status = 'filled' where id = r.id;
  end loop;

  -- Isolated: liquidation → SL → TP. Cross: SL → TP (liquidation is decided per account below)
  for r in
    select pos.id, pos.side, pos.liq_price, pos.tp, pos.sl, pos.margin_mode, p.price
    from public.paper_positions pos join public.paper_prices p on p.symbol = pos.symbol
    where public._contest_live(pos.contest_id)
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

  -- Limit closes
  for r in
    select co.id, co.position_id, co.price, co.qty
    from public.paper_close_orders co
    join public.paper_positions pos on pos.id = co.position_id
    join public.paper_prices p on p.symbol = pos.symbol
    where co.status = 'open'
      and ((pos.side = 'long' and p.price >= co.price) or (pos.side = 'short' and p.price <= co.price))
      and public._contest_live(pos.contest_id)
    order by co.created_at
  loop
    perform public._paper_close(r.position_id, r.price, 'limit', r.qty);
    update public.paper_close_orders set status = 'filled' where id = r.id;
  end loop;

  -- Cross liquidation, per account (user × Practice/round)
  for r in
    select pos.user_id, pos.contest_id
      from public.paper_positions pos
      join public.paper_prices p on p.symbol = pos.symbol
     where pos.margin_mode = 'cross' and public._contest_live(pos.contest_id)
     group by pos.user_id, pos.contest_id
    having public._paper_balance(pos.user_id, pos.contest_id)
           + sum(pos.margin + (p.price - pos.entry_price) * pos.qty * (case when pos.side = 'long' then 1 else -1 end))
           <= sum(pos.qty * p.price * 0.005)
  loop
    perform public._paper_liquidate_cross(r.user_id, r.contest_id);
  end loop;

  for r in select distinct user_id, contest_id from public.paper_positions
            where margin_mode = 'cross' and public._contest_live(contest_id) loop
    perform public._paper_refresh_cross_liq(r.user_id, r.contest_id);
  end loop;

  -- Contest equity tracking: running peak and max drawdown for every running round
  with e as (
    select a.contest_id, a.user_id, public._contest_equity(a.contest_id, a.user_id) as eq
      from public.contest_accounts a join public.contests c on c.id = a.contest_id
     where now() >= c.starts_at and now() < c.ends_at
  )
  update public.contest_accounts a
     set peak_equity = greatest(a.peak_equity, e.eq),
         max_dd_pct  = greatest(a.max_dd_pct,
                         case when greatest(a.peak_equity, e.eq) > 0
                              then (greatest(a.peak_equity, e.eq) - e.eq) / greatest(a.peak_equity, e.eq) * 100 else 0 end)
    from e
   where a.contest_id = e.contest_id and a.user_id = e.user_id;

  -- Freeze the final equity once, right after a round ends
  update public.contest_accounts a
     set final_equity = public._contest_equity(a.contest_id, a.user_id)
    from public.contests c
   where c.id = a.contest_id and now() >= c.ends_at and a.final_equity is null;
end $$;
revoke all on function public.paper_tick(text, jsonb) from public, anon, authenticated;
grant execute on function public.paper_tick(text, jsonb) to anon, authenticated;

-- ───────── 9. Season sign-up ─────────
-- The round people can join / are playing now: the featured one if not ended, else the soonest not ended.
create or replace function public._contest_current()
returns public.contests language sql stable security definer set search_path = public as $$
  select c.* from public.contests c
   where c.ends_at > now()
   order by c.featured desc, c.starts_at
   limit 1;
$$;

create or replace function public.contest_join(p_contest bigint)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  c public.contests%rowtype;
  inv uuid;
  added int;
begin
  if uid is null then raise exception '로그인이 필요합니다.'; end if;
  if not public.is_active_user() then raise exception 'Your account is restricted.'; end if;
  select * into c from public.contests where id = p_contest;
  if not found then raise exception 'Season not found.'; end if;
  if exists (select 1 from public.participants where contest_id = p_contest and user_id = uid) then return false; end if;
  if now() >= coalesce(c.registration_ends_at, c.starts_at) then raise exception 'Registration for this season is closed.'; end if;

  insert into public.participants(contest_id, user_id, nickname)
  select p_contest, uid, p.nickname from public.profiles p where p.id = uid
  on conflict do nothing;
  get diagnostics added = row_count;
  if added = 0 then return false; end if;

  -- Referral bonus for accounts that are already funded (only when registration stays open after the start)
  select inviter into inv from public.referrals where invitee = uid;
  if inv is not null then
    perform public._contest_grant_bonus(p_contest, uid);
    perform public._contest_grant_bonus(p_contest, inv);
  end if;
  return true;
end $$;

create or replace function public.contest_join_current()
returns boolean language plpgsql security definer set search_path = public as $$
declare c public.contests%rowtype;
begin
  c := public._contest_current();
  if c.id is null then raise exception 'No season is open.'; end if;
  return public.contest_join(c.id);
end $$;

revoke all on function public._contest_current() from public, anon, authenticated;
revoke all on function public.contest_join(bigint), public.contest_join_current() from public, anon;
grant execute on function public.contest_join(bigint), public.contest_join_current() to authenticated;

-- ───────── 10. Referral codes ─────────
create or replace function public.referral_my_code()
returns text language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  c text;
  tries int := 0;
begin
  if uid is null then raise exception '로그인이 필요합니다.'; end if;
  select code into c from public.referral_codes where user_id = uid;
  if found then return c; end if;
  loop
    c := substr(md5(gen_random_uuid()::text), 1, 8);
    begin
      insert into public.referral_codes(user_id, code) values (uid, c);
      return c;
    exception when unique_violation then
      select code into c from public.referral_codes where user_id = uid;
      if found then return c; end if;
      tries := tries + 1;
      if tries > 5 then raise; end if;
    end;
  end loop;
end $$;

-- Link the signed-in user to the inviter behind p_code. Only for accounts created in the last 24 hours,
-- never yourself, and only once (the first link wins).
create or replace function public.referral_claim(p_code text)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  inv uuid;
begin
  if uid is null then return false; end if;
  if exists (select 1 from public.referrals where invitee = uid) then return false; end if;
  if not exists (select 1 from public.profiles where id = uid and created_at > now() - interval '24 hours') then return false; end if;
  select user_id into inv from public.referral_codes where code = p_code;
  if inv is null or inv = uid then return false; end if;
  insert into public.referrals(invitee, inviter, code) values (uid, inv, p_code) on conflict do nothing;
  return found;
end $$;

revoke all on function public.referral_my_code(), public.referral_claim(text) from public, anon;
grant execute on function public.referral_my_code(), public.referral_claim(text) to authenticated;

-- ───────── 11. Public reads ─────────
create or replace function public.contest_participant_count(p_contest bigint)
returns int language sql stable security definer set search_path = public as $$
  select count(*)::int from public.participants where contest_id = p_contest;
$$;

-- Most recent sign-ups (shown before the round starts). Nicknames and avatars only.
create or replace function public.contest_recent_participants(p_contest bigint, p_limit int default 5)
returns table (nickname text, avatar_url text, joined_at timestamptz)
language sql stable security definer set search_path = public as $$
  select coalesce(pr.nickname, p.nickname), pr.avatar_url, p.joined_at
    from public.participants p left join public.profiles pr on pr.id = p.user_id
   where p.contest_id = p_contest
   order by p.joined_at desc
   limit greatest(1, least(p_limit, 200));
$$;

grant execute on function public.contest_participant_count(bigint), public.contest_recent_participants(bigint, int) to anon, authenticated;

-- The signed-in user's status in a round (creates the contest account once the round has started).
create or replace function public.contest_me(p_contest bigint)
returns table (joined boolean, funded boolean, start_balance numeric, balance numeric, equity numeric,
               return_pct numeric, mdd_pct numeric, bonus boolean, rank int, invited int)
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  c public.contests%rowtype;
  a public.contest_accounts%rowtype;
  q boolean; eq numeric; rk int; n int;
begin
  if uid is null then return; end if;
  select * into c from public.contests where id = p_contest;
  if not found then return; end if;
  select count(*)::int into n from public.referrals r
    join public.participants p on p.contest_id = p_contest and p.user_id = r.invitee
   where r.inviter = uid;

  if not exists (select 1 from public.participants where contest_id = p_contest and user_id = uid) then
    return query select false, false, c.starting_balance, null::numeric, null::numeric, null::numeric, null::numeric, false, null::int, n;
    return;
  end if;

  if now() < c.starts_at then
    q := public._contest_referral_qualifies(p_contest, uid);
    return query select true, false, c.starting_balance * (1 + case when q then c.referral_bonus_pct / 100 else 0 end),
                        null::numeric, null::numeric, null::numeric, null::numeric, q, null::int, n;
    return;
  end if;

  a := public._contest_ensure_account(p_contest, uid);
  eq := coalesce(a.final_equity, public._contest_equity(p_contest, uid));
  select l.rank into rk from public.contest_leaderboard(p_contest) l where l.user_id = uid;
  return query select true, true, a.start_balance, a.balance, eq,
                      (eq - a.start_balance) / a.start_balance * 100,
                      greatest(a.max_dd_pct, case when greatest(a.peak_equity, eq) > 0 then (greatest(a.peak_equity, eq) - eq) / greatest(a.peak_equity, eq) * 100 else 0 end),
                      a.bonus_applied, rk, n;
end $$;
revoke all on function public.contest_me(bigint) from public, anon;
grant execute on function public.contest_me(bigint) to authenticated;

-- ───────── 12. Snapshot job (called by /api/contests/snapshot with the tick secret) ─────────
-- Raw numbers per participant; ranking happens in src/lib/contests/snapshot.ts (buildRows / rankBy).
create or replace function public.contest_snapshot_stats(p_secret text, p_contest bigint)
returns table (user_id uuid, nickname text, start_balance numeric, equity numeric, return_pct numeric,
               mdd_pct numeric, trades_count int, dq_reason text)
language plpgsql security definer set search_path = public as $$
declare
  c public.contests%rowtype;
  r record;
begin
  if p_secret is null or p_secret is distinct from (select value from public.paper_config where key = 'tick_secret') then
    raise exception 'forbidden';
  end if;
  select * into c from public.contests where id = p_contest;
  if not found or now() < c.starts_at then return; end if;

  -- Everyone who signed up is on the board, even without a trade yet.
  for r in select p.user_id from public.participants p where p.contest_id = p_contest loop
    perform public._contest_ensure_account(p_contest, r.user_id);
  end loop;

  return query
    with x as (
      select a.user_id, a.start_balance, a.peak_equity, a.max_dd_pct,
             coalesce(a.final_equity, public._contest_equity(p_contest, a.user_id)) as eq
        from public.contest_accounts a where a.contest_id = p_contest
    )
    select x.user_id, p.nickname, x.start_balance, x.eq,
           (x.eq - x.start_balance) / x.start_balance * 100,
           greatest(x.max_dd_pct, case when greatest(x.peak_equity, x.eq) > 0 then (greatest(x.peak_equity, x.eq) - x.eq) / greatest(x.peak_equity, x.eq) * 100 else 0 end),
           (select count(*)::int from public.paper_trades t
             where t.user_id = x.user_id and t.contest_id = p_contest and t.closed_at >= c.starts_at and t.closed_at <= c.ends_at),
           case when p.status = 'disqualified' then coalesce(p.dq_reason, 'Disqualified') end
      from x join public.participants p on p.contest_id = p_contest and p.user_id = x.user_id;
end $$;

create or replace function public.contest_write_snapshot(p_secret text, p_contest bigint, p_at timestamptz, p_rows jsonb)
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if p_secret is null or p_secret is distinct from (select value from public.paper_config where key = 'tick_secret') then
    raise exception 'forbidden';
  end if;
  insert into public.ranking_snapshots(contest_id, user_id, snapshot_at, rank, return_pct, mdd_pct, trades_count, qualified, disqualified, dq_reason)
  select p_contest, x.user_id, p_at, x.rank, x.return_pct, x.mdd_pct, x.trades_count, x.qualified, x.disqualified, x.dq_reason
    from jsonb_to_recordset(p_rows) as x(user_id uuid, rank int, return_pct numeric, mdd_pct numeric, trades_count int,
                                         qualified boolean, disqualified boolean, dq_reason text)
    join public.participants p on p.contest_id = p_contest and p.user_id = x.user_id
  on conflict (contest_id, user_id, snapshot_at) do update
     set rank = excluded.rank, return_pct = excluded.return_pct, mdd_pct = excluded.mdd_pct, trades_count = excluded.trades_count,
         qualified = excluded.qualified, disqualified = excluded.disqualified, dq_reason = excluded.dq_reason;
  get diagnostics n = row_count;
  return n;
end $$;

revoke all on function public.contest_snapshot_stats(text, bigint), public.contest_write_snapshot(text, bigint, timestamptz, jsonb) from public;
grant execute on function public.contest_snapshot_stats(text, bigint), public.contest_write_snapshot(text, bigint, timestamptz, jsonb) to anon, authenticated;

-- ───────── 13. Season 1 ─────────
insert into public.contests (number, name, starts_at, ends_at, registration_ends_at, prize_1, prize_2, prize_3,
                             starting_balance, min_trades, mdd_limit, freeze_last_24h, featured, max_leverage, referral_bonus_pct)
select (select coalesce(max(number), 0) + 1 from public.contests), 'FinTalk Season 1',
       '2026-12-01 00:00:00+00', '2027-01-01 00:00:00+00', '2026-12-01 00:00:00+00',
       100, 0, 0, 10000, 1, 100, false, false, 20, 10
 where not exists (select 1 from public.contests where name = 'FinTalk Season 1');

update public.contests set featured = false where featured and name <> 'FinTalk Season 1';
update public.contests set featured = true  where name = 'FinTalk Season 1' and not featured;
