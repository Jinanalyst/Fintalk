-- ============================================================================
-- FinTalk 마이그레이션 #3: 프로필 사진(avatars 버킷) + 알림(댓글/답글)
-- 사전 조건: schema.sql, 20261105_creator_community.sql 실행 완료. 여러 번 실행해도 안전합니다.
-- ============================================================================

-- ───────── 1. 프로필 사진 스토리지 ─────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/png','image/jpeg','image/webp'])
on conflict (id) do update set file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "avatars_read"   on storage.objects;
drop policy if exists "avatars_upload" on storage.objects;
drop policy if exists "avatars_delete" on storage.objects;
create policy "avatars_read"   on storage.objects for select using (bucket_id = 'avatars');
create policy "avatars_upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- ───────── 2. 알림 테이블 ─────────
create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,  -- 받는 사람
  actor_id   uuid references public.profiles(id) on delete set null,          -- 행동한 사람
  actor_name text not null default '',
  type       text not null check (type in ('comment','reply')),
  post_id    uuid references public.posts(id) on delete cascade,
  comment_id uuid references public.comments(id) on delete cascade,
  snippet    text not null default '',
  read       boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;
drop policy if exists "notifications_read"   on public.notifications;
drop policy if exists "notifications_update" on public.notifications;
drop policy if exists "notifications_delete" on public.notifications;
create policy "notifications_read"   on public.notifications for select to authenticated using (user_id = auth.uid());
create policy "notifications_update" on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "notifications_delete" on public.notifications for delete to authenticated using (user_id = auth.uid());
-- 생성은 아래 트리거(security definer)로만 가능. 읽음 표시 외의 컬럼은 수정 불가
revoke insert, update on public.notifications from authenticated, anon;
grant update (read) on public.notifications to authenticated;

-- ───────── 3. 댓글 → 알림 트리거 ─────────
create or replace function public.notify_on_comment()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  post_author uuid;
  parent_author uuid;
  actor text;
  snip text := left(regexp_replace(new.body, '\s+', ' ', 'g'), 80);
begin
  if new.status <> 'published' then return new; end if;
  select author_id into post_author from public.posts where id = new.post_id;
  select nickname into actor from public.profiles where id = new.author_id;

  -- 답글이면 부모 댓글 작성자에게 먼저 알림
  if new.parent_id is not null then
    select author_id into parent_author from public.comments where id = new.parent_id;
    if parent_author is not null and parent_author <> new.author_id
       and coalesce((select notify_comment from public.profiles where id = parent_author), true) then
      insert into public.notifications (user_id, actor_id, actor_name, type, post_id, comment_id, snippet)
      values (parent_author, new.author_id, coalesce(actor, ''), 'reply', new.post_id, new.id, snip);
    end if;
  end if;

  -- 게시글 작성자에게 알림 (본인 댓글이거나 위에서 이미 알린 사람이면 제외)
  if post_author is not null and post_author <> new.author_id and post_author is distinct from parent_author
     and coalesce((select notify_comment from public.profiles where id = post_author), true) then
    insert into public.notifications (user_id, actor_id, actor_name, type, post_id, comment_id, snippet)
    values (post_author, new.author_id, coalesce(actor, ''), 'comment', new.post_id, new.id, snip);
  end if;
  return new;
end $$;

drop trigger if exists notify_on_comment on public.comments;
create trigger notify_on_comment after insert on public.comments
  for each row execute function public.notify_on_comment();

-- ───────── 4. 조회수 실시간 반영 (Realtime) ─────────
do $$ begin
  alter publication supabase_realtime add table public.posts;
exception when duplicate_object then null;
end $$;

-- 인기 종목 토론 실시간 집계용 (댓글 추가 이벤트)
do $$ begin
  alter publication supabase_realtime add table public.comments;
exception when duplicate_object then null;
end $$;
