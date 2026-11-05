"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export type ViewUser = { id: string; nickname: string; role: string; avatar_url: string | null } | null;

/** undefined = 확인 중, null = 비로그인 */
export function useUser(): ViewUser | undefined {
  const [user, setUser] = useState<ViewUser | undefined>(isSupabaseConfigured ? undefined : null);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const sb = createClient();
    let alive = true;
    const load = async (id: string | undefined) => {
      if (!id) return alive && setUser(null);
      const { data } = await sb.from("profiles").select("nickname,role,avatar_url").eq("id", id).maybeSingle();
      if (alive) setUser(data ? { id, nickname: data.nickname, role: data.role, avatar_url: data.avatar_url ?? null } : null);
    };
    sb.auth.getUser().then(({ data }) => load(data.user?.id));
    const { data: sub } = sb.auth.onAuthStateChange((_e, session) => {
      // 콜백 안에서 바로 supabase 호출 시 교착 가능성이 있어 다음 틱으로 미룸
      setTimeout(() => load(session?.user?.id), 0);
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return user;
}
