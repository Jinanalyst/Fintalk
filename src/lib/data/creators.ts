import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { CREATORS } from "@/lib/sample-data";
import { contributionScore } from "@/lib/data/community";
import type { PopularItem } from "@/components/layout/popular-creators";

export type CreatorRow = {
  id: string | null; // 샘플 데이터는 null
  handle: string;
  avatar: string | null;
  name: string;
  bio: string;
  interests: string[];
  followers: number;
  following: number;
  posts: number;
  insights: number;
  answers: number;
  accepted: number;
  upvotes: number;
  views: number;
  /** 내 글이 다른 사람에게 저장된 횟수 */
  saves: number;
  score: number;
  createdAt: string;
  live: boolean;
};

export type CreatorSort = "popular" | "new" | "followers";

const COLS = "id,nickname,bio,avatar_url,interests,created_at,posts,insights,answers,accepted,upvotes,views,followers,following,saves";
type DbRow = {
  id: string; nickname: string; avatar_url: string | null; bio: string | null; interests: string[] | null; created_at: string;
  posts: number; insights: number; answers: number; accepted: number; upvotes: number; views: number; followers: number; following: number; saves: number;
};

const num = (v: unknown) => Number(v ?? 0);

function fromDb(r: DbRow): CreatorRow {
  const base = { posts: num(r.posts), insights: num(r.insights), answers: num(r.answers), accepted: num(r.accepted), upvotes: num(r.upvotes), views: num(r.views) };
  return {
    saves: num(r.saves),
    id: r.id, handle: r.nickname, avatar: r.avatar_url ?? null, name: r.nickname, bio: r.bio || "", interests: r.interests ?? [],
    followers: num(r.followers), following: num(r.following), ...base, score: contributionScore(base), createdAt: r.created_at, live: true,
  };
}

function sort(list: CreatorRow[], by: CreatorSort) {
  if (by === "popular") return [...list].sort((a, b) => b.views - a.views || b.saves - a.saves || b.upvotes - a.upvotes);
  const k = by === "new" ? (c: CreatorRow) => Date.parse(c.createdAt) : (c: CreatorRow) => c.followers;
  return [...list].sort((a, b) => k(b) - k(a));
}

/** 크리에이터 목록. 검색어는 닉네임·소개·관심 분야에 적용됩니다. Supabase 미설정 시 샘플. */
export async function listCreators(opts: { q?: string; field?: string; sort?: CreatorSort; limit?: number } = {}): Promise<{ creators: CreatorRow[]; live: boolean }> {
  const { q, field, sort: by = "popular", limit = 30 } = opts;
  if (!isSupabaseConfigured) {
    const now = Date.now();
    let list: CreatorRow[] = CREATORS.map((c, i) => ({
      id: null, handle: c.handle, avatar: null, name: c.name, bio: c.bio, interests: [c.focus], followers: c.followers, following: 0, posts: c.posts, insights: Math.round(c.posts * 0.3), answers: 0, accepted: Math.max(1, Math.round(c.upvotes / 2500)),
      upvotes: c.upvotes, views: c.views, saves: Math.round(c.upvotes * 0.4), score: c.upvotes, createdAt: new Date(now - (i + 1) * 864e5 * 9).toISOString(), live: false,
    }));
    if (q) list = list.filter((c) => (c.name + c.handle + c.bio + c.interests.join(" ")).toLowerCase().includes(q.toLowerCase()));
    if (field) list = list.filter((c) => c.interests.some((x) => x.includes(field)));
    return { creators: sort(list, by).slice(0, limit), live: false };
  }
  const sb = await createClient();
  let query = sb.from("creator_stats").select(COLS).limit(300);
  if (field) query = query.contains("interests", [field]);
  if (q) {
    const safe = q.replace(/[%_,()]/g, " ").trim();
    if (safe) query = query.or(`nickname.ilike.%${safe}%,bio.ilike.%${safe}%`);
  }
  const { data, error } = await query;
  if (error) {
    console.error("[listCreators]", error.message);
    return { creators: [], live: true };
  }
  return { creators: sort(((data ?? []) as unknown as DbRow[]).map(fromDb), by).slice(0, limit), live: true };
}

export async function getCreatorByHandle(handle: string): Promise<CreatorRow | null> {
  if (!isSupabaseConfigured) return null;
  const sb = await createClient();
  const { data } = await sb.from("creator_stats").select(COLS).eq("nickname", handle).maybeSingle();
  return data ? fromDb(data as unknown as DbRow) : null;
}

/** 현재 로그인 사용자가 팔로우 중인 id 집합 */
export async function getFollowState(ids: string[]): Promise<{ viewerId: string | null; following: Set<string> }> {
  if (!isSupabaseConfigured) return { viewerId: null, following: new Set() };
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  const viewerId = auth.user?.id ?? null;
  const list = ids.filter(Boolean);
  if (!viewerId || list.length === 0) return { viewerId, following: new Set() };
  const { data } = await sb.from("follows").select("followee_id").eq("follower_id", viewerId).in("followee_id", list);
  return { viewerId, following: new Set((data ?? []).map((r) => r.followee_id as string)) };
}

/** 내가 팔로우한 크리에이터의 최신 글 */
export async function listFollowingIds(userId: string): Promise<string[]> {
  const sb = await createClient();
  const { data } = await sb.from("follows").select("followee_id").eq("follower_id", userId).limit(200);
  return (data ?? []).map((r) => r.followee_id as string);
}

/**
 * 인기 작성자: 조회수 → 저장 수 → 좋아요 순서의 우선순위로 정렬합니다.
 * (조회수가 같으면 저장 수, 저장 수도 같으면 좋아요로 비교) 광고 클릭 등은 반영하지 않습니다.
 */
export async function getPopularCreators(): Promise<{ items: PopularItem[]; live: boolean }> {
  const { creators, live } = await listCreators({ limit: 300 });
  const { viewerId, following } = await getFollowState(creators.map((c) => c.id ?? ""));
  const items = [...creators]
    .sort((a, b) => b.views - a.views || b.saves - a.saves || b.upvotes - a.upvotes)
    .filter((c) => c.views + c.saves + c.upvotes > 0 || !live)
    .map((c) => ({ handle: c.handle, avatar: c.avatar, name: c.name, id: c.id, following: c.id ? following.has(c.id) : false, mine: c.id !== null && c.id === viewerId, views: c.views, saves: c.saves, likes: c.upvotes }));
  return { items, live };
}

/** 채택된 답변이 많은 순 (질문에 실제로 도움을 준 사람) */
export async function getTopHelpers(limit = 3): Promise<{ items: CreatorRow[]; live: boolean }> {
  const { creators, live } = await listCreators({ limit: 300 });
  const items = [...creators].sort((a, b) => b.accepted - a.accepted || b.answers - a.answers).filter((c) => c.accepted > 0).slice(0, limit);
  return { items, live };
}
