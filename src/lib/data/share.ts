import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { UUID_RE, contributionScore } from "@/lib/data/community";
import type { Side } from "@/lib/trade";

export type Share = {
  id: string;
  userId: string;
  nickname: string;
  kind: "position" | "trade";
  symbol: string;
  side: Side;
  leverage: number;
  entry: number;
  mark: number;
  pnl: number;
  roe: number;
  closed: boolean;
  reason: string | null;
  postId: string | null;
  createdAt: string;
  /** 커뮤니티 기여도 점수 (공유 시점이 아니라 보는 시점의 값) */
  points: number;
};

/** Supabase 미연결 샘플 모드에서 카드 모양을 확인하기 위한 예시 */
export const DEMO_SHARE: Share = {
  id: "demo",
  userId: "demo",
  nickname: "핀톡러",
  kind: "position",
  symbol: "BTCUSDT",
  side: "short",
  leverage: 10,
  entry: 74450.01,
  mark: 74424.7,
  pnl: 3.41,
  roe: 3.4,
  closed: false,
  reason: null,
  postId: null,
  createdAt: new Date().toISOString(),
  points: 128,
};

/** 공유 카드 조회. 링크를 아는 누구나 볼 수 있는 공개 데이터입니다. */
export async function getShare(id: string): Promise<Share | null> {
  if (!isSupabaseConfigured) return id === "demo" ? DEMO_SHARE : null;
  if (!UUID_RE.test(id)) return null;
  const sb = await createClient();
  const { data: r } = await sb
    .from("trade_shares")
    .select("id,user_id,kind,symbol,side,leverage,entry_price,mark_price,pnl,roe,closed,close_reason,post_id,created_at,profiles(nickname)")
    .eq("id", id)
    .maybeSingle();
  if (!r) return null;
  const prof = (Array.isArray(r.profiles) ? r.profiles[0] : r.profiles) as { nickname: string } | null;
  const { data: st } = await sb.from("creator_stats").select("posts,insights,answers,accepted,upvotes,views").eq("id", r.user_id).maybeSingle();
  const n = (v: unknown) => Number(v ?? 0);
  return {
    id: r.id,
    userId: r.user_id,
    nickname: prof?.nickname ?? "탈퇴한 사용자",
    kind: r.kind,
    symbol: r.symbol,
    side: r.side,
    leverage: r.leverage,
    entry: n(r.entry_price),
    mark: n(r.mark_price),
    pnl: n(r.pnl),
    roe: n(r.roe),
    closed: r.closed,
    reason: r.close_reason,
    postId: r.post_id,
    createdAt: r.created_at,
    points: st ? contributionScore({ posts: n(st.posts), insights: n(st.insights), answers: n(st.answers), accepted: n(st.accepted), upvotes: n(st.upvotes), views: n(st.views) }) : 0,
  };
}
