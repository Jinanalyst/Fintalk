-- ============================================================================
-- Contest rounds managed from /admin?tab=contest
--   · contests.featured: the round shown in the home-page banner (at most one).
--   · admin_create_contest(): add a new round (number defaults to the next one).
--   · admin_feature_contest(): choose which round the home banner shows.
--   · Safe to run multiple times. Requires 20261124_contests.sql.
-- ============================================================================

alter table public.contests add column if not exists featured boolean not null default false;
create unique index if not exists contests_one_featured on public.contests (featured) where featured;

create or replace function public.admin_create_contest(
  p_name            text,
  p_starts_at       timestamptz,
  p_ends_at         timestamptz,
  p_number          int     default null,
  p_prize_1         numeric default 50,
  p_prize_2         numeric default 30,
  p_prize_3         numeric default 20,
  p_starting_balance numeric default 10000,
  p_min_trades      int     default 10,
  p_mdd_limit       numeric default 70,
  p_freeze_last_24h boolean default true,
  p_featured        boolean default true
)
returns bigint language plpgsql security definer set search_path = public as $$
declare
  n   int;
  new_id bigint;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_ends_at <= p_starts_at then raise exception 'The end must be after the start.'; end if;
  n := coalesce(p_number, (select coalesce(max(number), 0) + 1 from public.contests));
  if exists (select 1 from public.contests where number = n) then raise exception 'Round #% already exists.', n; end if;

  if p_featured then update public.contests set featured = false where featured; end if;

  insert into public.contests (number, name, starts_at, ends_at, prize_1, prize_2, prize_3,
                               starting_balance, min_trades, mdd_limit, freeze_last_24h, featured)
  values (n, coalesce(nullif(trim(p_name), ''), 'FinTalk Trading Championship #' || n), p_starts_at, p_ends_at,
          p_prize_1, p_prize_2, p_prize_3, p_starting_balance, p_min_trades, p_mdd_limit, p_freeze_last_24h, p_featured)
  returning id into new_id;
  return new_id;
end $$;

create or replace function public.admin_feature_contest(p_id bigint)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  if not exists (select 1 from public.contests where id = p_id) then raise exception 'Contest not found.'; end if;
  update public.contests set featured = false where featured and id <> p_id;
  update public.contests set featured = true where id = p_id;
end $$;

grant execute on function public.admin_create_contest(text, timestamptz, timestamptz, int, numeric, numeric, numeric, numeric, int, numeric, boolean, boolean) to authenticated;
grant execute on function public.admin_feature_contest(bigint) to authenticated;
