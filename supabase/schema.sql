-- ============================================================================
-- FinTalk Phase 2 schema  (Supabase SQL Editor 에 통째로 붙여넣어 1회 실행)
-- 여러 번 실행해도 안전하도록 작성되었습니다 (idempotent).
-- ============================================================================

-- ───────── 1. 테이블 ─────────

create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  nickname    text not null unique check (char_length(nickname) between 2 and 20),
  bio         text not null default '' check (char_length(bio) <= 200),
  avatar_url  text,
  role        text not null default 'user'   check (role in ('user','admin')),
  status      text not null default 'active' check (status in ('active','suspended')),
  notify_comment boolean not null default true,
  notify_vote    boolean not null default true,
  notify_follow  boolean not null default true,
  created_at  timestamptz not null default now()
);

create table if not exists public.categories (
  slug        text primary key,
  label       text not null,
  sort_order  int  not null default 0
);

create table if not exists public.posts (
  id            uuid primary key default gen_random_uuid(),
  author_id     uuid not null references public.profiles(id) on delete cascade,
  category_slug text not null references public.categories(slug),
  title         text not null check (char_length(title) between 2 and 100),
  body          text not null check (char_length(body) between 2 and 20000),
  tickers       text[] not null default '{}' check (cardinality(tickers) <= 5),
  image_urls    text[] not null default '{}' check (cardinality(image_urls) <= 5),
  status        text not null default 'published' check (status in ('published','hidden')),
  pinned        boolean not null default false,
  views         int not null default 0,
  upvotes       int not null default 0,
  downvotes     int not null default 0,
  comment_count int not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists posts_created_idx  on public.posts (created_at desc);
create index if not exists posts_category_idx on public.posts (category_slug, created_at desc);
create index if not exists posts_author_idx   on public.posts (author_id);

create table if not exists public.comments (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.posts(id) on delete cascade,
  author_id  uuid not null references public.profiles(id) on delete cascade,
  parent_id  uuid references public.comments(id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 1000),
  status     text not null default 'published' check (status in ('published','hidden')),
  created_at timestamptz not null default now()
);
create index if not exists comments_post_idx on public.comments (post_id, created_at);

-- 같은 사용자의 반복 추천 방지: (user, post) 당 1행
create table if not exists public.post_votes (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  post_id    uuid not null references public.posts(id) on delete cascade,
  value      smallint not null check (value in (-1, 1)),
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);

create table if not exists public.saved_posts (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  post_id    uuid not null references public.posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);

create table if not exists public.follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  followee_id uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);

create table if not exists public.watchlist (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  symbol     text not null check (char_length(symbol) <= 20),
  created_at timestamptz not null default now(),
  primary key (user_id, symbol)
);

create table if not exists public.reports (
  id          uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  target_type text not null check (target_type in ('post','comment')),
  target_id   uuid not null,
  reason      text not null check (char_length(reason) between 2 and 300),
  status      text not null default 'pending' check (status in ('pending','resolved','dismissed')),
  created_at  timestamptz not null default now(),
  unique (reporter_id, target_type, target_id)
);

-- ───────── 2. 헬퍼 함수 ─────────

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function public.is_active_user()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and status = 'active');
$$;

-- 회원가입 시 프로필 자동 생성 (닉네임 중복 시 접미사 부여)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  base text;
  nick text;
begin
  base := coalesce(nullif(trim(new.raw_user_meta_data->>'nickname'), ''),
                   split_part(new.email, '@', 1), 'user');
  base := left(regexp_replace(base, '[^0-9A-Za-z가-힣_]', '', 'g'), 14);
  if char_length(base) < 2 then base := 'user'; end if;
  nick := base;
  while exists (select 1 from public.profiles where nickname = nick) loop
    nick := base || floor(random() * 9000 + 1000)::int;
  end loop;
  insert into public.profiles (id, nickname, avatar_url)
  values (new.id, nick, new.raw_user_meta_data->>'avatar_url');
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users for each row execute function public.handle_new_user();

-- role / status 는 일반 사용자가 바꿀 수 없음 (관리자 또는 서버(service role)만)
create or replace function public.protect_profile_columns()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    new.role   := old.role;
    new.status := old.status;
    new.id     := old.id;
  end if;
  return new;
end $$;
drop trigger if exists protect_profile_columns on public.profiles;
create trigger protect_profile_columns
  before update on public.profiles for each row execute function public.protect_profile_columns();

-- 추천 수 집계 (트리거에서만 갱신)
create or replace function public.sync_post_votes()
returns trigger language plpgsql security definer set search_path = public as $$
declare pid uuid := coalesce(new.post_id, old.post_id);
begin
  update public.posts p set
    upvotes   = (select count(*) from public.post_votes v where v.post_id = pid and v.value = 1),
    downvotes = (select count(*) from public.post_votes v where v.post_id = pid and v.value = -1)
  where p.id = pid;
  return null;
end $$;
drop trigger if exists sync_post_votes on public.post_votes;
create trigger sync_post_votes
  after insert or update or delete on public.post_votes for each row execute function public.sync_post_votes();

-- 댓글 수 집계
create or replace function public.sync_comment_count()
returns trigger language plpgsql security definer set search_path = public as $$
declare pid uuid := coalesce(new.post_id, old.post_id);
begin
  update public.posts p set
    comment_count = (select count(*) from public.comments c where c.post_id = pid and c.status = 'published')
  where p.id = pid;
  return null;
end $$;
drop trigger if exists sync_comment_count on public.comments;
create trigger sync_comment_count
  after insert or update or delete on public.comments for each row execute function public.sync_comment_count();

-- 비정상 활동 방지: 시간당 작성 한도 (관리자 제외)
create or replace function public.rate_limit_posts()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() and
     (select count(*) from public.posts where author_id = new.author_id and created_at > now() - interval '1 hour') >= 10 then
    raise exception '게시글은 1시간에 10개까지 작성할 수 있습니다.' using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists rate_limit_posts on public.posts;
create trigger rate_limit_posts before insert on public.posts for each row execute function public.rate_limit_posts();

create or replace function public.rate_limit_comments()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() and
     (select count(*) from public.comments where author_id = new.author_id and created_at > now() - interval '1 hour') >= 60 then
    raise exception '댓글은 1시간에 60개까지 작성할 수 있습니다.' using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists rate_limit_comments on public.comments;
create trigger rate_limit_comments before insert on public.comments for each row execute function public.rate_limit_comments();

-- 조회수 증가 (RLS 를 우회하지 않고 이 함수로만 증가)
create or replace function public.increment_post_views(p_id uuid)
returns void language sql security definer set search_path = public as $$
  update public.posts set views = views + 1 where id = p_id and status = 'published';
$$;

-- 관리자 전용: 게시글/댓글 숨김·복구, 신고 처리, 이용 제한
create or replace function public.admin_set_post_status(p_id uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.posts set status = p_status where id = p_id;
end $$;

create or replace function public.admin_set_comment_status(p_id uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.comments set status = p_status where id = p_id;
end $$;

create or replace function public.admin_set_report_status(p_id uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.reports set status = p_status where id = p_id;
end $$;

create or replace function public.admin_set_user_status(p_id uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.profiles set status = p_status where id = p_id and role <> 'admin';
end $$;

-- 회원 탈퇴: 본인 계정 삭제 (profiles 및 하위 데이터는 cascade 로 삭제)
create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = public, auth as $$
begin
  if auth.uid() is null then raise exception 'unauthenticated' using errcode = '42501'; end if;
  delete from auth.users where id = auth.uid();
end $$;

-- 함수 실행 권한: 익명 호출 차단
revoke execute on all functions in schema public from public, anon;
grant execute on function public.is_admin(), public.is_active_user(),
  public.increment_post_views(uuid), public.delete_my_account(),
  public.admin_set_post_status(uuid, text), public.admin_set_comment_status(uuid, text),
  public.admin_set_report_status(uuid, text), public.admin_set_user_status(uuid, text)
  to authenticated;
-- 조회수는 비로그인 방문자도 올릴 수 있어야 하므로 anon 허용
grant execute on function public.increment_post_views(uuid) to anon;
-- RLS 정책 평가용 (정책 안에서 호출됨)
grant execute on function public.is_admin(), public.is_active_user() to anon;

-- ───────── 3. RLS ─────────

alter table public.profiles    enable row level security;
alter table public.categories  enable row level security;
alter table public.posts       enable row level security;
alter table public.comments    enable row level security;
alter table public.post_votes  enable row level security;
alter table public.saved_posts enable row level security;
alter table public.follows     enable row level security;
alter table public.watchlist   enable row level security;
alter table public.reports     enable row level security;

-- profiles
drop policy if exists "profiles_read"   on public.profiles;
drop policy if exists "profiles_update" on public.profiles;
create policy "profiles_read"   on public.profiles for select using (true);
create policy "profiles_update" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- categories
drop policy if exists "categories_read"  on public.categories;
drop policy if exists "categories_admin" on public.categories;
create policy "categories_read"  on public.categories for select using (true);
create policy "categories_admin" on public.categories for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- posts
drop policy if exists "posts_read"   on public.posts;
drop policy if exists "posts_insert" on public.posts;
drop policy if exists "posts_update" on public.posts;
drop policy if exists "posts_delete" on public.posts;
create policy "posts_read" on public.posts for select
  using (status = 'published' or author_id = auth.uid() or public.is_admin());
create policy "posts_insert" on public.posts for insert to authenticated
  with check (author_id = auth.uid() and public.is_active_user());
create policy "posts_update" on public.posts for update to authenticated
  using (author_id = auth.uid() and status = 'published' and public.is_active_user())
  with check (author_id = auth.uid());
create policy "posts_delete" on public.posts for delete to authenticated
  using (author_id = auth.uid() or public.is_admin());
-- 작성자는 아래 컬럼만 수정 가능 (카운터·상태·고정 여부 변경 불가)
revoke update on public.posts from authenticated;
grant  update (title, body, category_slug, tickers, image_urls, updated_at) on public.posts to authenticated;

-- comments
drop policy if exists "comments_read"   on public.comments;
drop policy if exists "comments_insert" on public.comments;
drop policy if exists "comments_delete" on public.comments;
create policy "comments_read" on public.comments for select
  using (status = 'published' or author_id = auth.uid() or public.is_admin());
create policy "comments_insert" on public.comments for insert to authenticated
  with check (author_id = auth.uid() and public.is_active_user());
create policy "comments_delete" on public.comments for delete to authenticated
  using (author_id = auth.uid() or public.is_admin());

-- post_votes (본인 것만)
drop policy if exists "votes_own_read"   on public.post_votes;
drop policy if exists "votes_own_write"  on public.post_votes;
drop policy if exists "votes_own_update" on public.post_votes;
drop policy if exists "votes_own_delete" on public.post_votes;
create policy "votes_own_read"   on public.post_votes for select to authenticated using (user_id = auth.uid());
create policy "votes_own_write"  on public.post_votes for insert to authenticated
  with check (user_id = auth.uid() and public.is_active_user());
create policy "votes_own_update" on public.post_votes for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "votes_own_delete" on public.post_votes for delete to authenticated using (user_id = auth.uid());

-- saved_posts / watchlist (본인 것만)
drop policy if exists "saved_own"     on public.saved_posts;
drop policy if exists "watchlist_own" on public.watchlist;
create policy "saved_own"     on public.saved_posts for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "watchlist_own" on public.watchlist for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- follows
drop policy if exists "follows_read"   on public.follows;
drop policy if exists "follows_write"  on public.follows;
drop policy if exists "follows_delete" on public.follows;
create policy "follows_read"   on public.follows for select using (true);
create policy "follows_write"  on public.follows for insert to authenticated with check (follower_id = auth.uid());
create policy "follows_delete" on public.follows for delete to authenticated using (follower_id = auth.uid());

-- reports (신고자 본인과 관리자만 조회)
drop policy if exists "reports_insert" on public.reports;
drop policy if exists "reports_read"   on public.reports;
create policy "reports_insert" on public.reports for insert to authenticated
  with check (reporter_id = auth.uid() and public.is_active_user());
create policy "reports_read"   on public.reports for select to authenticated
  using (reporter_id = auth.uid() or public.is_admin());

-- ───────── 4. 스토리지 (게시글 이미지) ─────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('post-images', 'post-images', true, 5242880, array['image/png','image/jpeg','image/webp','image/gif'])
on conflict (id) do update set file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "post_images_read"   on storage.objects;
drop policy if exists "post_images_upload" on storage.objects;
drop policy if exists "post_images_delete" on storage.objects;
create policy "post_images_read"   on storage.objects for select using (bucket_id = 'post-images');
create policy "post_images_upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'post-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "post_images_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'post-images' and (storage.foldername(name))[1] = auth.uid()::text);

-- ───────── 5. 기본 데이터 ─────────
insert into public.categories (slug, label, sort_order) values
  ('free','자유게시판',1), ('kr-stock','국내 주식',2), ('us-stock','해외 주식',3),
  ('crypto','암호화폐',4), ('macro','거시경제',5), ('strategy','투자 전략',6), ('qna','질문 및 답변',7)
on conflict (slug) do update set label = excluded.label, sort_order = excluded.sort_order;

-- ───────── 6. 관리자 지정 (가입 후 본인 이메일로 1회 실행) ─────────
-- update public.profiles set role = 'admin'
--   where id = (select id from auth.users where email = 'your-email@example.com');
