"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { closedTrades } from "@/lib/planner/analysis";
import { dayOf, fmt, money, tone } from "@/lib/planner/calc";
import type { Trade } from "@/lib/planner/types";
import { cn } from "@/lib/utils";
import { Panel, Stat } from "./ui";

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const compact = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n) >= 1000 ? `${(Math.abs(n) / 1000).toFixed(1)}k` : fmt(Math.abs(n), 0)}`;

export function CalendarTab({ trades }: { trades: Trade[] }) {
  const closed = useMemo(() => closedTrades(trades), [trades]);
  const last = closed[closed.length - 1]?.closedAt ?? new Date().toISOString();
  const [ym, setYm] = useState(() => ({ y: +last.slice(0, 4), m: +last.slice(5, 7) - 1 }));

  const days = useMemo(() => {
    const m = new Map<string, { pnl: number; n: number }>();
    for (const t of closed) {
      const d = dayOf(t.closedAt ?? t.createdAt);
      const cur = m.get(d) ?? { pnl: 0, n: 0 };
      m.set(d, { pnl: cur.pnl + t.pnl!, n: cur.n + 1 });
    }
    return m;
  }, [closed]);

  const first = new Date(ym.y, ym.m, 1);
  const count = new Date(ym.y, ym.m + 1, 0).getDate();
  const key = (d: number) => `${ym.y}-${String(ym.m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const cells: (number | null)[] = [...Array(first.getDay()).fill(null), ...Array.from({ length: count }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);

  const monthDays = Array.from({ length: count }, (_, i) => days.get(key(i + 1))).filter(Boolean) as { pnl: number; n: number }[];
  const net = monthDays.reduce((s, d) => s + d.pnl, 0);
  const green = monthDays.filter((d) => d.pnl > 0).length;
  const best = Math.max(0, ...monthDays.map((d) => d.pnl));
  const worst = Math.min(0, ...monthDays.map((d) => d.pnl));
  const shift = (by: number) => setYm((p) => { const d = new Date(p.y, p.m + by, 1); return { y: d.getFullYear(), m: d.getMonth() }; });
  const label = first.toLocaleString("en-US", { month: "long", year: "numeric" });

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Month net P&L" value={money(net)} className={tone(net)} />
        <Stat label="Trading days" value={monthDays.length} sub={`${green} green · ${monthDays.length - green} red`} />
        <Stat label="Best day" value={money(best)} className="text-up" />
        <Stat label="Worst day" value={money(worst)} className="text-down" />
      </div>

      <Panel className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">{label}</h2>
          <div className="flex gap-2">
            <button type="button" aria-label="Previous month" onClick={() => shift(-1)} className="grid size-10 place-items-center rounded-lg border hover:bg-muted"><ChevronLeft className="size-4" /></button>
            <button type="button" aria-label="Next month" onClick={() => shift(1)} className="grid size-10 place-items-center rounded-lg border hover:bg-muted"><ChevronRight className="size-4" /></button>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-1.5 sm:gap-2" role="grid" aria-label={`P&L calendar, ${label}`}>
          {DOW.map((d) => <div key={d} className="pb-1 text-center text-xs font-medium text-muted-foreground">{d}</div>)}
          {cells.map((d, i) => {
            if (d == null) return <div key={i} aria-hidden />;
            const v = days.get(key(d));
            return (
              <div key={i} role="gridcell"
                aria-label={v ? `${label} ${d}: ${money(v.pnl)}, ${v.n} trades` : `${label} ${d}: no trades`}
                className={cn("flex min-h-14 flex-col justify-between rounded-lg border p-1.5 sm:min-h-24 sm:p-2.5", v && v.pnl > 0 && "border-up/40 bg-up/10", v && v.pnl < 0 && "border-down/40 bg-down/10")}>
                <span className="text-[11px] text-muted-foreground sm:text-xs">{d}</span>
                {v && (
                  <span className="flex flex-col">
                    <span className={cn("font-mono text-[11px] font-semibold sm:text-sm", tone(v.pnl))}>{compact(v.pnl)}</span>
                    <span className="hidden text-[11px] text-muted-foreground sm:block">{v.n} trade{v.n > 1 ? "s" : ""}</span>
                  </span>
                )}
              </div>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground">Profit and loss always carry a sign (+ / −) next to the color, so they read without color.</p>
      </Panel>
    </div>
  );
}
