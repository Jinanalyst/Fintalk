"use client";

import { useState } from "react";
import { CheckCircle2, Clock, MessageSquare, Users, TrendingDown, TrendingUp, XCircle } from "lucide-react";
import { type Challenge } from "@/lib/sample-data";
import { SplitBar } from "@/components/market/charts";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/common/toast";

export function ChallengeCard({ c }: { c: Challenge }) {
  const [pick, setPick] = useState<"up" | "down" | null>(null);
  const { show } = useToast();
  const total = c.participants + (pick ? 1 : 0);
  const upCount = Math.round((c.participants * c.upPct) / 100) + (pick === "up" ? 1 : 0);
  const upPct = Math.round((upCount / total) * 100);
  const open = c.status === "open";

  return (
    <article className="rounded-xl border bg-card p-4 shadow-xs">
      <div className="mb-2 flex items-center justify-between text-xs">
        <span className="rounded bg-brand-soft px-1.5 py-0.5 font-semibold text-brand">${c.asset}</span>
        {open ? (
          <span className="inline-flex items-center gap-1 text-muted-foreground"><Clock className="size-3.5" />마감 {c.endTime}</span>
        ) : (
          <span className="rounded bg-muted px-1.5 py-0.5 font-medium text-muted-foreground">종료</span>
        )}
      </div>
      <h3 className="text-base font-bold leading-snug">{c.question}</h3>

      {open ? (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            onClick={() => { setPick("up"); show("투표했습니다 (샘플 · 서버 저장은 Phase 4, 로그인 필요)"); }}
            className={cn("inline-flex items-center justify-center gap-1.5 rounded-lg border py-2.5 text-sm font-semibold transition-colors",
              pick === "up" ? "border-up bg-up text-white" : "border-up/40 text-up hover:bg-up/10")}
          >
            <TrendingUp className="size-4" /> 상승
          </button>
          <button
            onClick={() => { setPick("down"); show("투표했습니다 (샘플 · 서버 저장은 Phase 4, 로그인 필요)"); }}
            className={cn("inline-flex items-center justify-center gap-1.5 rounded-lg border py-2.5 text-sm font-semibold transition-colors",
              pick === "down" ? "border-down bg-down text-white" : "border-down/40 text-down hover:bg-down/10")}
          >
            <TrendingDown className="size-4" /> 하락
          </button>
        </div>
      ) : (
        <div className={cn("mt-3 flex items-center gap-2 rounded-lg p-2.5 text-sm font-semibold", c.result === "up" ? "bg-up/10 text-up" : "bg-down/10 text-down")}>
          {c.result === "up" ? <CheckCircle2 className="size-4" /> : <XCircle className="size-4" />}
          결과: {c.result === "up" ? "상승" : "하락"} <span className="font-normal text-muted-foreground">· {c.resultNote}</span>
        </div>
      )}

      <div className="mt-3">
        <SplitBar up={upPct} />
        <div className="mt-1 flex justify-between text-xs tabular-nums">
          <span className="text-up">상승 {upPct}%</span>
          <span className="text-down">하락 {100 - upPct}%</span>
        </div>
      </div>

      <dl className="mt-3 space-y-0.5 border-t pt-3 text-xs text-muted-foreground">
        <div className="flex justify-between"><dt>기준 가격</dt><dd className="text-foreground">{c.basePrice}</dd></div>
        <div className="flex justify-between"><dt>기준 시각</dt><dd className="text-foreground">{c.baseTime}</dd></div>
        <div className="flex justify-between"><dt>종료 시각</dt><dd className="text-foreground">{c.endTime}</dd></div>
        <div className="flex justify-between gap-4"><dt className="shrink-0">판정 출처</dt><dd className="text-right text-foreground">{c.source}</dd></div>
      </dl>

      <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1"><Users className="size-3.5" />{total.toLocaleString("ko-KR")}명 참여</span>
        <span className="inline-flex items-center gap-1"><MessageSquare className="size-3.5" />토론 {c.comments}</span>
      </div>
    </article>
  );
}
