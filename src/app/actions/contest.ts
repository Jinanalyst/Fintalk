"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { UUID_RE } from "@/lib/data/community";
import { COUNTRIES, UID_RE, countryFromHeaders, isBlockedCountry } from "@/lib/contest";
import type { Result } from "./community";

const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });

/** Submit the OKX UID and country of residence for the contest. */
export async function submitContestEntryAction(input: { uid: string; country: string; agree: boolean }): Promise<Result> {
  if (!isSupabaseConfigured) return fail("The server is not configured yet.");
  const uid = String(input.uid ?? "").trim();
  const country = String(input.country ?? "").toUpperCase();
  if (!input.agree) return fail("Please accept the contest rules to continue.");
  if (!UID_RE.test(uid)) return fail("Enter a valid OKX UID (6-20 digits).");
  if (!COUNTRIES.some((c) => c.code === country)) return fail("Select your country of residence.");

  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return fail("login");

  // IP-based check as well as the selected residence.
  const ipCountry = countryFromHeaders(await headers());
  if (isBlockedCountry(country) || isBlockedCountry(ipCountry)) {
    await sb.rpc("contest_log_block", { p_country: isBlockedCountry(country) ? country : (ipCountry ?? ""), p_detail: "entry blocked" });
    return fail("Residents of your country are not eligible for this contest.");
  }

  const { error } = await sb.rpc("contest_submit_entry", { p_uid: uid, p_country: country });
  if (error) {
    const m = error.message ?? "";
    if (error.code === "23505") return fail("This OKX UID is already registered.");
    if (error.code === "P0001") return fail(m);
    console.error("[contest] submit error:", error.code, m);
    return fail("We couldn't save your entry. Please try again.");
  }
  revalidatePath("/contest");
  return { ok: true };
}

/** Admin: verify / reject / reset an entry. Authorization is enforced by the DB (is_admin()). */
export async function adminContestAction(userId: string, status: string, note?: string): Promise<Result> {
  if (!isSupabaseConfigured) return fail("The server is not configured yet.");
  if (!UUID_RE.test(userId)) return fail("Invalid request.");
  if (status !== "verified" && status !== "rejected" && status !== "pending") return fail("Invalid value.");
  const sb = await createClient();
  const { data } = await sb.auth.getUser();
  if (!data.user) return fail("login");
  const { error } = await sb.rpc("admin_set_contest_entry", { p_user: userId, p_status: status, p_note: note ?? null });
  if (error) return fail(/forbidden|42501/.test(error.message) ? "Admin permission required." : "Could not process the request.");
  revalidatePath("/admin");
  revalidatePath("/contest");
  return { ok: true };
}
