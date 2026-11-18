"use client";

import Link from "next/link";
import { useState } from "react";
import { planner } from "@/lib/planner/store";
import { fmt, localISO, positionCalc, uid } from "@/lib/planner/calc";
import { EXCHANGES, SETUPS, TIMEFRAMES, type Dir, type Trade } from "@/lib/planner/types";
import { cn } from "@/lib/utils";
import { Chip, Field, Notice, Panel, PanelTitle, Pill, inputCls, primaryBtn, secondaryBtn, selectCls, statusPill } from "./ui";

export function PlanTab({ trades, goJournal }: { trades: Trade[]; goJournal: () => void }) {
  const [sym, setSym] = useState("BTC-USDT");
  const [exch, setExch] = useState("OKX");
  const [tf, setTf] = useState("1h");
  const [dir, setDir] = useState<Dir>("long");
  const [entry, setEntry] = useState("97250");
  const [stop, setStop] = useState("95800");
  const [tp, setTp] = useState("101600");
  const [acct, setAcct] = useState("10000");
  const [risk, setRisk] = useState("1");
  const [setup, setSetup] = useState<string>("Breakout");
  const [why, setWhy] = useState("");
  const [chart, setChart] = useState("");
  const [saved, setSaved] = useState("");

  const n = (s: string) => parseFloat(s) || 0;
  const c = positionCalc({ dir, entry: n(entry), stop: n(stop), tp: n(tp), acct: n(acct), riskPct: n(risk) });
  const base = sym.split("-")[0] || "units";
  const okToSave = !!sym.trim() && !c.badStop && c.riskAmt > 0;
  const allGood = !c.badStop && !c.warnRR && !c.warnRisk;

  const save = (status: "planned" | "open") => {
    if (!okToSave) return;
    const now = localISO();
    planner.add({
      id: uid(), source: "plan", sym: sym.trim().toUpperCase(), exch, dir, tf,
      entry: n(entry), stop: n(stop), tp: n(tp), acct: n(acct), riskPct: n(risk),
      setup, why, chart, status, createdAt: now, openedAt: status === "open" ? now : undefined, plannedRR: c.rr,
    });
    setSaved(status === "open" ? "Saved and marked open. Close it from the Journal tab when it ends." : "Saved as planned.");
    setWhy("");
  };

  const active = trades.filter((t) => t.status === "open" || t.status === "planned");

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
      <Panel className="space-y-5">
        <PanelTitle right={<span className="text-xs text-muted-foreground">Status: <strong className="text-amber-600 dark:text-amber-300">Planned</strong></span>}>New trade plan</PanelTitle>

        <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-4">
          <Field label="Symbol" htmlFor="sym"><input id="sym" className={inputCls} value={sym} onChange={(e) => setSym(e.target.value)} /></Field>
          <Field label="Exchange" htmlFor="exch">
            <select id="exch" className={selectCls} value={exch} onChange={(e) => setExch(e.target.value)}>{EXCHANGES.map((x) => <option key={x}>{x}</option>)}</select>
          </Field>
          <Field label="Direction">
            <div role="group" aria-label="Direction" className="flex h-11 gap-1 rounded-lg border bg-background p-1">
              {(["long", "short"] as const).map((d) => (
                <button key={d} type="button" aria-pressed={dir === d} onClick={() => setDir(d)}
                  className={cn("flex-1 rounded-md text-sm font-semibold transition-colors", dir === d ? "bg-brand-soft text-foreground" : "text-muted-foreground")}>
                  {d === "long" ? "Long ↑" : "Short ↓"}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Timeframe" htmlFor="tf">
            <select id="tf" className={selectCls} value={tf} onChange={(e) => setTf(e.target.value)}>{TIMEFRAMES.map((x) => <option key={x}>{x}</option>)}</select>
          </Field>
        </div>

        <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-4 rounded-xl border bg-surface p-4 sm:p-5">
          <Field label="Entry price" htmlFor="entry"><input id="entry" inputMode="decimal" className={inputCls} value={entry} onChange={(e) => setEntry(e.target.value)} /></Field>
          <Field label="Stop loss" htmlFor="stop" tone="down"><input id="stop" inputMode="decimal" className={inputCls} value={stop} onChange={(e) => setStop(e.target.value)} /></Field>
          <Field label="Take profit" htmlFor="tp" tone="up"><input id="tp" inputMode="decimal" className={inputCls} value={tp} onChange={(e) => setTp(e.target.value)} /></Field>
          <Field label="Account size ($)" htmlFor="acct"><input id="acct" inputMode="decimal" className={inputCls} value={acct} onChange={(e) => setAcct(e.target.value)} /></Field>
          <Field label="Risk per trade (%)" htmlFor="risk"><input id="risk" inputMode="decimal" className={inputCls} value={risk} onChange={(e) => setRisk(e.target.value)} /></Field>
        </div>

        <div className="space-y-2">
          <span className="text-xs font-medium text-muted-foreground">Setup</span>
          <div role="group" aria-label="Setup" className="flex flex-wrap gap-2">
            {SETUPS.map((s) => <Chip key={s} on={setup === s} onClick={() => setSetup(s)}>{s}</Chip>)}
          </div>
        </div>

        <Field label="Why this trade?" htmlFor="why">
          <textarea id="why" rows={3} value={why} onChange={(e) => setWhy(e.target.value)} placeholder="What do you see, and what proves you wrong?"
            className="w-full resize-y rounded-lg border bg-background p-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20" />
        </Field>
        <Field label="Chart link (optional)" htmlFor="chart">
          <input id="chart" className={cn(inputCls, "font-sans")} value={chart} onChange={(e) => setChart(e.target.value)} placeholder="https://www.tradingview.com/x/…" />
        </Field>

        {saved && <Notice tone="up">{saved}</Notice>}
        <div className="flex flex-wrap justify-end gap-3">
          <button type="button" className={secondaryBtn} disabled={!okToSave} onClick={() => save("planned")}>Save as planned</button>
          <button type="button" className={primaryBtn} disabled={!okToSave} onClick={() => save("open")}>Save &amp; mark open</button>
        </div>
      </Panel>

      <aside className="space-y-5">
        <Panel className="space-y-4">
          <PanelTitle muted>Position calculator</PanelTitle>
          <div>
            <p className="text-xs text-muted-foreground">Position size</p>
            <p className="font-mono text-3xl font-semibold tabular-nums">{fmt(c.size, 5)} <span className="text-base text-muted-foreground">{base}</span></p>
            <p className="text-xs text-muted-foreground">≈ <span className="font-mono">${fmt(c.notional, 0)}</span> notional</p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg bg-surface p-3"><p className="text-xs text-muted-foreground">Risk</p><p className="font-mono text-sm font-semibold text-down">−${fmt(c.riskAmt, 2)}</p></div>
            <div className="rounded-lg bg-surface p-3"><p className="text-xs text-muted-foreground">Reward</p><p className="font-mono text-sm font-semibold text-up">+${fmt(c.reward, 2)}</p></div>
            <div className="rounded-lg bg-surface p-3"><p className="text-xs text-muted-foreground">R:R</p>
              <p className={cn("font-mono text-sm font-semibold", c.rr >= 2 ? "text-up" : c.warnRR ? "text-amber-600 dark:text-amber-300" : "")}>{c.badStop ? "—" : fmt(c.rr, 2)}</p></div>
          </div>
          {c.badStop && <Notice tone="down">{dir === "long" ? "For a long, stop must be below entry and target above it." : "For a short, stop must be above entry and target below it."}</Notice>}
          {c.warnRR && <Notice tone="warn">R:R is below 1.5. Widen the target or tighten the stop.</Notice>}
          {c.warnRisk && <Notice tone="warn">Risk is above 2% of your account.</Notice>}
          {allGood && <Notice tone="up">Plan is within your risk rules.</Notice>}
        </Panel>

        <Panel className="space-y-3">
          <PanelTitle muted right={<button type="button" onClick={goJournal} className="text-xs font-medium text-brand hover:underline">Go to journal →</button>}>Active plans</PanelTitle>
          {active.length === 0 && <p className="text-sm text-muted-foreground">No open or planned trades yet.</p>}
          {active.slice(0, 6).map((t) => {
            const rr = positionCalc(t).rr;
            return (
              <div key={t.id} className="flex items-center justify-between gap-3 rounded-lg bg-surface p-3">
                <div className="min-w-0">
                  <p className="truncate font-mono text-sm font-semibold">{t.sym} <span className={t.dir === "long" ? "text-up" : "text-down"}>{t.dir === "long" ? "Long" : "Short"}</span></p>
                  <p className="text-xs text-muted-foreground">Entry {fmt(t.entry)} · R:R {fmt(rr, 1)} · {t.setup}</p>
                </div>
                <div className="flex items-center gap-2">
                  {statusPill(t.status)}
                  {t.status === "planned" && <button type="button" onClick={() => planner.update(t.id, { status: "open", openedAt: localISO() })} className="text-xs font-medium text-brand hover:underline">Open</button>}
                  <button type="button" aria-label={`Cancel ${t.sym} plan`} onClick={() => planner.update(t.id, { status: "cancelled" })} className="text-xs text-muted-foreground hover:text-down">✕</button>
                </div>
              </div>
            );
          })}
        </Panel>

        <p className="px-1 text-xs text-muted-foreground">
          Plans are saved on this device. <Link href="/planner#pricing" className="font-medium text-brand hover:underline">See Free vs Pro</Link> <Pill>3-day refund</Pill>
        </p>
      </aside>
    </div>
  );
}
