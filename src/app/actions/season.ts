"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { Result } from "./community";

/** Enter the current season (for users who signed up before it opened, or whose auto-join failed). */
export async function joinSeasonAction(): Promise<Result> {
  if (!isSupabaseConfigured) return { ok: false, error: "The server is not configured yet." };
  const sb = await createClient();
  const { data } = await sb.auth.getClaims();
  if (!data?.claims?.sub) return { ok: false, error: "Login required." };
  const { error } = await sb.rpc("contest_join_current");
  if (error) {
    const m = error.message ?? "";
    if (/closed|No season|restricted/i.test(m)) return { ok: false, error: m };
    console.error("[season] join failed:", error.code, m);
    return { ok: false, error: "Could not join right now. Please try again." };
  }
  revalidatePath("/trade");
  revalidatePath("/");
  revalidatePath("/leaderboard");
  return { ok: true };
}
