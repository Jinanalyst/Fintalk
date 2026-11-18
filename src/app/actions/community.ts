"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { SUPABASE_URL, isSupabaseConfigured } from "@/lib/supabase/env";
import { UUID_RE } from "@/lib/data/community";
import { GENERIC_DB_ERROR, translateDbMessage } from "@/lib/db-messages";
import { imageUrlsOf, sanitizeMedia } from "@/lib/media-md";

export type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const CATS = ["kr-stock", "us-stock", "crypto", "macro", "trading", "beginner", "free", "strategy", "qna"]; // strategy/qna are kept for legacy posts
const TYPES = ["general", "question", "discussion", "analysis", "strategy", "review", "resource"];

async function authed(): Promise<
  { error: string; sb?: undefined; user?: undefined } | { error?: undefined; sb: Awaited<ReturnType<typeof createClient>>; user: { id: string } }
> {
  if (!isSupabaseConfigured) return { error: "Supabase environment variables are not set on the server." };
  const sb = await createClient();
  const { data } = await sb.auth.getUser();
  if (!data.user) return { error: "login" };
  return { sb, user: data.user };
}

const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });
const dbMsg = (m: string, code?: string) => {
  if (/P0001/.test(m) || code === "P0001") return translateDbMessage(m) ?? GENERIC_DB_ERROR;
  console.error("[community] db error:", code, m);
  const detail = ` (error ${code ?? "?"}: ${m.slice(0, 120)})`;
  if (code === "23503") return "The selected category was not found." + detail;
  if (code === "42501" || /row-level security/i.test(m)) return "You do not have permission to post. Please log in again." + detail;
  return "Could not process the request." + detail;
};

function cleanTickers(input: string[]) {
  return Array.from(new Set(input.map((t) => t.trim().replace(/^\$/, "").toUpperCase()).filter((t) => /^[0-9A-Z._-]{1,20}$/.test(t)))).slice(0, 5);
}

/** 본문 속 이미지·동영상은 내 폴더의 post-images 버킷 주소만 허용 */
const mediaPrefix = (userId: string) => `${SUPABASE_URL}/storage/v1/object/public/post-images/${userId}/`;

type PostInput = { category: string; type: string; title: string; body: string; tickers: string[]; sponsored?: boolean; draft?: boolean; publishAt?: string | null };

const MAX_AHEAD_DAYS = 90;
const MAX_IMAGES = 100; // keep in sync with DB posts_image_urls_check (migration 20261110)

/** 예약 시각 검사: 지금부터 1분 뒤 ~ 90일 뒤. 값이 없으면 null(즉시 발행) */
function parsePublishAt(v?: string | null): { at: string | null; error?: string } {
  if (!v) return { at: null };
  const t = new Date(v).getTime();
  if (Number.isNaN(t)) return { at: null, error: "Invalid scheduled time." };
  if (t < Date.now() + 60_000) return { at: null, error: "The scheduled time must be at least 1 minute from now." };
  if (t > Date.now() + MAX_AHEAD_DAYS * 86400_000) return { at: null, error: `You can schedule up to ${MAX_AHEAD_DAYS} days ahead.` };
  return { at: new Date(t).toISOString() };
}

function validate(i: PostInput) {
  if (!CATS.includes(i.category)) return "Select a category.";
  if (!TYPES.includes(i.type)) return "Select a post type.";
  const t = i.title.trim();
  const b = i.body.trim();
  if (t.length < 2 || t.length > 100) return "Title must be 2-100 characters.";
  if (b.length < 2 || b.length > 20000) return "Body must be at least 2 characters.";
  return null;
}

export async function createPostAction(input: PostInput): Promise<Result<{ id: string }>> {
  const a = await authed();
  if (a.error !== undefined) return fail(a.error);
  const err = validate(input);
  if (err) return fail(err);
  const body = sanitizeMedia(input.body, mediaPrefix(a.user.id)).trim();
  const sched = input.draft ? { at: null } : parsePublishAt(input.publishAt);
  if (sched.error) return fail(sched.error);
  const { data, error } = await a.sb
    .from("posts")
    .insert({
      author_id: a.user.id,
      category_slug: input.category,
      post_type: input.type,
      is_sponsored: !!input.sponsored,
      status: input.draft ? "draft" : "published",
      title: input.title.trim(),
      body,
      tickers: cleanTickers(input.tickers),
      image_urls: imageUrlsOf(body).slice(0, MAX_IMAGES),
      ...(sched.at ? { created_at: sched.at } : {}),
    })
    .select("id")
    .single();
  if (error || !data) return fail(dbMsg(error?.message ?? "no row returned", error?.code));
  revalidatePath("/community");
  revalidatePath("/insights");
  revalidatePath("/");
  return { ok: true, id: data.id };
}

export async function updatePostAction(id: string, input: PostInput): Promise<Result<{ id: string }>> {
  const a = await authed();
  if (a.error !== undefined) return fail(a.error);
  if (!UUID_RE.test(id)) return fail("Invalid request.");
  const err = validate(input);
  if (err) return fail(err);
  // 아직 공개 전(임시 저장/예약)인 글만 공개 시각을 바꿀 수 있습니다. 이미 공개된 글의 시각은 그대로 둡니다.
  const { data: cur } = await a.sb.from("posts").select("status,created_at").eq("id", id).eq("author_id", a.user.id).maybeSingle();
  const notYetLive = !!cur && (cur.status === "draft" || new Date(cur.created_at).getTime() > Date.now());
  const sched = input.draft || !notYetLive ? { at: null } : parsePublishAt(input.publishAt);
  if (sched.error) return fail(sched.error);
  const publishTime = input.draft || !notYetLive ? {} : { created_at: sched.at ?? new Date().toISOString() };
  const body = sanitizeMedia(input.body, mediaPrefix(a.user.id)).trim();
  const { data, error } = await a.sb
    .from("posts")
    .update({
      category_slug: input.category,
      post_type: input.type,
      is_sponsored: !!input.sponsored,
      status: input.draft ? "draft" : "published",
      title: input.title.trim(),
      body,
      tickers: cleanTickers(input.tickers),
      image_urls: imageUrlsOf(body).slice(0, MAX_IMAGES),
      ...publishTime,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("author_id", a.user.id)
    .select("id");
  if (error || !data?.length) return fail("You cannot edit this post, or it was not found.");
  revalidatePath(`/community/${id}`);
  revalidatePath("/community");
  return { ok: true, id };
}

export async function deletePostAction(id: string): Promise<Result> {
  const a = await authed();
  if (a.error !== undefined) return fail(a.error);
  if (!UUID_RE.test(id)) return fail("Invalid request.");
  const { data, error } = await a.sb.from("posts").delete().eq("id", id).select("id");
  if (error || !data?.length) return fail("You cannot delete this post, or it was not found.");
  revalidatePath("/community");
  revalidatePath("/");
  return { ok: true };
}

/** value: 1 추천, -1 비추천, 0 취소. (user, post) 당 1행이라 반복 추천 불가 */
export async function votePostAction(postId: string, value: 1 | -1 | 0): Promise<Result> {
  const a = await authed();
  if (a.error !== undefined) return fail(a.error);
  if (!UUID_RE.test(postId) || ![1, -1, 0].includes(value)) return fail("Invalid request.");
  const { error } =
    value === 0
      ? await a.sb.from("post_votes").delete().eq("post_id", postId).eq("user_id", a.user.id)
      : await a.sb.from("post_votes").upsert({ post_id: postId, user_id: a.user.id, value }, { onConflict: "user_id,post_id" });
  if (error) return fail("Could not save your vote.");
  return { ok: true };
}

export async function toggleSaveAction(postId: string, save: boolean): Promise<Result> {
  const a = await authed();
  if (a.error !== undefined) return fail(a.error);
  if (!UUID_RE.test(postId)) return fail("Invalid request.");
  const { error } = save
    ? await a.sb.from("saved_posts").upsert({ user_id: a.user.id, post_id: postId })
    : await a.sb.from("saved_posts").delete().eq("user_id", a.user.id).eq("post_id", postId);
  if (error) return fail("Could not save.");
  revalidatePath("/me");
  return { ok: true };
}

export async function reportAction(type: "post" | "comment", targetId: string, reason: string): Promise<Result> {
  const a = await authed();
  if (a.error !== undefined) return fail(a.error);
  if (!UUID_RE.test(targetId) || !["post", "comment"].includes(type)) return fail("Invalid request.");
  const r = reason.trim().slice(0, 300);
  if (r.length < 2) return fail("Select a reason for the report.");
  const { error } = await a.sb.from("reports").insert({ reporter_id: a.user.id, target_type: type, target_id: targetId, reason: r });
  if (error) return fail(/duplicate|unique/i.test(error.message) ? "You already reported this." : "Could not submit the report.");
  return { ok: true };
}

export async function addCommentAction(postId: string, parentId: string | null, body: string): Promise<Result> {
  const a = await authed();
  if (a.error !== undefined) return fail(a.error);
  if (!UUID_RE.test(postId) || (parentId && !UUID_RE.test(parentId))) return fail("Invalid request.");
  const text = body.trim();
  if (text.length < 1 || text.length > 1000) return fail("Comments must be 1-1000 characters.");
  const { error } = await a.sb.from("comments").insert({ post_id: postId, parent_id: parentId, author_id: a.user.id, body: text });
  if (error) return fail(dbMsg(error.message));
  revalidatePath(`/community/${postId}`);
  return { ok: true };
}

/** 질문 작성자가 도움이 된 답변을 채택합니다. commentId=null 이면 채택 취소. */
export async function acceptAnswerAction(postId: string, commentId: string | null): Promise<Result> {
  const a = await authed();
  if (a.error !== undefined) return fail(a.error);
  if (!UUID_RE.test(postId) || (commentId && !UUID_RE.test(commentId))) return fail("Invalid request.");
  const { error } = await a.sb.rpc("accept_answer", { p_post: postId, p_comment: commentId });
  if (error) return fail(dbMsg(error.message));
  revalidatePath(`/community/${postId}`);
  revalidatePath("/community");
  return { ok: true };
}

export async function deleteCommentAction(id: string, postId: string): Promise<Result> {
  const a = await authed();
  if (a.error !== undefined) return fail(a.error);
  if (!UUID_RE.test(id)) return fail("Invalid request.");
  const { data, error } = await a.sb.from("comments").delete().eq("id", id).select("id");
  if (error || !data?.length) return fail("You cannot delete this.");
  revalidatePath(`/community/${postId}`);
  return { ok: true };
}

export async function toggleWatchAction(symbol: string, on: boolean): Promise<Result> {
  const a = await authed();
  if (a.error !== undefined) return fail(a.error);
  const s = symbol.toUpperCase();
  if (!/^[0-9A-Z._-]{1,20}$/.test(s)) return fail("Invalid ticker.");
  const { error } = on
    ? await a.sb.from("watchlist").upsert({ user_id: a.user.id, symbol: s })
    : await a.sb.from("watchlist").delete().eq("user_id", a.user.id).eq("symbol", s);
  if (error) return fail("Could not save the watchlist.");
  revalidatePath("/me");
  return { ok: true };
}

export async function incrementViewsAction(postId: string) {
  if (!isSupabaseConfigured || !UUID_RE.test(postId)) return;
  const sb = await createClient();
  await sb.rpc("increment_post_views", { p_id: postId });
}
