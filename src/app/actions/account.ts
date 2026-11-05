"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { FormState } from "./auth";

export async function updateProfileAction(_: FormState, form: FormData): Promise<FormState> {
  if (!isSupabaseConfigured) return { error: "서버에 Supabase 환경변수가 설정되지 않았습니다." };
  const sb = await createClient();
  const { data } = await sb.auth.getUser();
  if (!data.user) return { error: "로그인이 필요합니다." };

  const nickname = String(form.get("nickname") ?? "").trim();
  const bio = String(form.get("bio") ?? "").trim().slice(0, 200);
  if (!/^[0-9A-Za-z가-힣_]{2,14}$/.test(nickname)) return { error: "닉네임은 한글/영문/숫자/밑줄 2~14자로 입력해 주세요." };

  const { error } = await sb
    .from("profiles")
    .update({
      nickname,
      bio,
      notify_comment: form.get("notify_comment") === "on",
      notify_vote: form.get("notify_vote") === "on",
      notify_follow: form.get("notify_follow") === "on",
    })
    .eq("id", data.user.id);
  if (error) return { error: /duplicate|unique/i.test(error.message) ? "이미 사용 중인 닉네임입니다." : "저장하지 못했습니다." };
  revalidatePath("/me");
  return { message: "저장했습니다." };
}

export async function deleteAccountAction() {
  if (!isSupabaseConfigured) redirect("/");
  const sb = await createClient();
  const { error } = await sb.rpc("delete_my_account");
  if (!error) await sb.auth.signOut();
  redirect(error ? "/me?tab=settings&error=delete" : "/");
}
