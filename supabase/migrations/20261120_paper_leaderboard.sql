-- ============================================================================
-- 모의투자 리더보드: 기간별 실현 손익 순위
-- 거래 기록은 본인만 볼 수 있어서(RLS) 이용자별 합계만 이 함수로 공개합니다.
-- p_days 가 null 이면 전체 기간. 청산된 거래(paper_trades)만 집계합니다.
-- 여러 번 실행해도 안전합니다.
-- ============================================================================
create or replace function public.paper_leaderboard(p_days int default null, p_min_trades int default 3, p_limit int default 100)
returns table (
  id uuid, nickname text, avatar_url text,
  trades bigint, wins bigint, losses bigint, pnl numeric
)
language sql stable security definer set search_path = public as $$
  select p.id, p.nickname, p.avatar_url,
         count(*) as trades,
         count(*) filter (where t.pnl > 0) as wins,
         count(*) filter (where t.pnl < 0) as losses,
         sum(t.pnl) as pnl
  from public.paper_trades t
  join public.profiles p on p.id = t.user_id
  where p_days is null or t.closed_at > now() - make_interval(days => p_days)
  group by p.id, p.nickname, p.avatar_url
  having count(*) >= greatest(1, p_min_trades)
  order by sum(t.pnl) desc
  limit greatest(1, least(p_limit, 500));
$$;
grant execute on function public.paper_leaderboard(int, int, int) to anon, authenticated;
