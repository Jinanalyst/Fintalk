"use client";

import { useMemo } from "react";
import { behaviorFlags, bySetup, byEmotion, byHour, fmtHold, kpis, planVsReality, styleReport } from "@/lib/planner/analysis";
import { fmt, money, rText, tone } from "@/lib/planner/calc";
import type { Trade } from "@/lib/planner/types";
import { cn } from "@/lib/utils";
import { Panel, PanelTitle, Pill, ProGate, Stat } from "./ui";

function Bar({ pct, bad }: { pct: number; bad?: boolean }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-border">
      <div className={cn("h-full rounded-full", bad ? "bg-down" : "bg-brand")} style={{ width: `${Math.max(2, Math.min(100, pct))}%` }} />
    </div>
  );
}

function Equity({ curve }: { curve: { day: string; total: number }[] }) {
  if (curve.length < 2) return <p className="py-10 text-center text-sm text-muted-foreground">Close at least two trades to see your equity curve.</p>;
  const W = 600, H = 200, P = 14;
  const vals = [0, ...curve.map((c) => c.total)];
  const lo = Math.min(...vals), hi = Math.max(...vals);
  const span = hi - lo || 1;
  const x = (i: number) => (i / (vals.length - 1)) * W;
  const y = (v: number) => H - P - ((v - lo) / span) * (H - 2 * P);
  const pts = vals.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const end = vals[vals.length - 1];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`Cumulative P&L from $0 to ${money(end)} over ${curve.length} closed trades`} className="block">
      <line x1="0" x2={W} y1={y(0)} y2={y(0)} stroke="var(--border)" strokeDasharray="4 4" />
      <polyline fill="none" stroke="var(--brand)" strokeWidth="2.5" strokeLinejoin="round" points={pts} />
      <circle cx={x(vals.length - 1)} cy={y(end)} r="5" fill="var(--brand)" />
    </svg>
  );
}

export function AnalysisTab({ trades, pro }: { trades: Trade[]; pro: boolean }) {
  const k = useMemo(() => kpis(trades), [trades]);
  const setups = useMemo(() => bySetup(trades), [trades]);
  const style = useMemo(() => styleReport(trades), [trades]);
  const pv = useMemo(() => planVsReality(trades), [trades]);
  const flags = useMemo(() => behaviorFlags(trades), [trades]);
  const hours = useMemo(() => byHour(trades), [trades]);
  const emotions = useMemo(() => byEmotion(trades), [trades]);
  const maxH = Math.max(0.01, ...hours.map((h) => Math.abs(h.avgR)));
  const maxE = Math.max(1, ...emotions.map((e) => Math.abs(e.pnl)));

  if (k.n === 0) return <Panel><p className="text-sm text-muted-foreground">Close or import a few trades and your analysis appears here.</p></Panel>;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Win rate" value={`${Math.round(k.winRate)}%`} sub={`${k.wins} W · ${k.losses} L`} />
        <Stat label="Profit factor" value={Number.isFinite(k.profitFactor) ? k.profitFactor.toFixed(2) : "∞"} sub="Gross win ÷ gross loss" className={k.profitFactor >= 1 ? "text-up" : "text-down"} />
        <Stat label="Expectancy" value={rText(k.expectancy)} sub="Per trade" className={tone(k.expectancy)} />
        <Stat label="Avg win / loss" value={`${rText(k.avgWinR)} / ${rText(k.avgLossR)}`} sub="Realized" className="text-base" />
        <Stat label="Max drawdown" value={`−${k.maxDdPct.toFixed(1)}%`} sub={k.ddFrom ? `${k.ddFrom.slice(5)} → ${k.ddTo.slice(5)}` : undefined} className="text-down" />
      </div>

      <div className="grid gap-5 lg:grid-cols-[3fr_2fr]">
        <Panel className="space-y-3">
          <PanelTitle right={<span className={cn("font-mono font-semibold", tone(k.net))}>{money(k.net)}</span>}>Equity curve</PanelTitle>
          <Equity curve={k.curve} />
          <div className="flex justify-between text-xs text-muted-foreground"><span>{k.curve[0]?.day.slice(5)}</span><span>{k.curve[k.curve.length - 1]?.day.slice(5)}</span></div>
        </Panel>

        <Panel className="space-y-3">
          <PanelTitle>By setup</PanelTitle>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[320px] border-collapse text-[13px]">
              <thead><tr className="text-left text-xs text-muted-foreground">
                <th className="border-b px-2 py-2 font-medium">Setup</th><th className="border-b px-2 py-2 text-right font-medium">Trades</th>
                <th className="border-b px-2 py-2 text-right font-medium">Win rate</th><th className="border-b px-2 py-2 text-right font-medium">Avg R</th>
              </tr></thead>
              <tbody>
                {setups.map((s) => (
                  <tr key={s.name} className="border-b last:border-0">
                    <td className="px-2 py-2.5">{s.name}</td>
                    <td className="px-2 py-2.5 text-right font-mono">{s.n}</td>
                    <td className="px-2 py-2.5 text-right font-mono">{Math.round(s.wr)}%</td>
                    <td className={cn("px-2 py-2.5 text-right font-mono font-semibold", tone(s.avgR))}>{rText(s.avgR)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>

      <ProGate pro={pro} title="Your trading style report">
        <Panel className="flex flex-wrap gap-8">
          <div className="min-w-[260px] flex-1 space-y-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Your trading style · {style.n} closed trades</p>
            <p className="text-4xl font-extrabold leading-none tracking-tight text-brand sm:text-5xl">{style.style}</p>
            <div className="flex flex-wrap gap-2 text-sm">
              <span className="rounded-lg bg-surface px-3 py-2 text-muted-foreground">Avg hold <strong className="font-mono text-foreground">{fmtHold(style.avgHold)}</strong></span>
              <span className="rounded-lg bg-surface px-3 py-2 text-muted-foreground">Trades/day <strong className="font-mono text-foreground">{style.perDay.toFixed(1)}</strong></span>
              <span className="rounded-lg bg-surface px-3 py-2 text-muted-foreground">Long bias <strong className="font-mono text-foreground">{Math.round(style.longBias)}%</strong></span>
            </div>
          </div>
          <div className="min-w-[240px] flex-1 space-y-2">
            <h3 className="text-sm font-semibold text-up">Strengths</h3>
            {style.strengths.length ? style.strengths.map((s) => <p key={s} className="flex gap-2.5 rounded-lg bg-surface p-3 text-sm"><span className="font-bold text-up" aria-hidden>+</span>{s}</p>) : <p className="text-sm text-muted-foreground">More closed trades are needed.</p>}
          </div>
          <div className="min-w-[240px] flex-1 space-y-2">
            <h3 className="text-sm font-semibold text-down">Weak spots</h3>
            {style.weak.length ? style.weak.map((s) => <p key={s} className="flex gap-2.5 rounded-lg bg-surface p-3 text-sm"><span className="font-bold text-down" aria-hidden>−</span>{s}</p>) : <p className="text-sm text-muted-foreground">Nothing stands out yet.</p>}
          </div>
        </Panel>
      </ProGate>

      <div className="grid gap-5 lg:grid-cols-2">
        <ProGate pro={pro} title="Plan vs reality">
          <Panel accent className="space-y-4">
            <div><PanelTitle>Plan vs reality</PanelTitle><p className="text-[13px] text-muted-foreground">The same trader, two different results.</p></div>
            {[
              { title: "Stop loss", rows: [
                { l: `Respected (${pv.stop.ok.n} trades) · ${Math.round(pv.stop.ok.wr)}% win`, r: pv.stop.ok.r },
                { l: `Moved or ignored (${pv.stop.bad.n}) · ${Math.round(pv.stop.bad.wr)}% win`, r: pv.stop.bad.r } ] },
              { title: "Planned vs unplanned", rows: [
                { l: `Planned (${pv.plan.planned.n} trades)`, r: pv.plan.planned.r },
                { l: `Unplanned (${pv.plan.unplanned.n})`, r: pv.plan.unplanned.r } ] },
            ].map((g) => (
              <div key={g.title} className="space-y-2.5 rounded-xl bg-surface p-4">
                <p className="font-semibold">{g.title}</p>
                {g.rows.map((b) => (
                  <div key={b.l} className="space-y-1">
                    <div className="flex justify-between text-[13px]"><span>{b.l}</span><span className={cn("font-mono font-semibold", tone(b.r))}>{rText(b.r)}</span></div>
                    <Bar pct={(Math.abs(b.r) / 1.5) * 100} bad={b.r < 0} />
                  </div>
                ))}
              </div>
            ))}
          </Panel>
        </ProGate>

        <ProGate pro={pro} title="Behavior flags">
          <Panel className="space-y-3">
            <PanelTitle>Behavior flags</PanelTitle>
            {flags.length === 0 && <p className="text-sm text-muted-foreground">No risky patterns detected. Keep it up.</p>}
            {flags.map((f) => (
              <div key={f.title} className="flex items-start gap-3 rounded-lg bg-surface p-3.5">
                <span className={cn("mt-0.5 shrink-0 rounded-md px-2 py-0.5 text-[11px] font-bold", f.level === "HIGH" ? "bg-down/15 text-down" : "bg-amber-100 text-amber-800 dark:bg-amber-400/15 dark:text-amber-300")}>{f.level}</span>
                <div><p className="font-semibold">{f.title}</p><p className="text-[13px] text-muted-foreground">{f.text}</p></div>
              </div>
            ))}
          </Panel>
        </ProGate>
      </div>

      <ProGate pro={pro} title="When you trade best, and how you feel">
        <div className="grid gap-5 lg:grid-cols-2">
          <Panel className="space-y-3">
            <PanelTitle right={<span className="text-xs text-muted-foreground">Avg R by entry time</span>}>When you trade best</PanelTitle>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(120px,1fr))] gap-3">
              {hours.map((h) => (
                <div key={h.slot} className="space-y-2 rounded-lg bg-surface p-3">
                  <p className="text-xs text-muted-foreground">{h.slot}</p>
                  <p className={cn("font-mono text-base font-semibold", tone(h.avgR))}>{rText(h.avgR)}</p>
                  <Bar pct={(Math.abs(h.avgR) / maxH) * 100} bad={h.avgR < 0} />
                  <p className="text-xs text-muted-foreground">{h.n} trades · {Math.round(h.wr)}% win</p>
                </div>
              ))}
            </div>
          </Panel>
          <Panel className="space-y-3">
            <PanelTitle right={<span className="text-xs text-muted-foreground">P&amp;L by emotion</span>}>Emotion report</PanelTitle>
            {emotions.map((e) => (
              <div key={e.name} className="space-y-1">
                <div className="flex justify-between text-[13px]"><span>{e.name} <span className="text-muted-foreground">· {e.n}</span></span><span className={cn("font-mono font-semibold", tone(e.pnl))}>{money(e.pnl)}</span></div>
                <Bar pct={(Math.abs(e.pnl) / maxE) * 100} bad={e.pnl < 0} />
              </div>
            ))}
          </Panel>
        </div>
      </ProGate>

      {!pro && <p className="text-center text-xs text-muted-foreground"><Pill tone="brand">Free</Pill> shows your KPIs, equity curve and setup table. Pro unlocks the rest — ${fmt(40)} once.</p>}
    </div>
  );
}
