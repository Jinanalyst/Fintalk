"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, SectionHeader } from "@/components/common/bits";
import { UserAvatar } from "@/components/common/user-avatar";
import type { RankRow } from "@/lib/data/community";
import { fmtNum } from "@/lib/sample-data";

const PARTS = [
  { k: "writing", label: "General", color: "bg-slate-400" },
  { k: "insight", label: "Insights", color: "bg-brand" },
  { k: "answer", label: "Answers", color: "bg-up" },
  { k: "trading", label: "Trading", color: "bg-amber-500" },
  { k: "reaction", label: "Reactions", color: "bg-violet-400" },
] as const;

const MEDAL = ["🥇", "🥈", "🥉"];

/** 핀톡 기여도 순위. 처음엔 상위 10명, "더보기"로 펼칩니다. 점수는 활동 기록이며 현금이 아닙니다. */
export function RankingPanel({ rows, meId, total }: { rows: RankRow[]; meId: string | null; total: number }) {
  const [open, setOpen] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const shown = open ? rows : rows.slice(0, 10);
  const mine = meId ? rows.find((r) => r.id === meId) : undefined;

  return (
    <Card className="scroll-mt-20" >
      <div id="ranking" className="scroll-mt-20" />
      <SectionHeader title="FinTalk Contribution Ranking" right={<span className="text-xs text-muted-foreground">{fmtNum(total)} members</span>} />
      <p className="mt-1 text-xs text-muted-foreground">Ranked by combined points from posts, insights, answers and trading activity. Profit and return are not counted.</p>

      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        {PARTS.map((p) => <span key={p.k} className="inline-flex items-center gap-1"><i className={`size-2 rounded-full ${p.color}`} />{p.label}</span>)}
      </div>

      <ol className="mt-2 divide-y">
        {shown.map((r) => {
          const sum = Math.max(1, r.score);
          const isOpen = openId === r.id;
          return (
            <li key={r.id} className={r.id === meId ? "-mx-2 rounded-lg bg-brand-soft/60 px-2" : ""}>
              <button type="button" onClick={() => setOpenId(isOpen ? null : r.id)} aria-expanded={isOpen} className="flex w-full items-center gap-3 py-2.5 text-left">
                <span className="w-7 shrink-0 text-center text-sm font-extrabold tabular-nums">{MEDAL[r.rank - 1] ?? r.rank}</span>
                <UserAvatar name={r.nickname} url={r.avatar} className="size-8" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline gap-1.5">
                    <span className="truncate text-sm font-semibold">{r.nickname}{r.id === meId && " (you)"}</span>
                    <span className="shrink-0 text-[11px] text-muted-foreground">{r.level}</span>
                  </span>
                  <span className="mt-1 flex h-1.5 overflow-hidden rounded-full bg-muted">
                    {PARTS.map((p) => <span key={p.k} className={p.color} style={{ width: `${(r.parts[p.k] / sum) * 100}%` }} />)}
                  </span>
                </span>
                <span className="shrink-0 text-sm font-extrabold tabular-nums">{fmtNum(r.score)}<span className="ml-0.5 text-xs font-medium text-muted-foreground"> pts</span></span>
              </button>
              {isOpen && (
                <div className="mb-3 ml-10 grid grid-cols-2 gap-x-4 gap-y-1 rounded-lg bg-muted/60 p-3 text-xs sm:grid-cols-3">
                  {PARTS.map((p) => (
                    <span key={p.k} className="flex justify-between gap-2"><span className="text-muted-foreground">{p.label}</span><b className="tabular-nums">{fmtNum(r.parts[p.k])} pts</b></span>
                  ))}
                  <span className="col-span-full text-muted-foreground">Posts {r.posts} · Insights {r.insights} · Answers {r.answers} · Accepted {r.accepted} · Trades {r.trades} · Shared {r.shared}</span>
                  <Link href={`/creators/${encodeURIComponent(r.nickname)}`} className="col-span-full font-bold text-brand hover:underline">View profile</Link>
                </div>
              )}
            </li>
          );
        })}
      </ol>

      {mine && !shown.includes(mine) && (
        <p className="mt-2 rounded-lg bg-brand-soft/60 px-3 py-2 text-sm">Your rank <b>#{mine.rank}</b> · {fmtNum(mine.score)} pts</p>
      )}
      {rows.length > 10 && (
        <button type="button" onClick={() => setOpen((v) => !v)} className="mt-3 h-10 w-full rounded-xl border text-sm font-bold hover:bg-muted">
          {open ? "Show less" : `Show more (top ${Math.min(rows.length, 50)})`}
        </button>
      )}
    </Card>
  );
}
