import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { TRENDING_TICKERS, tickerName } from "@/lib/sample-data";

export type TrendingTicker = {
  symbol: string;
  name: string;
  /** 최근 7일 게시글 수 */
  posts: number;
  /** 그 글들에 달린 댓글 수 */
  comments: number;
  /** 최근 24시간 새 글 수 (지금 뜨는 중) */
  fresh: number;
  score: number;
};

const DAY = 864e5;

/**
 * 인기 종목 토론: 최근 7일 글의 종목 태그를 집계합니다.
 * 점수 = 글(3) + 댓글(2) + 추천(1) + 조회(1/20), 오래된 글일수록 반감(36시간 반감기)되어 "지금" 활발한 종목이 위로 옵니다.
 * 데이터가 부족하면 기본 종목으로 채웁니다.
 */
export async function getTrendingTickers(limit = 6): Promise<{ items: TrendingTicker[]; live: boolean }> {
  const fallback = (skip: Set<string>) =>
    TRENDING_TICKERS.filter((s) => !skip.has(s)).map<TrendingTicker>((s) => ({ symbol: s, name: tickerName(s), posts: 0, comments: 0, fresh: 0, score: 0 }));
  if (!isSupabaseConfigured) return { items: fallback(new Set()).slice(0, limit), live: false };

  const sb = await createClient();
  const since = new Date(Date.now() - 7 * DAY).toISOString();
  const { data, error } = await sb
    .from("posts")
    .select("tickers,comment_count,views,upvotes,created_at")
    .eq("status", "published")
    .gte("created_at", since)
    .lte("created_at", new Date().toISOString())
    .limit(500);
  if (error) {
    console.error("[getTrendingTickers]", error.message);
    return { items: fallback(new Set()).slice(0, limit), live: true };
  }

  const map = new Map<string, TrendingTicker>();
  const now = Date.now();
  for (const r of data ?? []) {
    const age = now - new Date(r.created_at as string).getTime();
    const decay = Math.pow(0.5, age / (36 * 3600e3));
    const base = 3 + 2 * Number(r.comment_count ?? 0) + Number(r.upvotes ?? 0) + Number(r.views ?? 0) / 20;
    for (const t of (r.tickers as string[]) ?? []) {
      const e = map.get(t) ?? { symbol: t, name: tickerName(t), posts: 0, comments: 0, fresh: 0, score: 0 };
      e.posts += 1;
      e.comments += Number(r.comment_count ?? 0);
      if (age < DAY) e.fresh += 1;
      e.score += base * decay;
      map.set(t, e);
    }
  }
  const items = [...map.values()].sort((a, b) => b.score - a.score).slice(0, limit);
  if (items.length < limit) items.push(...fallback(new Set(items.map((i) => i.symbol))).slice(0, limit - items.length));
  return { items, live: true };
}
