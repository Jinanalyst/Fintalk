"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Change } from "@/components/common/bits";
import { StatusBadge } from "./status-badge";
import { formatRange, usd } from "@/lib/contests/time";
import type { ContestStatus, ContestSummary } from "@/lib/contests/types";
import { cn } from "@/lib/utils";

const TABS: { key: "all" | ContestStatus; label: string }[] = [
  { key: "all", label: "All" },
  { key: "live", label: "Live" },
  { key: "upcoming", label: "Upcoming" },
  { key: "ended", label: "Ended" },
];

export function ContestsTable({ contests }: { contests: ContestSummary[] }) {
  const router = useRouter();
  const [tab, setTab] = useState<"all" | ContestStatus>("all");
  const rows = contests.filter((c) => tab === "all" || c.status === tab);

  return (
    <div className="space-y-3">
      <div role="tablist" aria-label="Filter contests" className="flex gap-1 overflow-x-auto">
        {TABS.map((t) => {
          const n = t.key === "all" ? contests.length : contests.filter((c) => c.status === t.key).length;
          return (
            <button
              key={t.key} role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)}
              className={cn(
                "shrink-0 rounded-lg px-3.5 py-1.5 text-sm font-semibold transition-colors",
                tab === t.key ? "bg-brand text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label} <span className="ml-1 text-xs opacity-70">{n}</span>
            </button>
          );
        })}
      </div>

      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-3 py-2.5 font-medium">#</th>
              <th className="px-3 py-2.5 font-medium">Contest</th>
              <th className="px-3 py-2.5 font-medium">Status</th>
              <th className="px-3 py-2.5 font-medium">Period</th>
              <th className="px-3 py-2.5 text-right font-medium">Prize pool</th>
              <th className="px-3 py-2.5 text-right font-medium">Traders</th>
              <th className="px-3 py-2.5 font-medium">Leader / Winner</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr
                key={c.id}
                tabIndex={0}
                onClick={() => router.push(`/contests/${c.id}`)}
                onKeyDown={(e) => e.key === "Enter" && router.push(`/contests/${c.id}`)}
                className="cursor-pointer border-b last:border-0 hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none"
              >
                <td className="px-3 py-3 font-bold tabular-nums text-muted-foreground">#{c.number}</td>
                <td className="px-3 py-3 font-semibold">{c.name}</td>
                <td className="px-3 py-3"><StatusBadge status={c.status} /></td>
                <td className="whitespace-nowrap px-3 py-3 text-muted-foreground">{formatRange(c)}</td>
                <td className="px-3 py-3 text-right font-semibold tabular-nums">{usd(c.prizeTotal)}</td>
                <td className="px-3 py-3 text-right tabular-nums">{c.participants}</td>
                <td className="whitespace-nowrap px-3 py-3">
                  {c.leader ? (
                    <span className="inline-flex items-center gap-2">
                      <span className="font-medium">{c.status === "ended" ? "🏆 " : ""}{c.leader.nickname}</span>
                      <Change pct={c.leader.returnPct} />
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={7} className="px-3 py-10 text-center text-muted-foreground">No contests in this category.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
