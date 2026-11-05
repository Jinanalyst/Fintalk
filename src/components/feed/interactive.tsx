"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowBigDown, ArrowBigUp, Bookmark, Flag, Share2, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/common/toast";
import { reportAction, toggleSaveAction, toggleWatchAction, votePostAction } from "@/app/actions/community";

type Res = { ok: boolean; error?: string };

/** 서버 액션 결과 처리: 로그인 필요 → 로그인 화면으로, 그 외 오류는 토스트 */
export function useGuard() {
  const { show } = useToast();
  const router = useRouter();
  return (r: Res) => {
    if (r.ok) return true;
    if (r.error === "login") {
      show("로그인이 필요합니다.");
      router.push("/login");
    } else show(r.error ?? "오류가 발생했습니다.");
    return false;
  };
}

/**
 * 추천/비추천. `postId` 가 있으면 서버에 저장(Supabase), 없으면 샘플 데이터라 화면 내 상태만 변경합니다.
 */
export function VoteBar({
  up,
  down = 0,
  vertical = false,
  postId,
  initial = 0,
}: {
  up: number;
  down?: number;
  vertical?: boolean;
  postId?: string;
  initial?: 0 | 1 | -1;
}) {
  const [v, setV] = useState<0 | 1 | -1>(initial);
  const [pending, start] = useTransition();
  const guard = useGuard();
  // 서버 집계에는 내 기존 투표(initial)가 이미 포함되어 있으므로 변화분만 더합니다.
  const score = up - down + (v - initial);

  const change = (next: 0 | 1 | -1) => {
    const prev = v;
    setV(next);
    if (!postId) return;
    start(async () => {
      const r = await votePostAction(postId, next);
      if (!guard(r)) setV(prev);
    });
  };

  return (
    <div className={cn("flex items-center gap-1", vertical && "flex-col")}>
      <button
        aria-label="추천"
        aria-pressed={v === 1}
        disabled={pending}
        onClick={() => change(v === 1 ? 0 : 1)}
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
        disabled={pending}
        onClick={() => change(v === -1 ? 0 : -1)}
        className={cn("rounded-md p-1 hover:bg-muted", v === -1 ? "text-down" : "text-muted-foreground")}
      >
        <ArrowBigDown className={cn("size-5", v === -1 && "fill-current")} />
      </button>
    </div>
  );
}

const REASONS = ["스팸/광고", "욕설/비방", "허위·과장 투자 권유", "개인정보 노출", "기타"];

export function ReportMenu({ type, id, compact = false }: { type: "post" | "comment"; id: string; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const { show } = useToast();
  const guard = useGuard();
  return (
    <span className="relative">
      <button
        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <Flag className="size-3.5" />
        {!compact && "신고"}
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-1 w-44 rounded-lg border bg-popover p-1 text-xs shadow-lg">
          {REASONS.map((r) => (
            <button
              key={r}
              className="block w-full rounded px-2 py-1.5 text-left hover:bg-muted"
              onClick={async () => {
                setOpen(false);
                if (guard(await reportAction(type, id, r))) show("신고가 접수되었습니다. 검토 후 조치하겠습니다.");
              }}
            >
              {r}
            </button>
          ))}
        </div>
      )}
    </span>
  );
}

export function PostActions({
  id,
  compact = false,
  live = false,
  saved: initialSaved = false,
}: {
  id: string;
  compact?: boolean;
  live?: boolean;
  saved?: boolean;
}) {
  const [saved, setSaved] = useState(initialSaved);
  const { show, comingSoon } = useToast();
  const guard = useGuard();
  const btn =
    "inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground";
  return (
    <div className="flex items-center gap-0.5">
      <button
        className={cn(btn, saved && "text-brand")}
        onClick={async () => {
          const next = !saved;
          if (!live) {
            setSaved(next);
            show(next ? "저장했습니다 (샘플 게시글)" : "저장을 취소했습니다 (샘플 게시글)");
            return;
          }
          setSaved(next);
          if (!guard(await toggleSaveAction(id, next))) setSaved(!next);
          else show(next ? "저장했습니다." : "저장을 취소했습니다.");
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
      {live ? (
        <ReportMenu type="post" id={id} compact={compact} />
      ) : (
        <button className={btn} onClick={() => comingSoon("샘플 게시글 신고")}>
          <Flag className="size-3.5" />
          {!compact && "신고"}
        </button>
      )}
    </div>
  );
}

export function WatchStar({ symbol, initial = false, live = false }: { symbol: string; initial?: boolean; live?: boolean }) {
  const [on, setOn] = useState(initial);
  const { show } = useToast();
  const guard = useGuard();
  return (
    <button
      aria-label={`${symbol} 관심 종목`}
      aria-pressed={on}
      onClick={async () => {
        const next = !on;
        setOn(next);
        if (!live) {
          show(next ? "관심 종목에 추가했습니다." : "관심 종목에서 제거했습니다.");
          return;
        }
        if (!guard(await toggleWatchAction(symbol, next))) setOn(!next);
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
