import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { CREATORS } from "@/lib/sample-data";
import { contributionScore } from "@/lib/data/community";

export type CreatorRow = {
  id: string | null; // 샘플 데이터는 null
  handle: string;
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
  score: number;
  createdAt: string;
  live: boolean;
};

export type CreatorSort = "popular" | "new" | "followers";

const COLS = "id,nickname,bio,interests,created_at,posts,insights,answers,accepted,upvotes,views,followers,following";
type DbRow = {
  id: string; nickname: string; bio: string | null; interests: string[] | null; created_at: string;
  posts: number; insights: number; answers: number; accepted: number; upvotes: number; views: number; followers: number; following: number;
};

const num = (v: unknown) => Number(v ?? 0);

function fromDb(r: DbRow): CreatorRow {
  const base = { posts: num(r.posts), insights: num(r.insights), answers: num(r.answers), accepted: num(r.accepted), upvotes: num(r.upvotes), views: num(r.views) };
  return {
    id: r.id, handle: r.nickname, name: r.nickname, bio: r.bio || "", interests: r.interests ?? [],
    followers: num(r.followers), following: num(r.following), ...base, score: contributionScore(base), createdAt: r.created_at, live: true,
  };
}

function sort(list: CreatorRow[], by: CreatorSort) {
  const k = by === "new" ? (c: CreatorRow) => Date.parse(c.createdAt) : by === "followers" ? (c: CreatorRow) => c.followers : (c: CreatorRow) => c.score;
  return [...list].sort((a, b) => k(b) - k(a));
}

/** 크리에이터 목록. 검색어는 닉네임·소개·관심 분야에 적용됩니다. Supabase 미설정 시 샘플. */
export async function listCreators(opts: { q?: string; field?: string; sort?: CreatorSort; limit?: number } = {}): Promise<{ creators: CreatorRow[]; live: boolean }> {
  const { q, field, sort: by = "popular", limit = 30 } = opts;
  if (!isSupabaseConfigured) {
    const now = Date.now();
    let list: CreatorRow[] = CREATORS.map((c, i) => ({
      id: null, handle: c.handle, name: c.name, bio: c.bio, interests: [c.focus], followers: c.followers, following: 0, posts: c.posts, insights: 0, answers: 0, accepted: 0,
      upvotes: c.upvotes, views: c.views, score: c.upvotes, createdAt: new Date(now - (i + 1) * 864e5 * 9).toISOString(), live: false,
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
