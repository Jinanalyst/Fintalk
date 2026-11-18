-- ============================================================================
-- Trading contests (multi-round): contests, participants, hourly ranking snapshots.
--   · Rankings are read ONLY through contest_leaderboard(), which enforces the
--     "freeze last 24h" option on the server (the client never receives frozen data).
--   · No positions / trade history are stored here (anti copy-trading).
--   · Safe to run multiple times.
-- ============================================================================

create table if not exists public.contests (
  id               bigint generated always as identity primary key,
  number           int  not null unique,
  name             text not null,
  starts_at        timestamptz not null,
  ends_at          timestamptz not null check (ends_at > starts_at),
  prize_1          numeric not null default 50,
  prize_2          numeric not null default 30,
  prize_3          numeric not null default 20,
  starting_balance numeric not null default 10000,
  min_trades       int  not null default 10,
  mdd_limit        numeric not null default 70,
  freeze_last_24h  boolean not null default false,
  created_at       timestamptz not null default now()
);

create table if not exists public.participants (
  contest_id bigint not null references public.contests(id) on delete cascade,
  user_id    uuid   not null references public.profiles(id) on delete cascade,
  nickname   text   not null,
  joined_at  timestamptz not null default now(),
  status     text   not null default 'active' check (status in ('active','disqualified')),
  dq_reason  text,
  primary key (contest_id, user_id)
);

create table if not exists public.ranking_snapshots (
  contest_id    bigint not null references public.contests(id) on delete cascade,
  user_id       uuid   not null references public.profiles(id) on delete cascade,
  snapshot_at   timestamptz not null,           -- always the top of an hour (UTC)
  rank          int,                            -- null = disqualified
  return_pct    numeric not null,
  mdd_pct       numeric not null,
  trades_count  int not null,
  qualified     boolean not null,
  disqualified  boolean not null default false,
  dq_reason     text,
  primary key (contest_id, user_id, snapshot_at)
);
create index if not exists ranking_snapshots_lookup on public.ranking_snapshots (contest_id, snapshot_at desc, rank);

alter table public.contests          enable row level security;
alter table public.participants      enable row level security;
alter table public.ranking_snapshots enable row level security;

-- Contests are public. Participants / snapshots are NOT directly readable: use contest_leaderboard().
-- Writes happen with the service role (snapshot job) or admin functions only.
drop policy if exists "contests_read" on public.contests;
create policy "contests_read" on public.contests for select using (true);

-- Latest visible snapshot of a contest, with the freeze option enforced here.
create or replace function public.contest_leaderboard(p_contest bigint)
returns table (
  user_id uuid, nickname text, rank int, return_pct numeric, mdd_pct numeric,
  trades_count int, qualified boolean, disqualified boolean, dq_reason text, snapshot_at timestamptz
)
language plpgsql stable security definer set search_path = public as $$
declare
  c public.contests%rowtype;
  cutoff timestamptz;
  snap timestamptz;
begin
  select * into c from public.contests where id = p_contest;
  if not found then return; end if;
  -- While frozen, only snapshots taken up to the freeze moment are visible. After the end: everything.
  cutoff := case when c.freeze_last_24h and now() < c.ends_at then least(now(), c.ends_at - interval '24 hours') else now() end;
  select max(s.snapshot_at) into snap from public.ranking_snapshots s where s.contest_id = p_contest and s.snapshot_at <= cutoff;
  if snap is null then return; end if;
  return query
    select s.user_id, p.nickname, s.rank, s.return_pct, s.mdd_pct, s.trades_count, s.qualified, s.disqualified, s.dq_reason, s.snapshot_at
      from public.ranking_snapshots s join public.participants p on p.contest_id = s.contest_id and p.user_id = s.user_id
     where s.contest_id = p_contest and s.snapshot_at = snap
     order by s.rank nulls last, s.return_pct desc;
end $$;
grant execute on function public.contest_leaderboard(bigint) to anon, authenticated;
