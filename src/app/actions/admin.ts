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
type Kind = "post-status" | "comment-status" | "report-status" | "user-status" | "post-delete" | "comment-delete";

export async function adminAction(kind: Kind, id: string, value?: string): Promise<Result> {
  if (!isSupabaseConfigured) return { ok: false, error: "Supabase 가 설정되지 않았습니다." };
  if (!UUID_RE.test(id)) return { ok: false, error: "잘못된 요청입니다." };
  const sb = await createClient();
  const { data } = await sb.auth.getUser();
  if (!data.user) return { ok: false, error: "login" };

  let error: { message: string } | null = null;
  switch (kind) {
    case "post-status":
      if (value !== "published" && value !== "hidden") return { ok: false, error: "잘못된 값입니다." };
      ({ error } = await sb.rpc("admin_set_post_status", { p_id: id, p_status: value }));
      break;
    case "comment-status":
      if (value !== "published" && value !== "hidden") return { ok: false, error: "잘못된 값입니다." };
      ({ error } = await sb.rpc("admin_set_comment_status", { p_id: id, p_status: value }));
      break;
    case "report-status":
      if (value !== "resolved" && value !== "dismissed" && value !== "pending") return { ok: false, error: "잘못된 값입니다." };
      ({ error } = await sb.rpc("admin_set_report_status", { p_id: id, p_status: value }));
      break;
    case "user-status":
      if (value !== "active" && value !== "suspended") return { ok: false, error: "잘못된 값입니다." };
      ({ error } = await sb.rpc("admin_set_user_status", { p_id: id, p_status: value }));
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
  if (error) return { ok: false, error: /forbidden|42501/.test(error.message) ? "관리자 권한이 필요합니다." : "처리하지 못했습니다." };
  revalidatePath("/admin");
  revalidatePath("/community");
  return { ok: true };
}
