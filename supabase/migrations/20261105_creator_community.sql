-- ============================================================================
-- FinTalk 개편 마이그레이션 #1: 게시글 유형 / 질문 답변 채택 / 임시 저장 / 이해관계 표시 / 관심 분야
-- 사전 조건: supabase/schema.sql 이 이미 실행되어 있어야 합니다.
-- 기존 회원·게시글·댓글은 삭제하지 않으며, 여러 번 실행해도 안전합니다 (idempotent).
-- ⚠️ 코드를 배포하기 "전에" 먼저 실행하세요. (새 컬럼을 조회하는 코드가 배포됩니다)
-- ============================================================================

-- ───────── 1. posts: 유형 · 채택 답변 · 협찬 표시 · 임시 저장 ─────────
alter table public.posts add column if not exists post_type text not null default 'general';
alter table public.posts drop constraint if exists posts_post_type_check;
alter table public.posts add constraint posts_post_type_check
  check (post_type in ('general','question','discussion','analysis','strategy','review','resource'));

alter table public.posts add column if not exists accepted_comment_id uuid references public.comments(id) on delete set null;
alter table public.posts add column if not exists is_sponsored boolean not null default false;

alter table public.posts drop constraint if exists posts_status_check;
alter table public.posts add constraint posts_status_check check (status in ('published','hidden','draft'));

create index if not exists posts_type_idx on public.posts (post_type, created_at desc);

-- 기존 글 변환 (이전 카테고리 → 새 유형). 카테고리 자체는 유지합니다.
update public.posts set post_type = 'question' where category_slug = 'qna'      and post_type = 'general';
update public.posts set post_type = 'strategy' where category_slug = 'strategy' and post_type = 'general';

-- ───────── 2. 카테고리: 새 구조 추가 (기존 slug 는 삭제하지 않음) ─────────
insert into public.categories (slug, label, sort_order) values
  ('kr-stock','국내 주식',1), ('us-stock','미국 주식',2), ('crypto','암호화폐',3),
  ('macro','거시경제',4), ('trading','트레이딩',5), ('beginner','투자 입문',6), ('free','자유 토론',7),
  ('strategy','투자 전략 (이전)',90), ('qna','질문 및 답변 (이전)',91)
on conflict (slug) do update set label = excluded.label, sort_order = excluded.sort_order;

-- ───────── 3. 정책: 작성자는 자신의 임시 저장/게시 글을 수정 가능 ─────────
drop policy if exists "posts_update" on public.posts;
create policy "posts_update" on public.posts for update to authenticated
  using (author_id = auth.uid() and status in ('published','draft') and public.is_active_user())
  with check (author_id = auth.uid() and status in ('published','draft'));

revoke update on public.posts from authenticated;
grant  update (title, body, category_slug, tickers, image_urls, updated_at, post_type, is_sponsored, status)
  on public.posts to authenticated;

-- ───────── 4. 답변 채택 (질문 작성자만) ─────────
create or replace function public.accept_answer(p_post uuid, p_comment uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_active_user() then
    raise exception '이용이 제한된 계정입니다.' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.posts where id = p_post and author_id = auth.uid() and post_type = 'question') then
    raise exception '질문 작성자만 답변을 채택할 수 있습니다.' using errcode = 'P0001';
  end if;
  if p_comment is not null and not exists (
    select 1 from public.comments c
    where c.id = p_comment and c.post_id = p_post and c.author_id <> auth.uid() and c.status = 'published'
  ) then
    raise exception '채택할 수 없는 답변입니다. (본인 댓글은 채택할 수 없습니다)' using errcode = 'P0001';
  end if;
  update public.posts set accepted_comment_id = p_comment where id = p_post;
end $$;
revoke all on function public.accept_answer(uuid, uuid) from public, anon;
grant execute on function public.accept_answer(uuid, uuid) to authenticated;

-- ───────── 5. 프로필: 관심 투자 분야 ─────────
alter table public.profiles add column if not exists interests text[] not null default '{}';
alter table public.profiles drop constraint if exists profiles_interests_check;
alter table public.profiles add constraint profiles_interests_check check (cardinality(interests) <= 5);
-- (profiles 의 update 권한은 schema.sql 의 컬럼 단위 grant 를 따릅니다: interests 를 추가로 허용)
grant update (interests) on public.profiles to authenticated;

-- ───────── 6. 크리에이터 지표 뷰 (기여도 계산의 원천 데이터) ─────────
-- 조회수는 현재 "게시글 누적 조회수"이며, 중복·부정 조회 제거(유효 조회수)는 이후 단계에서 보강합니다.
-- 컬럼 구성이 달라진 뷰는 create or replace 로 바꿀 수 없어서(42P16) 먼저 삭제 후 다시 만듭니다.
drop view if exists public.creator_stats;
create view public.creator_stats with (security_invoker = true) as
select
  pr.id,
  pr.nickname,
  pr.bio,
  pr.avatar_url,
  pr.interests,
  pr.created_at,
  coalesce(p.posts, 0)    as posts,
  coalesce(p.insights, 0) as insights,
  coalesce(p.views, 0)    as views,
  coalesce(p.upvotes, 0)  as upvotes,
  coalesce(c.answers, 0)  as answers,
  coalesce(a.accepted, 0) as accepted,
  (select count(*) from public.follows f where f.followee_id = pr.id) as followers,
  (select count(*) from public.follows f where f.follower_id = pr.id) as following
from public.profiles pr
left join (
  select author_id,
         count(*) as posts,
         count(*) filter (where post_type in ('analysis','strategy','review','resource')) as insights,
         sum(views) as views,
         sum(upvotes) as upvotes
  from public.posts where status = 'published' group by author_id
) p on p.author_id = pr.id
left join (
  select author_id, count(*) as answers
  from public.comments where status = 'published' group by author_id
) c on c.author_id = pr.id
left join (
  select cm.author_id, count(*) as accepted
  from public.posts po join public.comments cm on cm.id = po.accepted_comment_id
  group by cm.author_id
) a on a.author_id = pr.id
where pr.status = 'active';

grant select on public.creator_stats to anon, authenticated;
