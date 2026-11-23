import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";

/** 로그인·가입 직후 기본으로 가는 곳 */
export const AFTER_LOGIN = "/trade";

/** Invite code from a `?ref=` link, kept by src/proxy.ts until the visitor signs up. */
export const REF_COOKIE = "ft_ref";
export const REF_RE = /^[A-Za-z0-9_-]{4,32}$/;

/**
 * Runs right after a successful sign-in / sign-up (email, Google, X):
 *  1. links the invite code from the `ft_ref` cookie (only for brand-new accounts; the DB checks that),
 *  2. enters the user into the featured season if registration is open.
 * Both are best-effort: failures (e.g. migration not applied yet) never block the login.
 * Must be called from a Server Function or Route Handler (it deletes a cookie).
 */
export async function afterSignIn(sb: SupabaseClient) {
  const jar = await cookies();
  const code = jar.get(REF_COOKIE)?.value;
  if (code && REF_RE.test(code)) {
    const { error } = await sb.rpc("referral_claim", { p_code: code });
    if (error) console.error("[referral] claim failed:", error.message);
  }
  if (code) jar.delete(REF_COOKIE);

  const { error } = await sb.rpc("contest_join_current");
  if (error && !/registration|not open|no season/i.test(error.message)) console.error("[contest] auto-join failed:", error.message);
}
