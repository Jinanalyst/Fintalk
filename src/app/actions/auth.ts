"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export type FormState = { error?: string; message?: string };

const NOT_CONFIGURED: FormState = { error: "Supabase environment variables are not set on the server." };

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
  if (/invalid login/i.test(msg)) return "Incorrect email or password.";
  if (/email not confirmed/i.test(msg)) return "Email verification required. Please check your inbox.";
  if (/already registered|already been registered/i.test(msg)) return "This email is already registered.";
  if (/rate limit|too many/i.test(msg)) return "Too many requests. Please try again shortly.";
  if (/password/i.test(msg)) return "Password must be at least 8 characters.";
  return "Could not process the request. Please try again shortly.";
}

export async function signInAction(_: FormState, form: FormData): Promise<FormState> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const email = str(form, "email");
  const password = String(form.get("password") ?? "");
  if (!email || !password) return { error: "Enter your email and password." };
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
  if (!/^[0-9A-Za-z가-힣_]{2,14}$/.test(nickname)) return { error: "Nickname must be 2-14 letters, numbers or underscores." };
  if (!email.includes("@")) return { error: "Enter a valid email address." };
  if (password.length < 8) return { error: "Password must be at least 8 characters." };
  if (form.get("agree") !== "on") return { error: "Please accept the Terms of Service and Privacy Policy." };

  const sb = await createClient();
  const { data: taken } = await sb.from("profiles").select("id").eq("nickname", nickname).maybeSingle();
  if (taken) return { error: "That nickname is already taken." };

  const { data, error } = await sb.auth.signUp({
    email,
    password,
    options: { data: { nickname }, emailRedirectTo: `${await origin()}/auth/callback` },
  });
  if (error) return { error: friendly(error.message) };
  if (!data.session) return { message: "We sent a verification email. Click the link in it to finish signing up." };
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
  if (!email.includes("@")) return { error: "Enter a valid email address." };
  const sb = await createClient();
  await sb.auth.resetPasswordForEmail(email, { redirectTo: `${await origin()}/auth/callback?next=/reset-password` });
  // 가입 여부를 노출하지 않도록 항상 같은 메시지
  return { message: "If an account exists for that address, we sent a reset email." };
}

export async function updatePasswordAction(_: FormState, form: FormData): Promise<FormState> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const password = String(form.get("password") ?? "");
  if (password.length < 8) return { error: "Password must be at least 8 characters." };
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
