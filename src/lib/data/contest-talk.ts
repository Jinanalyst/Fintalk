import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { isKoreanPost } from "@/lib/lang";
import type { Post } from "@/lib/sample-data";
import { getPostsByIds, listPosts } from "./community";

export type TalkPost = Post & { pinnedNotice?: boolean };

/** Leverage written in a title, e.g. "[Paper trading] BTC Short 100x +106%" → 100. Highest one wins. */
export function leverageInTitle(title: string): number | null {
  const all = [...title.matchAll(/(?:^|[^\w.])(\d{1,3})\s?x(?![\w])/gi)].map((m) => Number(m[1]));
  return all.length ? Math.max(...all) : null;
}

/** Highest leverage of the shared trades attached to each post (trade_shares.post_id). */
async function sharedLeverage(postIds: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (!isSupabaseConfigured || postIds.length === 0) return out;
  try {
    const { data } = await (await createClient()).from("trade_shares").select("post_id,leverage").in("post_id", postIds);
    for (const r of (data ?? []) as { post_id: string; leverage: number }[]) out.set(r.post_id, Math.max(out.get(r.post_id) ?? 0, Number(r.leverage)));
  } catch {
    // no share data → title check only
  }
  return out;
}

/**
 * "Contest talk" on the landing page:
 *  - optional pinned announcement first (any board, shown even if it is the only post),
 *  - then the newest English posts from the board,
 *  - leaving out sponsored posts and trade brags above the contest leverage cap
 *    (leverage from the attached trade share, or written in the title like "100x").
 * Sample data (Supabase not connected) is never shown here.
 */
export async function getContestTalk(opts: { board: string; maxLeverage: number; pinnedPostId: string | null; limit?: number }): Promise<TalkPost[]> {
  const { board, maxLeverage, pinnedPostId, limit = 3 } = opts;
  const [list, pinned] = await Promise.all([
    listPosts({ cat: board, sort: "new", limit: 30 }),
    pinnedPostId ? getPostsByIds([pinnedPostId]) : Promise.resolve([] as Post[]),
  ]);
  const candidates = list.live ? list.posts.filter((p) => p.id !== pinnedPostId && !p.sponsored && !isKoreanPost(p)) : [];
  const lev = await sharedLeverage(candidates.map((p) => p.id));
  const tooHigh = (p: Post) => (lev.get(p.id) ?? 0) > maxLeverage || (leverageInTitle(p.title) ?? 0) > maxLeverage;
  const rest = candidates.filter((p) => !tooHigh(p)).slice(0, limit);
  return [...pinned.slice(0, 1).map((p) => ({ ...p, pinnedNotice: true })), ...rest];
}
