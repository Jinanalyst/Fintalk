-- ============================================================================
-- Trading contest: entries (OKX UID verification + country of residence).
--   · One entry per user, and one OKX UID per entry (unique).
--   · Users submit through contest_submit_entry(); admins review with admin_set_contest_entry().
--   · Safe to run multiple times.
-- ============================================================================

create table if not exists public.contest_entries (
  user_id     uuid primary key references public.profiles(id) on delete cascade,
  okx_uid     text not null unique check (okx_uid ~ '^[0-9]{6,20}$'),
  country     text not null check (country ~ '^[A-Z]{2}$'),
  status      text not null default 'pending' check (status in ('pending','verified','rejected')),
  note        text,
  created_at  timestamptz not null default now(),
  reviewed_at timestamptz
);

-- Audit log of blocked / rejected attempts (readable by admins only).
create table if not exists public.contest_audit (
  id         bigint generated always as identity primary key,
  user_id    uuid references public.profiles(id) on delete set null,
  kind       text not null,
  country    text,
  detail     text,
  created_at timestamptz not null default now()
);

alter table public.contest_entries enable row level security;
alter table public.contest_audit   enable row level security;

drop policy if exists "contest_entries_read" on public.contest_entries;
create policy "contest_entries_read" on public.contest_entries for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists "contest_audit_read" on public.contest_audit;
create policy "contest_audit_read" on public.contest_audit for select to authenticated
  using (public.is_admin());

-- Submit (or re-submit while pending/rejected) an entry.
create or replace function public.contest_submit_entry(p_uid text, p_country text)
returns void language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  cur public.contest_entries%rowtype;
begin
  if uid is null then raise exception 'Please log in first.'; end if;
  if not public.is_active_user() then raise exception 'Your account is restricted.'; end if;
  p_uid := btrim(p_uid);
  p_country := upper(btrim(p_country));
  if p_uid !~ '^[0-9]{6,20}$' then raise exception 'Enter a valid OKX UID (6-20 digits).'; end if;
  if p_country !~ '^[A-Z]{2}$' then raise exception 'Select your country of residence.'; end if;
  -- Country restrictions are enforced here too (keep in sync with src/lib/contest.ts).
  if p_country in ('KR','US') then
    insert into public.contest_audit(user_id, kind, country, detail) values (uid, 'blocked_country', p_country, 'entry rejected');
    raise exception 'Residents of your country are not eligible for this contest.';
  end if;

  select * into cur from public.contest_entries where user_id = uid for update;
  if found and cur.status = 'verified' then raise exception 'Your entry is already verified.'; end if;
  if exists (select 1 from public.contest_entries where okx_uid = p_uid and user_id <> uid) then
    raise exception 'This OKX UID is already registered.';
  end if;

  insert into public.contest_entries(user_id, okx_uid, country, status)
  values (uid, p_uid, p_country, 'pending')
  on conflict (user_id) do update
    set okx_uid = excluded.okx_uid, country = excluded.country, status = 'pending', note = null, reviewed_at = null;
end $$;

-- Admin review.
create or replace function public.admin_set_contest_entry(p_user uuid, p_status text, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_status not in ('pending','verified','rejected') then raise exception 'Invalid status.'; end if;
  update public.contest_entries
     set status = p_status, note = p_note, reviewed_at = now()
   where user_id = p_user;
end $$;

-- Record a geo-blocked visit (called by the server with the user's session; user_id may be null).
create or replace function public.contest_log_block(p_country text, p_detail text)
returns void language sql security definer set search_path = public as $$
  insert into public.contest_audit(user_id, kind, country, detail) values (auth.uid(), 'blocked_ip', left(p_country, 2), left(p_detail, 200));
$$;

revoke all on function public.contest_submit_entry(text, text) from public, anon;
grant execute on function public.contest_submit_entry(text, text) to authenticated;
revoke all on function public.admin_set_contest_entry(uuid, text, text) from public, anon;
grant execute on function public.admin_set_contest_entry(uuid, text, text) to authenticated;
revoke all on function public.contest_log_block(text, text) from public;
grant execute on function public.contest_log_block(text, text) to anon, authenticated;
