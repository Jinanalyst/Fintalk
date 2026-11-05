-- ============================================================================
-- FinTalk 개편 마이그레이션 #2: creator_stats 에 "받은 저장 수" 추가 (인기 작성자: 조회수 · 저장 · 좋아요)
-- 사전 조건: 20261105_creator_community.sql 실행 완료. 여러 번 실행해도 안전합니다.
-- 기존 컬럼 순서는 유지하고 saves 를 마지막에 추가합니다. (create or replace view 제약)
-- ============================================================================
create or replace view public.creator_stats with (security_invoker = true) as
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
  (select count(*) from public.follows f where f.follower_id = pr.id) as following,
  coalesce(s.saves, 0)    as saves
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
left join (
  -- 내 게시글이 다른 사람에게 저장된 횟수 (본인 저장 제외)
  select po.author_id, count(*) as saves
  from public.saved_posts sp join public.posts po on po.id = sp.post_id
  where po.status = 'published' and sp.user_id <> po.author_id
  group by po.author_id
) s on s.author_id = pr.id
where pr.status = 'active';

grant select on public.creator_stats to anon, authenticated;
