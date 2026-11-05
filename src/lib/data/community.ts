import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { ageMinutes, timeAgo } from "@/lib/time";
import { POSTS, hotScore, sortPosts, type Comment, type Post, type SortKey } from "@/lib/sample-data";

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
  created_at: string;
  author: { nickname: string } | { nickname: string }[] | null;
};

const SELECT = "id,author_id,category_slug,title,body,tickers,image_urls,pinned,views,upvotes,downvotes,comment_count,created_at,author:profiles(nickname)";

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
    createdAt: timeAgo(r.created_at),
    upvotes: r.upvotes,
    downvotes: r.downvotes,
    comments: r.comment_count,
    views: r.views,
    tickers: r.tickers,
    images: r.image_urls,
    hasChart: r.image_urls.length > 0,
    pinned: r.pinned,
    ageMin: ageMinutes(r.created_at),
    live: true,
  };
}

export type PostList = { posts: Post[]; live: boolean };

/** 게시글 목록. Supabase 미설정 시 샘플 데이터를 반환합니다. */
export async function listPosts(opts: { cat?: string; sort?: SortKey; limit?: number; authorId?: string; q?: string; ticker?: string } = {}): Promise<PostList> {
  const { cat = "all", sort = "hot", limit = 50, authorId, q, ticker } = opts;
  if (!isSupabaseConfigured) {
    let list = POSTS.filter((p) => cat === "all" || p.category === cat);
    if (q) list = list.filter((p) => (p.title + p.body.join(" ") + p.tickers.join(" ")).toLowerCase().includes(q.toLowerCase()));
    return { posts: sortPosts(list, sort).slice(0, limit), live: false };
  }
  const sb = await createClient();
  let query = sb.from("posts").select(SELECT).eq("status", "published").order("created_at", { ascending: false }).limit(200);
  if (cat !== "all") query = query.eq("category_slug", cat);
  if (authorId) query = query.eq("author_id", authorId);
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

export async function getCurrentUser() {
  if (!isSupabaseConfigured) return null;
  const sb = await createClient();
  const { data } = await sb.auth.getUser();
  if (!data.user) return null;
  const { data: profile } = await sb.from("profiles").select("id,nickname,bio,avatar_url,role,status,notify_comment,notify_vote,notify_follow,created_at").eq("id", data.user.id).single();
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
    .select("id,parent_id,author_id,body,created_at,author:profiles(nickname)")
    .eq("post_id", id)
    .eq("status", "published")
    .order("created_at", { ascending: true })
    .limit(500);

  type CRow = { id: string; parent_id: string | null; author_id: string; body: string; created_at: string; author: { nickname: string } | { nickname: string }[] | null };
  const map = new Map<string, Comment & { parent: string | null }>();
  for (const r of (rows ?? []) as unknown as CRow[]) {
    map.set(r.id, { id: r.id, author: nick(r.author), body: r.body, createdAt: timeAgo(r.created_at), mine: r.author_id === viewerId, parent: r.parent_id, replies: [] });
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

/** 마켓 화면용: 관심 종목 별표 초기 상태 */
export async function getWatchState(): Promise<{ live: boolean; set: Set<string> }> {
  if (!isSupabaseConfigured) return { live: false, set: new Set() };
  const sb = await createClient();
  const { data } = await sb.auth.getUser();
  if (!data.user) return { live: true, set: new Set() };
  return { live: true, set: new Set(await listWatchSymbols(data.user.id)) };
}
