"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Hourglass, Search, Snowflake } from "lucide-react";
import { Change } from "@/components/common/bits";
import { formatBoth } from "@/lib/contests/time";
import type { PublicRow } from "@/lib/contests/types";
import { cn } from "@/lib/utils";

const PAGE = 50;
const MEDAL = ["bg-yellow-400/15 text-yellow-600 dark:text-yellow-300", "bg-slate-400/15 text-slate-500 dark:text-slate-300", "bg-orange-500/15 text-orange-600 dark:text-orange-300"];

function RankCell({ row }: { row: PublicRow }) {
  if (row.rank === null) return <span className="text-muted-foreground">—</span>;
  const medal = row.qualified && row.rank <= 3 ? MEDAL[row.rank - 1] : null;
  return (
    <span className={cn("inline-flex size-7 items-center justify-center rounded-full text-sm font-bold tabular-nums", medal)}>
      {row.rank}
    </span>
  );
}

function Status({ row }: { row: PublicRow }) {
  if (row.disqualified) return <span className="text-xs font-semibold text-down" title={row.dqReason}>Disqualified</span>;
  return row.qualified ? (
    <span className="inline-flex items-center gap-1 text-up" title="Minimum trades reached"><CheckCircle2 className="size-4" /><span className="sr-only">Qualified</span></span>
  ) : (
    <span className="inline-flex items-center gap-1 text-muted-foreground" title="Not enough closed trades yet"><Hourglass className="size-4" /><span className="sr-only">Not yet qualified</span></span>
  );
}

function Line({ row, pinned }: { row: PublicRow; pinned?: boolean }) {
  const medal = !row.disqualified && row.qualified && row.rank !== null && row.rank <= 3 ? MEDAL[row.rank - 1] : "";
  return (
    <tr className={cn("border-b last:border-0", row.disqualified && "bg-muted/40 text-muted-foreground opacity-70", medal && "font-semibold", pinned && "bg-brand-soft")}>
      <td className="px-3 py-2.5"><RankCell row={row} /></td>
      <td className="px-3 py-2.5">
        <span className={cn(row.disqualified && "line-through")}>{row.nickname}</span>
        {pinned && <span className="ml-1.5 rounded bg-brand px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">YOU</span>}
      </td>
      <td className="px-3 py-2.5 text-right">{row.disqualified ? <span className="tabular-nums">{row.returnPct.toFixed(2)}%</span> : <Change pct={row.returnPct} />}</td>
      <td className="px-3 py-2.5 text-right tabular-nums">{row.mddPct.toFixed(2)}%</td>
      <td className="px-3 py-2.5 text-right tabular-nums">{row.trades}</td>
      <td className="px-3 py-2.5 text-center"><Status row={row} /></td>
    </tr>
  );
}

export function Leaderboard({
  rows, me, frozen, asOf, empty,
}: { rows: PublicRow[]; me: PublicRow | null; frozen: boolean; asOf: string | null; empty?: string }) {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? rows.filter((r) => r.nickname.toLowerCase().includes(s)) : rows;
  }, [rows, q]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const cur = Math.min(page, pages);
  const slice = filtered.slice((cur - 1) * PAGE, cur * PAGE);

  if (empty) return <p className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">{empty}</p>;

  return (
    <div className="space-y-3">
      {frozen && (
        <div role="status" className="flex items-start gap-2 rounded-lg bg-sky-100 p-3 text-sm text-sky-800 dark:bg-sky-400/15 dark:text-sky-200">
          <Snowflake className="mt-0.5 size-4 shrink-0" />
          <p><b>Leaderboard frozen.</b> Rankings are hidden for the final 24 hours. The standings below are from the moment of the freeze; final results are published when the contest ends.</p>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="relative block w-full sm:w-64">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Search nickname"
            aria-label="Search nickname"
            className="h-9 w-full rounded-lg border bg-card pl-8 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
          />
        </label>
        {asOf && <p className="text-xs text-muted-foreground">Snapshot: {formatBoth(asOf)} · updated hourly</p>}
      </div>

      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-3 py-2.5 text-left font-medium">Rank</th>
              <th className="px-3 py-2.5 text-left font-medium">Trader</th>
              <th className="px-3 py-2.5 text-right font-medium">Return</th>
              <th className="px-3 py-2.5 text-right font-medium">MDD</th>
              <th className="px-3 py-2.5 text-right font-medium">Trades</th>
              <th className="px-3 py-2.5 text-center font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {me && <Line row={me} pinned />}
            {me && <tr aria-hidden><td colSpan={6} className="h-1 bg-muted" /></tr>}
            {slice.map((r) => <Line key={r.nickname} row={r} />)}
            {slice.length === 0 && <tr><td colSpan={6} className="px-3 py-10 text-center text-muted-foreground">No traders match your search.</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <p className="inline-flex items-center gap-3">
          <span className="inline-flex items-center gap-1"><CheckCircle2 className="size-3.5 text-up" /> Qualified</span>
          <span className="inline-flex items-center gap-1"><Hourglass className="size-3.5" /> Needs more closed trades</span>
        </p>
        {pages > 1 && (
          <div className="flex items-center gap-2">
            <button disabled={cur <= 1} onClick={() => setPage(cur - 1)} className="rounded-md border px-2.5 py-1 font-medium disabled:opacity-40">Prev</button>
            <span className="tabular-nums">{cur} / {pages}</span>
            <button disabled={cur >= pages} onClick={() => setPage(cur + 1)} className="rounded-md border px-2.5 py-1 font-medium disabled:opacity-40">Next</button>
          </div>
        )}
      </div>
    </div>
  );
}
