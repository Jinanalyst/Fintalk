-- Public count of contest sign-ups (pending + verified; rejected entries excluded).
-- contest_entries is not readable by everyone, so expose only the number. Safe to run multiple times.
create or replace function public.contest_registered_count()
returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int from public.contest_entries where status <> 'rejected';
$$;
grant execute on function public.contest_registered_count() to anon, authenticated;
