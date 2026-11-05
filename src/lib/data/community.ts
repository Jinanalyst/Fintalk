import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { ageMinutes, timeAgo } from "@/lib/time";
import { POSTS, hotScore, isPostType, sortPosts, type Comment, type Post, type PostType, type SortKey } from "@/lib/sample-data";

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type PostRow = {
  id: string;
  author_id: string;
  category_slug: string;
  title: string;
  body: string;
  tickers: string[];
  image_urls: string[];
  pinned: boolean;
  views: number;
  upvotes: number;
  downvotes: number;
  comment_count: number;
  post_type: string;
  accepted_comment_id: string | null;
  is_sponsored: boolean;
  status: string;
  created_at: string;
  author: { nickname: string; avatar_url?: string | null } | { nickname: string; avatar_url?: string | null }[] | null;
};

const SELECT = "id,author_id,category_slug,title,body,tickers,image_urls,pinned,views,upvotes,downvotes,comment_count,post_type,accepted_comment_id,is_sponsored,status,created_at,author:profiles(nickname,avatar_url)";

function avatarOf(a: PostRow["author"]) {
  return (Array.isArray(a) ? a[0]?.avatar_url : a?.avatar_url) ?? null;
}

function nick(a: PostRow["author"]) {
  return (Array.isArray(a) ? a[0]?.nickname : a?.nickname) ?? "알 수 없음";
}

export function mapPost(r: PostRow): Post {
  return {
    id: r.id,
    title: r.title,
    body: r.body.split(/\n{2,}/),
    rawBody: r.body,
    category: r.category_slug,
    author: nick(r.author),
    authorId: r.author_id,
    authorAvatar: avatarOf(r.author),
    createdAt: timeAgo(r.created_at),
    upvotes: r.upvotes,
    downvotes: r.downvotes,
    comments: r.comment_count,
    views: r.views,
    tickers: r.tickers,
    images: r.image_urls,
    type: isPostType(r.post_type) ? r.post_type : "general",
    acceptedCommentId: r.accepted_comment_id,
    sponsored: r.is_sponsored,
    draft: r.status === "draft",
    hasChart: r.image_urls.length > 0,
    pinned: r.pinned,
    ageMin: ageMinutes(r.created_at),
    live: true,
  };
}

export type PostList = { posts: Post[]; live: boolean };

/** 게시글 목록. Supabase 미설정 시 샘플 데이터를 반환합니다. */
export async function listPosts(opts: { cat?: string; sort?: SortKey; limit?: number; authorId?: string; q?: string; ticker?: string; types?: PostType[]; authorIds?: string[] } = {}): Promise<PostList> {
  const { cat = "all", sort = "hot", limit = 50, authorId, q, ticker, types, authorIds } = opts;
  if (authorIds && authorIds.length === 0) return { posts: [], live: isSupabaseConfigured };
  if (!isSupabaseConfigured) {
    let list = POSTS.filter((p) => (cat === "all" || p.category === cat) && (!ticker || p.tickers.includes(ticker.toUpperCase())) && (!types || types.includes(p.type)));
    if (q) list = list.filter((p) => (p.title + p.body.join(" ") + p.tickers.join(" ")).toLowerCase().includes(q.toLowerCase()));
    return { posts: sortPosts(list, sort).slice(0, limit), live: false };
  }
  const sb = await createClient();
  let query = sb.from("posts").select(SELECT).eq("status", "published").order("created_at", { ascending: false }).limit(200);
  if (cat !== "all") query = query.eq("category_slug", cat);
  if (authorId) query = query.eq("author_id", authorId);
  if (authorIds) query = query.in("author_id", authorIds);
  if (types?.length) query = query.in("post_type", types);
  if (ticker) query = query.contains("tickers", [ticker.toUpperCase()]);
  if (q) {
    const safe = q.replace(/[%_,()]/g, " ").trim();
    if (safe) query = query.or(`title.ilike.%${safe}%,body.ilike.%${safe}%`);
  }
  const { data, error } = await query;
  if (error) {
    console.error("[listPosts]", error.message);
    return { posts: [], live: true };
  }
  const posts = (data as unknown as PostRow[]).map(mapPost);
  const sorted = sort === "new" ? posts : sort === "comments" ? [...posts].sort((a, b) => b.comments - a.comments) : [...posts].sort((a, b) => hotScore(b) - hotScore(a));
  return { posts: sorted.slice(0, limit), live: true };
}

export type CommentPreview = { id: string; author: string; body: string; createdAt: string };

/** 게시글별 최신 댓글 미리보기 (게시글당 최대 `perPost` 개). Supabase 미설정 시 빈 결과. */
export async function listCommentPreviews(postIds: string[], perPost = 2): Promise<Record<string, CommentPreview[]>> {
  const ids = postIds.filter((id) => UUID_RE.test(id));
  if (!isSupabaseConfigured || ids.length === 0) return {};
  const sb = await createClient();
  const { data } = await sb
    .from("comments")
    .select("id,post_id,body,created_at,author:profiles(nickname,avatar_url)")
    .in("post_id", ids)
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(ids.length * perPost * 3);
  type Row = { id: string; post_id: string; body: string; created_at: string; author: { nickname: string } | { nickname: string }[] | null };
  const out: Record<string, CommentPreview[]> = {};
  for (const r of (data ?? []) as unknown as Row[]) {
    const list = (out[r.post_id] ??= []);
    if (list.length < perPost) list.push({ id: r.id, author: nick(r.author), body: r.body, createdAt: timeAgo(r.created_at) });
  }
  return out;
}

/** 내 임시 저장 글 (작성자 본인만 조회 가능 — RLS) */
export async function listDrafts(userId: string): Promise<Post[]> {
  if (!isSupabaseConfigured) return [];
  const sb = await createClient();
  const { data } = await sb.from("posts").select(SELECT).eq("author_id", userId).eq("status", "draft").order("updated_at", { ascending: false }).limit(50);
  return ((data ?? []) as unknown as PostRow[]).map(mapPost);
}

export type MyStats = { posts: number; insights: number; answers: number; accepted: number; upvotes: number; views: number; followers: number; following: number };

/**
 * 기여도 지표. 조회수는 게시글 누적 조회수이며 부정·중복 조회 제거(유효 조회수)는 이후 단계에서 보강합니다.
 * 광고 클릭 수는 어떤 지표에도 포함하지 않습니다.
 */
export async function getMyStats(userId: string): Promise<MyStats | null> {
  if (!isSupabaseConfigured) return null;
  const sb = await createClient();
  const { data, error } = await sb.from("creator_stats").select("posts,insights,answers,accepted,upvotes,views,followers,following").eq("id", userId).maybeSingle();
  if (error || !data) return null;
  const n = (v: unknown) => Number(v ?? 0);
  return { posts: n(data.posts), insights: n(data.insights), answers: n(data.answers), accepted: n(data.accepted), upvotes: n(data.upvotes), views: n(data.views), followers: n(data.followers), following: n(data.following) };
}

/** 기여도 점수: 단순 조회·추천보다 실제 도움(채택 답변, 인사이트)에 더 높은 가중치 */
export const contributionScore = (s: Pick<MyStats, "posts" | "insights" | "answers" | "accepted" | "upvotes" | "views">) =>
  s.posts * 2 + s.insights * 5 + s.answers * 2 + s.accepted * 15 + s.upvotes + Math.floor(s.views / 50);

/**
 * 지금 답을 기다리는 질문: 아직 답변이 없는 질문을 최신순으로. 부족하면 채택이 없는 질문으로 채웁니다.
 */
export async function listWaitingQuestions(limit = 4): Promise<{ posts: Post[]; live: boolean }> {
  const { posts, live } = await listPosts({ sort: "new", types: ["question"], limit: 50 });
  const open = posts.filter((p) => !p.acceptedCommentId);
  const none = open.filter((p) => p.comments === 0);
  const rest = open.filter((p) => p.comments > 0);
  return { posts: [...none, ...rest].slice(0, limit), live };
}

/** 기여도 단계 (점수 구간). 현금 보상과는 무관한 활동 단계입니다. */
export const LEVELS = [
  { name: "새싹", min: 0 },
  { name: "참여자", min: 30 },
  { name: "기여자", min: 100 },
  { name: "전문가", min: 300 },
  { name: "마스터", min: 1000 },
];

export function contributionLevel(score: number) {
  let i = 0;
  LEVELS.forEach((l, j) => { if (score >= l.min) i = j; });
  const cur = LEVELS[i];
  const next = LEVELS[i + 1] ?? null;
  return { cur, next, remain: next ? next.min - score : 0, pct: next ? Math.round(((score - cur.min) / (next.min - cur.min)) * 100) : 100 };
}

export async function getCurrentUser() {
  if (!isSupabaseConfigured) return null;
  const sb = await createClient();
  const { data } = await sb.auth.getUser();
  if (!data.user) return null;
  const { data: profile } = await sb.from("profiles").select("id,nickname,bio,interests,avatar_url,role,status,notify_comment,notify_vote,notify_follow,created_at").eq("id", data.user.id).single();
  return profile ? { ...profile, email: data.user.email ?? "" } : null;
}

export type DetailResult = { post: Post; comments: Comment[]; live: boolean; viewerId: string | null } | null;

export async function getPostDetail(id: string): Promise<DetailResult> {
  if (!isSupabaseConfigured) return null;
  if (!UUID_RE.test(id)) return null;
  const sb = await createClient();
  const { data, error } = await sb.from("posts").select(SELECT).eq("id", id).maybeSingle();
  if (error || !data) return null;
  const post = mapPost(data as unknown as PostRow);

  const { data: auth } = await sb.auth.getUser();
  const viewerId = auth.user?.id ?? null;
  if (viewerId) {
    const [{ data: v }, { data: s }] = await Promise.all([
      sb.from("post_votes").select("value").eq("post_id", id).eq("user_id", viewerId).maybeSingle(),
      sb.from("saved_posts").select("post_id").eq("post_id", id).eq("user_id", viewerId).maybeSingle(),
    ]);
    post.myVote = (v?.value ?? 0) as 0 | 1 | -1;
    post.saved = !!s;
  }

  const { data: rows } = await sb
    .from("comments")
    .select("id,parent_id,author_id,body,created_at,author:profiles(nickname,avatar_url)")
    .eq("post_id", id)
    .eq("status", "published")
    .order("created_at", { ascending: true })
    .limit(500);

  type CRow = { id: string; parent_id: string | null; author_id: string; body: string; created_at: string; author: { nickname: string } | { nickname: string }[] | null };
  const map = new Map<string, Comment & { parent: string | null }>();
  for (const r of (rows ?? []) as unknown as CRow[]) {
    map.set(r.id, { id: r.id, author: nick(r.author), body: r.body, createdAt: timeAgo(r.created_at), authorAvatar: avatarOf(r.author), mine: r.author_id === viewerId, accepted: r.id === post.acceptedCommentId, parent: r.parent_id, replies: [] });
  }
  const roots: Comment[] = [];
  for (const c of map.values()) {
    const parent = c.parent ? map.get(c.parent) : null;
    // 대댓글은 1단계까지만 표시 (더 깊은 답글은 최상위 댓글 아래로 평탄화)
    if (parent) (parent.parent ? map.get(parent.parent)! : parent).replies!.push(c);
    else roots.push(c);
  }
  return { post, comments: roots, live: true, viewerId };
}

export async function listSavedPosts(userId: string): Promise<Post[]> {
  const sb = await createClient();
  const { data } = await sb
    .from("saved_posts")
    .select(`created_at, post:posts!inner(${SELECT})`)
    .eq("user_id", userId)
    .eq("post.status", "published")
    .order("created_at", { ascending: false })
    .limit(50);
  type Row = { post: PostRow | PostRow[] };
  return ((data ?? []) as unknown as Row[]).map((r) => mapPost(Array.isArray(r.post) ? r.post[0] : r.post)).map((p) => ({ ...p, saved: true }));
}

export async function listWatchSymbols(userId: string): Promise<string[]> {
  const sb = await createClient();
  const { data } = await sb.from("watchlist").select("symbol").eq("user_id", userId).order("created_at", { ascending: false });
  return (data ?? []).map((r) => r.symbol as string);
}

/** 종목 토론 화면용: 관심 종목 별표 초기 상태 */
export async function getWatchState(): Promise<{ live: boolean; set: Set<string> }> {
  if (!isSupabaseConfigured) return { live: false, set: new Set() };
  const sb = await createClient();
  const { data } = await sb.auth.getUser();
  if (!data.user) return { live: true, set: new Set() };
  return { live: true, set: new Set(await listWatchSymbols(data.user.id)) };
}
