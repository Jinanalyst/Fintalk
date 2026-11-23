"use client";

import { useSyncExternalStore } from "react";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export type ViewUser = { id: string; nickname: string; role: string; avatar_url: string | null } | null;

// 헤더·상단 메뉴·하단 탭바가 함께 쓰므로 로그인 정보는 한 번만 불러와 공유합니다.
let current: ViewUser | undefined = isSupabaseConfigured ? undefined : null;
const listeners = new Set<() => void>();
let started = false;

function publish(u: ViewUser) {
  current = u;
  listeners.forEach((l) => l());
}

function start() {
  if (started || !isSupabaseConfigured) return;
  started = true;
  const sb = createClient();
  let lastId: string | undefined | null = null;
  const load = async (id: string | undefined) => {
    if (id === lastId && current !== undefined) return;
    lastId = id;
    if (!id) return publish(null);
    const { data } = await sb.from("profiles").select("nickname,role,avatar_url").eq("id", id).maybeSingle();
    publish(data ? { id, nickname: data.nickname, role: data.role, avatar_url: data.avatar_url ?? null } : null);
  };
  sb.auth.getUser().then(({ data }) => load(data.user?.id));
  sb.auth.onAuthStateChange((_e, session) => {
    // 콜백 안에서 바로 supabase 호출 시 교착 가능성이 있어 다음 틱으로 미룸
    setTimeout(() => load(session?.user?.id), 0);
  });
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  start();
  return () => {
    listeners.delete(cb);
  };
}

const serverSnapshot = () => (isSupabaseConfigured ? undefined : null);

/** undefined = 확인 중, null = 비로그인 */
export function useUser(): ViewUser | undefined {
  return useSyncExternalStore(subscribe, () => current, serverSnapshot);
}
