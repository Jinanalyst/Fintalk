"use client";

import { useState } from "react";
import { ArrowBigDown, ArrowBigUp, Bookmark, Flag, Share2, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/common/toast";

/** 추천/비추천 (Phase 1: 화면 내 상태만 변경, 서버 저장 없음) */
export function VoteBar({ up, down = 0, vertical = false }: { up: number; down?: number; vertical?: boolean }) {
  const [v, setV] = useState<0 | 1 | -1>(0);
  const score = up - down + v;
  return (
    <div className={cn("flex items-center gap-1", vertical && "flex-col")}>
      <button
        aria-label="추천"
        aria-pressed={v === 1}
        onClick={() => setV(v === 1 ? 0 : 1)}
        className={cn("rounded-md p-1 hover:bg-muted", v === 1 ? "text-brand" : "text-muted-foreground")}
      >
        <ArrowBigUp className={cn("size-5", v === 1 && "fill-current")} />
      </button>
      <span className={cn("min-w-6 text-center text-sm font-bold tabular-nums", v === 1 && "text-brand", v === -1 && "text-down")}>
        {score}
      </span>
      <button
        aria-label="비추천"
        aria-pressed={v === -1}
        onClick={() => setV(v === -1 ? 0 : -1)}
        className={cn("rounded-md p-1 hover:bg-muted", v === -1 ? "text-down" : "text-muted-foreground")}
      >
        <ArrowBigDown className={cn("size-5", v === -1 && "fill-current")} />
      </button>
    </div>
  );
}

export function PostActions({ id, compact = false }: { id: string; compact?: boolean }) {
  const [saved, setSaved] = useState(false);
  const { show, comingSoon } = useToast();
  const btn =
    "inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground";
  return (
    <div className="flex items-center gap-0.5">
      <button
        className={cn(btn, saved && "text-brand")}
        onClick={() => {
          setSaved(!saved);
          show(saved ? "저장을 취소했습니다 (샘플)" : "저장했습니다 (샘플 · 서버 저장은 Phase 2)");
        }}
      >
        <Bookmark className={cn("size-3.5", saved && "fill-current")} />
        {!compact && "저장"}
      </button>
      <button
        className={btn}
        onClick={async () => {
          const url = `${window.location.origin}/community/${id}`;
          try {
            await navigator.clipboard.writeText(url);
            show("링크를 복사했습니다.");
          } catch {
            show(url);
          }
        }}
      >
        <Share2 className="size-3.5" />
        {!compact && "공유"}
      </button>
      <button className={btn} onClick={() => comingSoon("신고")}>
        <Flag className="size-3.5" />
        {!compact && "신고"}
      </button>
    </div>
  );
}

export function WatchStar({ symbol }: { symbol: string }) {
  const [on, setOn] = useState(false);
  const { show } = useToast();
  return (
    <button
      aria-label={`${symbol} 관심 종목`}
      aria-pressed={on}
      onClick={() => {
        setOn(!on);
        show(on ? "관심 종목에서 제거 (샘플)" : "관심 종목에 추가 (샘플 · 저장은 Phase 3)");
      }}
      className={cn("rounded-md p-1 hover:bg-muted", on ? "text-amber-500" : "text-muted-foreground")}
    >
      <Star className={cn("size-4", on && "fill-current")} />
    </button>
  );
}

export function FollowButton({ small = false }: { small?: boolean }) {
  const [on, setOn] = useState(false);
  return (
    <button
      onClick={() => setOn(!on)}
      className={cn(
        "rounded-full border px-3 font-medium transition-colors",
        small ? "py-0.5 text-xs" : "py-1.5 text-sm",
        on ? "bg-muted text-muted-foreground" : "border-brand bg-brand text-primary-foreground hover:opacity-90",
      )}
    >
      {on ? "팔로잉" : "팔로우"}
    </button>
  );
}

export function ComingSoonButton({
  feature,
  children,
  className,
}: {
  feature: string;
  children: React.ReactNode;
  className?: string;
}) {
  const { comingSoon } = useToast();
  return (
    <button type="button" className={className} onClick={() => comingSoon(feature)}>
      {children}
    </button>
  );
}
