"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export type FormState = { error?: string; message?: string };

const NOT_CONFIGURED: FormState = { error: "서버에 Supabase 환경변수가 설정되지 않았습니다." };

async function origin() {
  const h = await headers();
  return h.get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

/** 오픈 리다이렉트 방지: 사이트 내부 경로만 허용 */
function safeNext(v: FormDataEntryValue | null) {
  const s = typeof v === "string" ? v : "/";
  return s.startsWith("/") && !s.startsWith("//") && !s.includes("\\") ? s : "/";
}

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

function friendly(msg: string) {
  if (/invalid login/i.test(msg)) return "이메일 또는 비밀번호가 올바르지 않습니다.";
  if (/email not confirmed/i.test(msg)) return "이메일 인증이 필요합니다. 받은 편지함을 확인해 주세요.";
  if (/already registered|already been registered/i.test(msg)) return "이미 가입된 이메일입니다.";
  if (/rate limit|too many/i.test(msg)) return "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.";
  if (/password/i.test(msg)) return "비밀번호는 8자 이상이어야 합니다.";
  return "요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.";
}

export async function signInAction(_: FormState, form: FormData): Promise<FormState> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const email = str(form, "email");
  const password = String(form.get("password") ?? "");
  if (!email || !password) return { error: "이메일과 비밀번호를 입력해 주세요." };
  const sb = await createClient();
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) return { error: friendly(error.message) };
  redirect(safeNext(form.get("next")));
}

export async function signUpAction(_: FormState, form: FormData): Promise<FormState> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const email = str(form, "email");
  const password = String(form.get("password") ?? "");
  const nickname = str(form, "nickname");
  if (!/^[0-9A-Za-z가-힣_]{2,14}$/.test(nickname)) return { error: "닉네임은 한글/영문/숫자/밑줄 2~14자로 입력해 주세요." };
  if (!email.includes("@")) return { error: "올바른 이메일을 입력해 주세요." };
  if (password.length < 8) return { error: "비밀번호는 8자 이상이어야 합니다." };
  if (form.get("agree") !== "on") return { error: "이용약관 및 개인정보 처리방침에 동의해 주세요." };

  const sb = await createClient();
  const { data: taken } = await sb.from("profiles").select("id").eq("nickname", nickname).maybeSingle();
  if (taken) return { error: "이미 사용 중인 닉네임입니다." };

  const { data, error } = await sb.auth.signUp({
    email,
    password,
    options: { data: { nickname }, emailRedirectTo: `${await origin()}/auth/callback` },
  });
  if (error) return { error: friendly(error.message) };
  if (!data.session) return { message: "인증 메일을 보냈습니다. 메일의 링크를 눌러 가입을 완료해 주세요." };
  redirect("/");
}

export async function googleAction(form: FormData) {
  if (!isSupabaseConfigured) redirect("/login?error=config");
  const sb = await createClient();
  const next = safeNext(form.get("next"));
  const { data, error } = await sb.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${await origin()}/auth/callback?next=${encodeURIComponent(next)}` },
  });
  if (error || !data.url) redirect("/login?error=oauth");
  redirect(data.url);
}

export async function resetRequestAction(_: FormState, form: FormData): Promise<FormState> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const email = str(form, "email");
  if (!email.includes("@")) return { error: "올바른 이메일을 입력해 주세요." };
  const sb = await createClient();
  await sb.auth.resetPasswordForEmail(email, { redirectTo: `${await origin()}/auth/callback?next=/reset-password` });
  // 가입 여부를 노출하지 않도록 항상 같은 메시지
  return { message: "입력하신 주소로 가입된 계정이 있다면 재설정 메일을 보냈습니다." };
}

export async function updatePasswordAction(_: FormState, form: FormData): Promise<FormState> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const password = String(form.get("password") ?? "");
  if (password.length < 8) return { error: "비밀번호는 8자 이상이어야 합니다." };
  const sb = await createClient();
  const { error } = await sb.auth.updateUser({ password });
  if (error) return { error: friendly(error.message) };
  redirect("/me?tab=settings");
}

export async function signOutAction() {
  if (isSupabaseConfigured) {
    const sb = await createClient();
    await sb.auth.signOut();
  }
  redirect("/");
}
