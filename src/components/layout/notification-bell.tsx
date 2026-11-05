"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { timeAgo } from "@/lib/time";
import { useToast } from "@/components/common/toast";

type N = { id: string; type: "comment" | "reply"; actor_name: string; post_id: string | null; snippet: string; read: boolean; created_at: string };

/** 로그인 사용자의 댓글·답글 알림. 30초마다, 그리고 창으로 돌아올 때 새로 확인합니다. */
export function NotificationBell({ userId }: { userId: string }) {
  const router = useRouter();
  const { show } = useToast();
  const [items, setItems] = useState<N[]>([]);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const seen = useRef<Set<string> | null>(null);

  const load = useCallback(async () => {
    const sb = createClient();
    const { data } = await sb
      .from("notifications")
      .select("id,type,actor_name,post_id,snippet,read,created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20);
    if (!data) return;
    const list = data as N[];
    // 처음 불러올 때를 제외하고 새로 도착한 안 읽은 알림이 있으면 토스트로 알림
    if (seen.current) {
      const fresh = list.find((n) => !n.read && !seen.current!.has(n.id));
      if (fresh) show(`${fresh.actor_name}님이 ${fresh.type === "reply" ? "내 댓글에 답글을" : "내 글에 댓글을"} 남겼습니다.`);
    }
    seen.current = new Set(list.map((n) => n.id));
    setItems(list);
  }, [userId, show]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    const t = setInterval(() => document.visibilityState === "visible" && load(), 30000);
    const onVis = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const unread = items.filter((n) => !n.read).length;

  async function markRead(ids: string[]) {
    if (ids.length === 0) return;
    setItems((cur) => cur.map((n) => (ids.includes(n.id) ? { ...n, read: true } : n)));
    await createClient().from("notifications").update({ read: true }).in("id", ids);
  }

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        aria-label={unread ? `알림 ${unread}개` : "알림"}
        aria-expanded={open}
        onClick={() => {
          setOpen((v) => !v);
          if (!open) load();
        }}
        className="relative grid size-9 place-items-center rounded-md hover:bg-muted"
      >
        <Bell className="size-[18px]" />
        {unread > 0 && (
          <span className="absolute right-0.5 top-0.5 grid min-w-4 place-items-center rounded-full bg-down px-1 text-[10px] font-bold leading-4 text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="fixed inset-x-2 top-14 z-50 overflow-hidden rounded-xl border bg-card shadow-lg sm:absolute sm:inset-x-auto sm:right-0 sm:top-11 sm:w-80">
          <div className="flex items-center justify-between border-b px-3 py-2">
            <h2 className="text-sm font-bold">알림</h2>
            {unread > 0 && (
              <button className="text-xs text-brand hover:underline" onClick={() => markRead(items.filter((n) => !n.read).map((n) => n.id))}>
                모두 읽음
              </button>
            )}
          </div>
          {items.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">새 알림이 없습니다.</p>
          ) : (
            <ul className="max-h-96 divide-y overflow-y-auto">
              {items.map((n) => (
                <li key={n.id}>
                  <button
                    className={`block w-full px-3 py-2.5 text-left hover:bg-muted/60 ${n.read ? "" : "bg-brand-soft/40"}`}
                    onClick={() => {
                      markRead([n.id]);
                      setOpen(false);
                      if (n.post_id) router.push(`/community/${n.post_id}`);
                    }}
                  >
                    <p className="text-sm">
                      <b>{n.actor_name || "누군가"}</b>님이 {n.type === "reply" ? "내 댓글에 답글을" : "내 글에 댓글을"} 남겼습니다.
                    </p>
                    {n.snippet && <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">“{n.snippet}”</p>}
                    <p className="mt-0.5 text-[11px] text-muted-foreground">{timeAgo(n.created_at)}</p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
