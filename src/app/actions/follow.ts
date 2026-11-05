"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { UUID_RE } from "@/lib/data/community";

type Result = { ok: true } | { ok: false; error: string };

/** 크리에이터 팔로우 / 언팔로우. 본인 팔로우는 막습니다. (RLS: follower_id = auth.uid()) */
export async function toggleFollowAction(followeeId: string, follow: boolean): Promise<Result> {
  if (!isSupabaseConfigured) return { ok: false, error: "서버에 Supabase 환경변수가 설정되지 않았습니다." };
  if (!UUID_RE.test(followeeId)) return { ok: false, error: "잘못된 요청입니다." };
  const sb = await createClient();
  const { data } = await sb.auth.getUser();
  if (!data.user) return { ok: false, error: "login" };
  if (data.user.id === followeeId) return { ok: false, error: "자기 자신은 팔로우할 수 없습니다." };

  const { error } = follow
    ? await sb.from("follows").upsert({ follower_id: data.user.id, followee_id: followeeId }, { onConflict: "follower_id,followee_id", ignoreDuplicates: true })
    : await sb.from("follows").delete().eq("follower_id", data.user.id).eq("followee_id", followeeId);
  if (error) return { ok: false, error: "요청을 처리하지 못했습니다." };
  revalidatePath("/creators");
  return { ok: true };
}
