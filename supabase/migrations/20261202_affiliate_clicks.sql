-- ============================================================================
-- OKX partner banner: click log.
--   · One row per click on /go/okx (placement, visitor country, time, user if signed in).
--   · Nobody can read it except admins; writes only through affiliate_log_click().
--   · Not connected to contest entry, referral bonus or prizes in any way.
--   · Additive only. Safe to run more than once.
-- ============================================================================

create table if not exists public.affiliate_clicks (
  id         bigint generated always as identity primary key,
  placement  text not null check (placement ~ '^[a-z0-9_]{1,32}$'),
  country    text check (country ~ '^[A-Z]{2}$'),
  user_id    uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists affiliate_clicks_time_idx on public.affiliate_clicks (created_at desc);
create index if not exists affiliate_clicks_placement_idx on public.affiliate_clicks (placement, created_at desc);

alter table public.affiliate_clicks enable row level security;
drop policy if exists affiliate_clicks_admin_read on public.affiliate_clicks;
create policy affiliate_clicks_admin_read on public.affiliate_clicks for select to authenticated using (public.is_admin());
revoke insert, update, delete on public.affiliate_clicks from anon, authenticated;

create or replace function public.affiliate_log_click(p_placement text, p_country text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_placement is null or p_placement !~ '^[a-z0-9_]{1,32}$' then return; end if;
  insert into public.affiliate_clicks(placement, country, user_id)
  values (p_placement,
          case when upper(p_country) ~ '^[A-Z]{2}$' then upper(p_country) end,
          auth.uid());
end $$;

revoke all on function public.affiliate_log_click(text, text) from public;
grant execute on function public.affiliate_log_click(text, text) to anon, authenticated;
