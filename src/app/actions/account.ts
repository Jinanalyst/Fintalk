"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { SUPABASE_URL, isSupabaseConfigured } from "@/lib/supabase/env";
import type { FormState } from "./auth";
import { INTEREST_OPTIONS } from "@/lib/sample-data";

export async function updateProfileAction(_: FormState, form: FormData): Promise<FormState> {
  if (!isSupabaseConfigured) return { error: "서버에 Supabase 환경변수가 설정되지 않았습니다." };
  const sb = await createClient();
  const { data } = await sb.auth.getUser();
  if (!data.user) return { error: "로그인이 필요합니다." };

  const nickname = String(form.get("nickname") ?? "").trim();
  const bio = String(form.get("bio") ?? "").trim().slice(0, 200);
  if (!/^[0-9A-Za-z가-힣_]{2,14}$/.test(nickname)) return { error: "닉네임은 한글/영문/숫자/밑줄 2~14자로 입력해 주세요." };

  const interests = Array.from(new Set(form.getAll("interests").map(String).filter((v) => INTEREST_OPTIONS.includes(v))));
  if (interests.length > 5) return { error: "관심 분야는 최대 5개까지 선택할 수 있습니다." };

  const { error } = await sb
    .from("profiles")
    .update({
      nickname,
      bio,
      interests,
      notify_comment: form.get("notify_comment") === "on",
      notify_vote: form.get("notify_vote") === "on",
      notify_follow: form.get("notify_follow") === "on",
    })
    .eq("id", data.user.id);
  if (error) return { error: /duplicate|unique/i.test(error.message) ? "이미 사용 중인 닉네임입니다." : "저장하지 못했습니다." };
  revalidatePath("/me");
  return { message: "저장했습니다." };
}

/** 프로필 사진 저장. url=null 이면 제거. 내 폴더의 avatars 버킷 URL 만 허용합니다. */
export async function setAvatarAction(url: string | null): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isSupabaseConfigured) return { ok: false, error: "서버에 Supabase 환경변수가 설정되지 않았습니다." };
  const sb = await createClient();
  const { data } = await sb.auth.getUser();
  if (!data.user) return { ok: false, error: "로그인이 필요합니다." };
  if (url !== null && !url.startsWith(`${SUPABASE_URL}/storage/v1/object/public/avatars/${data.user.id}/`)) {
    return { ok: false, error: "잘못된 이미지 주소입니다." };
  }
  const { error } = await sb.from("profiles").update({ avatar_url: url }).eq("id", data.user.id);
  if (error) return { ok: false, error: "프로필 사진을 저장하지 못했습니다." };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteAccountAction() {
  if (!isSupabaseConfigured) redirect("/");
  const sb = await createClient();
  const { error } = await sb.rpc("delete_my_account");
  if (!error) await sb.auth.signOut();
  redirect(error ? "/me?tab=settings&error=delete" : "/");
}
