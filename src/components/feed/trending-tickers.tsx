"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Flame } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getTrendingAction } from "@/app/actions/trending";
import type { TrendingTicker } from "@/lib/data/trending";

/**
 * 인기 종목 토론 (실시간). 글/댓글이 올라오면 Realtime 이벤트로, 그리고 30초마다 순위를 다시 계산합니다.
 * variant="strip": 가로 칩 (홈 피드 위) / "card": 사이드 카드
 */
export function TrendingTickers({ initial, live, variant, limit = 6 }: { initial: TrendingTicker[]; live: boolean; variant: "strip" | "card"; limit?: number }) {
  const [items, setItems] = useState(initial);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!live) return;
    let alive = true;
    const refresh = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const next = await getTrendingAction(limit);
        if (alive) setItems(next);
      } catch {}
    };
    const soon = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(refresh, 2000); // 조회수 등 잦은 이벤트를 묶어서 처리
    };
    const sb = createClient();
    const ch = sb
      .channel(`trending-${variant}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "posts" }, soon)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "comments" }, soon)
      .subscribe();
    const poll = setInterval(refresh, 30000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      alive = false;
      if (timer.current) clearTimeout(timer.current);
      clearInterval(poll);
      document.removeEventListener("visibilitychange", refresh);
      sb.removeChannel(ch);
    };
  }, [live, limit, variant]);

  const top = Math.max(1, ...items.map((i) => i.score));
  const dot = live && (
    <span className="relative flex size-2" title="실시간 집계">
      <span className="absolute inline-flex size-full animate-ping rounded-full bg-up/60" />
      <span className="relative inline-flex size-2 rounded-full bg-up" />
    </span>
  );
  const stat = (t: TrendingTicker) => (t.posts > 0 ? `글 ${t.posts} · 댓글 ${t.comments}` : "첫 토론을 열어 보세요");

  if (variant === "strip") {
    return (
      <section aria-label="인기 종목 토론">
        <div className="mb-2 flex items-center gap-2">
          <h2 className="inline-flex items-center gap-1.5 text-sm font-bold"><Flame className="size-4 text-down" />인기 종목 토론</h2>
          {dot}
          <span className="text-[11px] text-muted-foreground">최근 7일 · 지금 활발한 순</span>
        </div>
        <ol className="scrollbar-none -mx-3 flex gap-2 overflow-x-auto px-3 pb-1 sm:mx-0 sm:px-0">
          {items.map((t, i) => (
            <li key={t.symbol} className="shrink-0">
              <Link href={`/community?ticker=${encodeURIComponent(t.symbol)}`} className="block rounded-xl border bg-card px-3 py-2 shadow-xs hover:border-brand/50">
                <p className="flex items-center gap-1.5 text-sm font-bold">
                  <span className="text-xs text-brand">{i + 1}</span>
                  ${t.symbol}
                  {t.fresh > 0 && <span className="rounded bg-down/10 px-1 text-[10px] font-bold text-down">HOT</span>}
                </p>
                <p className="text-[11px] text-muted-foreground">{t.name !== t.symbol ? `${t.name} · ` : ""}{stat(t)}</p>
              </Link>
            </li>
          ))}
        </ol>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border bg-card p-4 shadow-xs" aria-label="인기 종목 토론">
      <div className="flex items-center gap-2">
        <h2 className="inline-flex items-center gap-1.5 text-sm font-bold"><Flame className="size-4 text-down" />인기 종목 토론</h2>
        {dot}
      </div>
      <p className="mt-0.5 text-[11px] text-muted-foreground">최근 7일 글·댓글·추천 기준, 지금 활발한 순</p>
      <ol className="mt-3 space-y-2.5">
        {items.map((t, i) => (
          <li key={t.symbol}>
            <Link href={`/community?ticker=${encodeURIComponent(t.symbol)}`} className="group block">
              <div className="flex items-center gap-2">
                <span className="w-4 text-center text-sm font-bold text-brand">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate text-sm font-semibold group-hover:text-brand">
                  ${t.symbol} <span className="font-normal text-muted-foreground">{t.name !== t.symbol ? t.name : ""}</span>
                </span>
                {t.fresh > 0 && <span className="rounded bg-down/10 px-1 text-[10px] font-bold text-down">HOT</span>}
              </div>
              <div className="ml-6 mt-1 flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-brand transition-all duration-500" style={{ width: `${Math.max(4, Math.round((t.score / top) * 100))}%` }} />
                </div>
                <span className="shrink-0 text-[11px] text-muted-foreground">{stat(t)}</span>
              </div>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
