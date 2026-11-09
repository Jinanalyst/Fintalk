-- ============================================================================
-- 핀톡 기여도 순위: 글·인사이트·답변·채택·추천·조회 + 트레이딩(청산 거래, 공유 카드)
-- 모의투자 거래 기록은 본인만 볼 수 있어서(RLS) 집계 숫자만 이 함수로 공개합니다.
-- 손익·수익률은 노출하지 않고 "활동 횟수"만 반영합니다. 여러 번 실행해도 안전합니다.
-- ============================================================================
create or replace function public.contribution_ranking(p_limit int default 100)
returns table (
  id uuid, nickname text, avatar_url text,
  posts bigint, insights bigint, answers bigint, accepted bigint, upvotes bigint, views bigint,
  trades bigint, shared bigint, week_posts bigint
)
language sql stable security definer set search_path = public as $$
  select cs.id, cs.nickname, cs.avatar_url,
         cs.posts, cs.insights, cs.answers, cs.accepted, cs.upvotes, cs.views,
         coalesce(t.n, 0) as trades,
         coalesce(sh.n, 0) as shared,
         (select count(*) from public.posts po
           where po.author_id = cs.id and po.status = 'published' and po.created_at > now() - interval '7 days') as week_posts
  from public.creator_stats cs
  left join (select user_id, count(*) n from public.paper_trades group by user_id) t on t.user_id = cs.id
  left join (select user_id, count(*) n from public.trade_shares group by user_id) sh on sh.user_id = cs.id
  order by cs.posts + cs.answers + coalesce(t.n, 0) desc
  limit greatest(1, least(p_limit, 500));
$$;
grant execute on function public.contribution_ranking(int) to anon, authenticated;
