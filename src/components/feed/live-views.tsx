"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { incrementViewsAction } from "@/app/actions/community";

type Listener = (views: number) => void;
const listeners = new Map<string, Set<Listener>>();
let channel: ReturnType<ReturnType<typeof createClient>["channel"]> | null = null;

/** 화면의 모든 조회수가 하나의 Realtime 채널을 공유합니다. (posts UPDATE 이벤트) */
function subscribe(id: string, cb: Listener) {
  const set = listeners.get(id) ?? new Set<Listener>();
  set.add(cb);
  listeners.set(id, set);
  if (!channel) {
    const sb = createClient();
    channel = sb
      .channel("post-views")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "posts" }, (payload) => {
        const row = payload.new as { id?: string; views?: number };
        if (row.id && typeof row.views === "number") listeners.get(row.id)?.forEach((fn) => fn(row.views as number));
      })
      .subscribe();
  }
  return () => {
    set.delete(cb);
    if (set.size === 0) listeners.delete(id);
    if (listeners.size === 0 && channel) {
      createClient().removeChannel(channel);
      channel = null;
    }
  };
}

/** 조회수 숫자. live 이면 다른 사람이 글을 볼 때마다 실시간으로 올라갑니다. */
export function LiveViews({ postId, initial, live = false }: { postId: string; initial: number; live?: boolean }) {
  const [rt, setRt] = useState(0);
  useEffect(() => (live ? subscribe(postId, setRt) : undefined), [postId, live]);
  return <>{Math.max(rt, initial).toLocaleString("ko-KR")}</>;
}

/** 글을 열 때 조회수를 1회 올립니다. (새로고침·자동 갱신으로 중복 집계되지 않도록 탭당 글마다 1회) */
export function ViewCounter({ postId }: { postId: string }) {
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    const key = `viewed:${postId}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {}
    incrementViewsAction(postId);
  }, [postId]);
  return null;
}
