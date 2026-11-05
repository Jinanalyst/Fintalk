"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { SUPABASE_URL, isSupabaseConfigured } from "@/lib/supabase/env";
import { UUID_RE } from "@/lib/data/community";

export type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const CATS = ["free", "kr-stock", "us-stock", "crypto", "macro", "strategy", "qna"];

async function authed(): Promise<
  { error: string; sb?: undefined; user?: undefined } | { error?: undefined; sb: Awaited<ReturnType<typeof createClient>>; user: { id: string } }
> {
  if (!isSupabaseConfigured) return { error: "서버에 Supabase 환경변수가 설정되지 않았습니다." };
  const sb = await createClient();
  const { data } = await sb.auth.getUser();
  if (!data.user) return { error: "login" };
  return { sb, user: data.user };
}

const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });
const dbMsg = (m: string) => (/P0001|1시간에/.test(m) ? m.replace(/^.*?(게시글|댓글)/, "$1") : "요청을 처리하지 못했습니다. 권한 또는 입력값을 확인해 주세요.");

function cleanTickers(input: string[]) {
  return Array.from(new Set(input.map((t) => t.trim().replace(/^\$/, "").toUpperCase()).filter((t) => /^[0-9A-Z._-]{1,20}$/.test(t)))).slice(0, 5);
}

/** 업로드된 이미지가 내 폴더의 post-images 버킷 URL 인지 검증 */
function cleanImages(urls: string[], userId: string) {
  const prefix = `${SUPABASE_URL}/storage/v1/object/public/post-images/${userId}/`;
  return urls.filter((u) => typeof u === "string" && u.startsWith(prefix)).slice(0, 5);
}

type PostInput = { category: string; title: string; body: string; tickers: string[]; images: string[] };

function validate(i: PostInput) {
  if (!CATS.includes(i.category)) return "게시판을 선택해 주세요.";
  const t = i.title.trim();
  const b = i.body.trim();
  if (t.length < 2 || t.length > 100) return "제목은 2~100자로 입력해 주세요.";
  if (b.length < 2 || b.length > 20000) return "본문은 2자 이상 입력해 주세요.";
  return null;
}

export async function createPostAction(input: PostInput): Promise<Result<{ id: string }>> {
  const a = await authed();
  if (a.error !== undefined) return fail(a.error);
  const err = validate(input);
  if (err) return fail(err);
  const { data, error } = await a.sb
    .from("posts")
    .insert({
      author_id: a.user.id,
      category_slug: input.category,
      title: input.title.trim(),
      body: input.body.trim(),
      tickers: cleanTickers(input.tickers),
      image_urls: cleanImages(input.images, a.user.id),
    })
    .select("id")
    .single();
  if (error || !data) return fail(dbMsg(error?.message ?? ""));
  revalidatePath("/community");
  revalidatePath("/");
  return { ok: true, id: data.id };
}

export async function updatePostAction(id: string, input: PostInput): Promise<Result<{ id: string }>> {
  const a = await authed();
  if (a.error !== undefined) return fail(a.error);
  if (!UUID_RE.test(id)) return fail("잘못된 요청입니다.");
  const err = validate(input);
  if (err) return fail(err);
  const { data, error } = await a.sb
    .from("posts")
    .update({
      category_slug: input.category,
      title: input.title.trim(),
      body: input.body.trim(),
      tickers: cleanTickers(input.tickers),
      image_urls: cleanImages(input.images, a.user.id),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("author_id", a.user.id)
    .select("id");
  if (error || !data?.length) return fail("수정 권한이 없거나 게시글을 찾을 수 없습니다.");
  revalidatePath(`/community/${id}`);
  revalidatePath("/community");
  return { ok: true, id };
}

export async function deletePostAction(id: string): Promise<Result> {
  const a = await authed();
  if (a.error !== undefined) return fail(a.error);
  if (!UUID_RE.test(id)) return fail("잘못된 요청입니다.");
  const { data, error } = await a.sb.from("posts").delete().eq("id", id).select("id");
  if (error || !data?.length) return fail("삭제 권한이 없거나 게시글을 찾을 수 없습니다.");
  revalidatePath("/community");
  revalidatePath("/");
  return { ok: true };
}

/** value: 1 추천, -1 비추천, 0 취소. (user, post) 당 1행이라 반복 추천 불가 */
export async function votePostAction(postId: string, value: 1 | -1 | 0): Promise<Result> {
  const a = await authed();
  if (a.error !== undefined) return fail(a.error);
  if (!UUID_RE.test(postId) || ![1, -1, 0].includes(value)) return fail("잘못된 요청입니다.");
  const { error } =
    value === 0
      ? await a.sb.from("post_votes").delete().eq("post_id", postId).eq("user_id", a.user.id)
      : await a.sb.from("post_votes").upsert({ post_id: postId, user_id: a.user.id, value }, { onConflict: "user_id,post_id" });
  if (error) return fail("투표를 저장하지 못했습니다.");
  return { ok: true };
}

export async function toggleSaveAction(postId: string, save: boolean): Promise<Result> {
  const a = await authed();
  if (a.error !== undefined) return fail(a.error);
  if (!UUID_RE.test(postId)) return fail("잘못된 요청입니다.");
  const { error } = save
    ? await a.sb.from("saved_posts").upsert({ user_id: a.user.id, post_id: postId })
    : await a.sb.from("saved_posts").delete().eq("user_id", a.user.id).eq("post_id", postId);
  if (error) return fail("저장하지 못했습니다.");
  revalidatePath("/me");
  return { ok: true };
}

export async function reportAction(type: "post" | "comment", targetId: string, reason: string): Promise<Result> {
  const a = await authed();
  if (a.error !== undefined) return fail(a.error);
  if (!UUID_RE.test(targetId) || !["post", "comment"].includes(type)) return fail("잘못된 요청입니다.");
  const r = reason.trim().slice(0, 300);
  if (r.length < 2) return fail("신고 사유를 선택해 주세요.");
  const { error } = await a.sb.from("reports").insert({ reporter_id: a.user.id, target_type: type, target_id: targetId, reason: r });
  if (error) return fail(/duplicate|unique/i.test(error.message) ? "이미 신고한 항목입니다." : "신고를 접수하지 못했습니다.");
  return { ok: true };
}

export async function addCommentAction(postId: string, parentId: string | null, body: string): Promise<Result> {
  const a = await authed();
  if (a.error !== undefined) return fail(a.error);
  if (!UUID_RE.test(postId) || (parentId && !UUID_RE.test(parentId))) return fail("잘못된 요청입니다.");
  const text = body.trim();
  if (text.length < 1 || text.length > 1000) return fail("댓글은 1~1000자로 입력해 주세요.");
  const { error } = await a.sb.from("comments").insert({ post_id: postId, parent_id: parentId, author_id: a.user.id, body: text });
  if (error) return fail(dbMsg(error.message));
  revalidatePath(`/community/${postId}`);
  return { ok: true };
}

export async function deleteCommentAction(id: string, postId: string): Promise<Result> {
  const a = await authed();
  if (a.error !== undefined) return fail(a.error);
  if (!UUID_RE.test(id)) return fail("잘못된 요청입니다.");
  const { data, error } = await a.sb.from("comments").delete().eq("id", id).select("id");
  if (error || !data?.length) return fail("삭제 권한이 없습니다.");
  revalidatePath(`/community/${postId}`);
  return { ok: true };
}

export async function toggleWatchAction(symbol: string, on: boolean): Promise<Result> {
  const a = await authed();
  if (a.error !== undefined) return fail(a.error);
  const s = symbol.toUpperCase();
  if (!/^[0-9A-Z._-]{1,20}$/.test(s)) return fail("잘못된 종목입니다.");
  const { error } = on
    ? await a.sb.from("watchlist").upsert({ user_id: a.user.id, symbol: s })
    : await a.sb.from("watchlist").delete().eq("user_id", a.user.id).eq("symbol", s);
  if (error) return fail("관심 종목을 저장하지 못했습니다.");
  revalidatePath("/me");
  return { ok: true };
}

export async function incrementViewsAction(postId: string) {
  if (!isSupabaseConfigured || !UUID_RE.test(postId)) return;
  const sb = await createClient();
  await sb.rpc("increment_post_views", { p_id: postId });
}
