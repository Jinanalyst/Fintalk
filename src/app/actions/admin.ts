"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { UUID_RE } from "@/lib/data/community";
import type { Result } from "./community";

/**
 * 관리자 작업. 실제 권한 검사는 DB 함수(is_admin()) 와 RLS 가 수행하므로
 * 일반 사용자가 이 액션을 직접 호출해도 'forbidden' 으로 거부됩니다.
 */
type Kind = "post-status" | "comment-status" | "report-status" | "user-status" | "post-delete" | "comment-delete" | "contest-entry";

export async function adminAction(kind: Kind, id: string, value?: string): Promise<Result> {
  if (!isSupabaseConfigured) return { ok: false, error: "Supabase is not configured." };
  if (!UUID_RE.test(id)) return { ok: false, error: "Invalid request." };
  const sb = await createClient();
  const { data } = await sb.auth.getUser();
  if (!data.user) return { ok: false, error: "login" };

  let error: { message: string } | null = null;
  switch (kind) {
    case "post-status":
      if (value !== "published" && value !== "hidden") return { ok: false, error: "Invalid value." };
      ({ error } = await sb.rpc("admin_set_post_status", { p_id: id, p_status: value }));
      break;
    case "comment-status":
      if (value !== "published" && value !== "hidden") return { ok: false, error: "Invalid value." };
      ({ error } = await sb.rpc("admin_set_comment_status", { p_id: id, p_status: value }));
      break;
    case "report-status":
      if (value !== "resolved" && value !== "dismissed" && value !== "pending") return { ok: false, error: "Invalid value." };
      ({ error } = await sb.rpc("admin_set_report_status", { p_id: id, p_status: value }));
      break;
    case "user-status":
      if (value !== "active" && value !== "suspended") return { ok: false, error: "Invalid value." };
      ({ error } = await sb.rpc("admin_set_user_status", { p_id: id, p_status: value }));
      break;
    case "contest-entry":
      if (value !== "verified" && value !== "rejected" && value !== "pending") return { ok: false, error: "Invalid value." };
      ({ error } = await sb.rpc("admin_set_contest_entry", { p_user: id, p_status: value }));
      break;
    case "post-delete": {
      const r = await sb.from("posts").delete().eq("id", id).select("id");
      if (!r.error && !r.data?.length) error = { message: "forbidden" };
      else error = r.error;
      break;
    }
    case "comment-delete": {
      const r = await sb.from("comments").delete().eq("id", id).select("id");
      if (!r.error && !r.data?.length) error = { message: "forbidden" };
      else error = r.error;
      break;
    }
  }
  if (error) return { ok: false, error: /forbidden|42501/.test(error.message) ? "Admin permission required." : "Could not process the request." };
  revalidatePath("/admin");
  revalidatePath("/community");
  return { ok: true };
}

export type NewContestInput = {
  number: number;
  name: string;
  startsAt: string; // ISO (UTC)
  endsAt: string; // ISO (UTC)
  prizes: [number, number, number];
  startingBalance: number;
  minTrades: number;
  mddLimit: number;
  freezeLast24h: boolean;
  featured: boolean;
};

const contestError = (message: string) => {
  if (/forbidden|42501/.test(message)) return "Admin permission required.";
  if (/already exists|must be after|not found/i.test(message)) return message;
  if (/admin_create_contest|admin_feature_contest|featured/.test(message)) return "Run supabase/migrations/20261129_contest_rounds.sql first.";
  return "Could not process the request.";
};

function revalidateContests() {
  revalidatePath("/");
  revalidatePath("/contests");
  revalidatePath("/contest");
  revalidatePath("/admin");
}

/** 새 대회 회차 생성 (권한 검사는 DB 함수 admin_create_contest 가 수행) */
export async function createContestAction(input: NewContestInput): Promise<Result> {
  if (!isSupabaseConfigured) return { ok: false, error: "Supabase is not configured." };
  const start = Date.parse(input.startsAt);
  const end = Date.parse(input.endsAt);
  const nums = [input.number, ...input.prizes, input.startingBalance, input.minTrades, input.mddLimit];
  if (!Number.isFinite(start) || !Number.isFinite(end)) return { ok: false, error: "Enter a start and end time." };
  if (end <= start) return { ok: false, error: "The end must be after the start." };
  if (nums.some((n) => !Number.isFinite(n) || n < 0) || !Number.isInteger(input.number) || input.number < 1) return { ok: false, error: "Check the numbers." };
  if (input.startingBalance <= 0 || input.mddLimit <= 0 || input.mddLimit > 100) return { ok: false, error: "Check the start balance and MDD limit." };
  if (input.name.length > 120) return { ok: false, error: "The name is too long." };

  const sb = await createClient();
  const { data } = await sb.auth.getUser();
  if (!data.user) return { ok: false, error: "login" };
  const { error } = await sb.rpc("admin_create_contest", {
    p_name: input.name.trim(),
    p_starts_at: new Date(start).toISOString(),
    p_ends_at: new Date(end).toISOString(),
    p_number: input.number,
    p_prize_1: input.prizes[0],
    p_prize_2: input.prizes[1],
    p_prize_3: input.prizes[2],
    p_starting_balance: input.startingBalance,
    p_min_trades: Math.round(input.minTrades),
    p_mdd_limit: input.mddLimit,
    p_freeze_last_24h: input.freezeLast24h,
    p_featured: input.featured,
  });
  if (error) return { ok: false, error: contestError(error.message) };
  revalidateContests();
  return { ok: true };
}

/** 홈 배너에 띄울 회차 지정 */
export async function featureContestAction(id: string): Promise<Result> {
  if (!isSupabaseConfigured) return { ok: false, error: "Supabase is not configured." };
  if (!/^\d+$/.test(id)) return { ok: false, error: "Invalid request." };
  const sb = await createClient();
  const { data } = await sb.auth.getUser();
  if (!data.user) return { ok: false, error: "login" };
  const { error } = await sb.rpc("admin_feature_contest", { p_id: Number(id) });
  if (error) return { ok: false, error: contestError(error.message) };
  revalidateContests();
  return { ok: true };
}
