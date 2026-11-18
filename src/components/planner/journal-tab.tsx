"use client";

import { useMemo, useState } from "react";
import { planner } from "@/lib/planner/store";
import { adherence, fmt, isUnplanned, localISO, money, positionCalc, realized, rText, tone } from "@/lib/planner/calc";
import { ADHERENCE_CHECKS, EMOTIONS, EXIT_REASONS, type Trade } from "@/lib/planner/types";
import { closedTrades } from "@/lib/planner/analysis";
import { cn } from "@/lib/utils";
import { Chip, Field, Panel, PanelTitle, Pill, Stat, inputCls, primaryBtn, secondaryBtn, selectCls } from "./ui";

function CloseForm({ t }: { t: Trade }) {
  const [ae, setAe] = useState(String(t.entry));
  const [ax, setAx] = useState(String(t.tp));
  const [fee, setFee] = useState("0");
  const [reason, setReason] = useState<string>(EXIT_REASONS[0]);
  const [emo, setEmo] = useState<string>("Calm");
  const [checks, setChecks] = useState([true, true, true, true]);
  const [note, setNote] = useState("");

  const res = realized(t, parseFloat(ae) || 0, parseFloat(ax) || 0, parseFloat(fee) || 0);
  const score = checks.filter(Boolean).length * 25;
  const scoreTone = score >= 75 ? "text-up" : score >= 50 ? "text-amber-600 dark:text-amber-300" : "text-down";
  const bar = score >= 75 ? "bg-up" : score >= 50 ? "bg-amber-500" : "bg-down";
  const c = positionCalc(t);

  const close = () =>
    planner.update(t.id, {
      status: "closed", closedAt: localISO(), openedAt: t.openedAt ?? t.createdAt,
      actualEntry: parseFloat(ae) || 0, actualExit: parseFloat(ax) || 0, fees: parseFloat(fee) || 0,
      exitReason: reason, emotion: emo, checks, lesson: note, pnl: res.pnl, r: res.r,
    });

  return (
    <Panel accent className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">Close trade · <span className="font-mono">{t.sym}</span> <span className={t.dir === "long" ? "text-up" : "text-down"}>{t.dir === "long" ? "Long" : "Short"}</span></h2>
          <p className="text-[13px] text-muted-foreground">
            Plan: entry <span className="font-mono">{fmt(t.entry)}</span> · stop <span className="font-mono">{fmt(t.stop)}</span> · target <span className="font-mono">{fmt(t.tp)}</span> · risk ${fmt(c.riskAmt, 0)} · {t.setup}
          </p>
        </div>
        <Pill tone="up">Open</Pill>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="space-y-5">
          <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-4">
            <Field label="Actual entry" htmlFor="ae"><input id="ae" inputMode="decimal" className={inputCls} value={ae} onChange={(e) => setAe(e.target.value)} /></Field>
            <Field label="Actual exit" htmlFor="ax"><input id="ax" inputMode="decimal" className={inputCls} value={ax} onChange={(e) => setAx(e.target.value)} /></Field>
            <Field label="Fees ($)" htmlFor="fee"><input id="fee" inputMode="decimal" className={inputCls} value={fee} onChange={(e) => setFee(e.target.value)} /></Field>
            <Field label="Exit reason" htmlFor="xr"><select id="xr" className={selectCls} value={reason} onChange={(e) => setReason(e.target.value)}>{EXIT_REASONS.map((x) => <option key={x}>{x}</option>)}</select></Field>
          </div>

          <div className="space-y-2">
            <span className="text-xs font-medium text-muted-foreground">How did you feel?</span>
            <div role="group" aria-label="Emotion" className="flex flex-wrap gap-2">{EMOTIONS.map((m) => <Chip key={m} on={emo === m} onClick={() => setEmo(m)}>{m}</Chip>)}</div>
          </div>

          <fieldset className="space-y-1 rounded-xl border p-4">
            <legend className="px-1.5 text-xs font-medium text-muted-foreground">Did you follow the plan?</legend>
            {ADHERENCE_CHECKS.map((l, i) => (
              <label key={l} className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
                <input type="checkbox" className="size-5 accent-[var(--brand)]" checked={checks[i]} onChange={() => setChecks(checks.map((v, k) => (k === i ? !v : v)))} />
                {l}
              </label>
            ))}
          </fieldset>

          <Field label="Lesson (optional)" htmlFor="note">
            <textarea id="note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} className="w-full resize-y rounded-lg border bg-background p-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20" />
          </Field>
        </div>

        <div className="space-y-3">
          <div className="rounded-xl bg-surface p-5">
            <p className="text-xs text-muted-foreground">Realized P&amp;L</p>
            <p className={cn("font-mono text-3xl font-semibold tabular-nums", tone(res.pnl))}>{money(res.pnl, 2)}</p>
            {res.r != null && <p className={cn("font-mono", tone(res.r))}>{rText(res.r)}</p>}
          </div>
          <div className="space-y-2.5 rounded-xl bg-surface p-5">
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-muted-foreground">Plan adherence</span>
              <span className={cn("font-mono text-2xl font-semibold", scoreTone)}>{score}%</span>
            </div>
            <div role="progressbar" aria-label="Plan adherence" aria-valuemin={0} aria-valuemax={100} aria-valuenow={score} className="h-2 overflow-hidden rounded-full bg-border">
              <div className={cn("h-full rounded-full", bar)} style={{ width: `${score}%` }} />
            </div>
            <p className="text-xs text-muted-foreground">Planned R:R {fmt(c.rr, 1)}{res.r != null ? ` → achieved ${rText(res.r)}` : ""}</p>
          </div>
          <button type="button" className={cn(primaryBtn, "h-12 w-full")} onClick={close}>Close &amp; save to journal</button>
        </div>
      </div>
    </Panel>
  );
}

const FILTERS = ["All trades", "Planned only", "Unplanned only", "Winners", "Losers"] as const;

export function JournalTab({ trades }: { trades: Trade[] }) {
  const open = trades.filter((t) => t.status === "open" && t.source !== "paper"); // open mock-trading positions are closed in the terminal
  const [pick, setPick] = useState("");
  const current = open.find((t) => t.id === pick) ?? open[0];
  const [q, setQ] = useState("");
  const [f, setF] = useState<(typeof FILTERS)[number]>("All trades");

  const closed = useMemo(() => closedTrades(trades).reverse(), [trades]);
  const month = new Date().toISOString().slice(0, 7);
  const thisMonth = closed.filter((t) => (t.closedAt ?? "").slice(0, 7) === month);
  const adh = closed.map((t) => adherence(t.checks)).filter((x): x is number => x != null);
  const rows = closed.filter((t) => {
    if (q && !t.sym.toLowerCase().includes(q.toLowerCase())) return false;
    const un = isUnplanned(t);
    return f === "Planned only" ? !un : f === "Unplanned only" ? un : f === "Winners" ? t.pnl! > 0 : f === "Losers" ? t.pnl! < 0 : true;
  });
  const net = thisMonth.reduce((s, t) => s + t.pnl!, 0);

  const exportCsv = () => {
    const head = ["date", "symbol", "side", "setup", "entry", "exit", "r", "pnl", "adherence", "emotion", "exchange"];
    const lines = closed.map((t) => [(t.closedAt ?? "").slice(0, 10), t.sym, t.dir, t.setup, t.actualEntry ?? "", t.actualExit ?? "", t.r?.toFixed(2) ?? "", t.pnl?.toFixed(2), adherence(t.checks) ?? "", t.emotion ?? "", t.exch].join(","));
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([[head.join(","), ...lines].join("\n")], { type: "text/csv" }));
    a.download = "chainlabs-journal.csv";
    a.click();
  };

  return (
    <div className="space-y-5">
      {current ? (
        <>
          {open.length > 1 && (
            <div className="flex items-center gap-2 text-sm">
              <label htmlFor="which" className="text-muted-foreground">Closing</label>
              <select id="which" className={cn(selectCls, "h-10 w-auto")} value={current.id} onChange={(e) => setPick(e.target.value)}>
                {open.map((t) => <option key={t.id} value={t.id}>{t.sym} · {t.dir}</option>)}
              </select>
            </div>
          )}
          <CloseForm key={current.id} t={current} />
        </>
      ) : (
        <Panel><p className="text-sm text-muted-foreground">No open trades to close. Mark a plan as open on the Plan tab, and it appears here.</p></Panel>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Closed this month" value={thisMonth.length} />
        <Stat label="Net P&L" value={money(net)} className={tone(net)} />
        <Stat label="Avg adherence" value={adh.length ? `${Math.round(adh.reduce((s, x) => s + x, 0) / adh.length)}%` : "—"} />
        <Stat label="Unplanned trades" value={closed.filter((t) => isUnplanned(t)).length} className="text-amber-600 dark:text-amber-300" />
      </div>

      <Panel className="space-y-4">
        <PanelTitle right={
          <div className="flex flex-wrap gap-2">
            <label className="sr-only" htmlFor="fs">Search symbol</label>
            <input id="fs" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search symbol" className={cn(inputCls, "h-10 w-40 font-sans")} />
            <label className="sr-only" htmlFor="ft">Filter</label>
            <select id="ft" value={f} onChange={(e) => setF(e.target.value as (typeof FILTERS)[number])} className={cn(selectCls, "h-10 w-auto")}>{FILTERS.map((x) => <option key={x}>{x}</option>)}</select>
            <button type="button" onClick={exportCsv} className={cn(secondaryBtn, "h-10 px-4")}>Export CSV</button>
          </div>
        }>Trade history</PanelTitle>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] border-collapse text-[13px]">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                {["Date", "Symbol", "Side", "Setup", "Entry → Exit", "R", "P&L", "Adherence", "Emotion"].map((h, i) => (
                  <th key={h} className={cn("border-b px-3 py-2.5 font-medium", i >= 4 && i <= 7 && "text-right")}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 60).map((t) => {
                const a = adherence(t.checks);
                const un = isUnplanned(t);
                return (
                  <tr key={t.id} className="border-b last:border-0">
                    <td className="px-3 py-3 text-muted-foreground">{(t.closedAt ?? "").slice(5, 10).replace("-", "/")}</td>
                    <td className="px-3 py-3 font-mono font-semibold">{t.sym}</td>
                    <td className={cn("px-3 py-3", t.dir === "long" ? "text-up" : "text-down")}>{t.dir === "long" ? "Long" : "Short"}</td>
                    <td className="px-3 py-3"><span className={cn("rounded-md px-2 py-0.5 text-xs", un ? "bg-amber-100 text-amber-800 dark:bg-amber-400/15 dark:text-amber-300" : "bg-muted text-muted-foreground")}>{t.setup}</span></td>
                    <td className="px-3 py-3 text-right font-mono">{t.actualEntry != null ? `${fmt(t.actualEntry, 4)} → ${fmt(t.actualExit ?? 0, 4)}` : "—"}</td>
                    <td className={cn("px-3 py-3 text-right font-mono", t.r != null && tone(t.r))}>{t.r != null ? rText(t.r) : "—"}</td>
                    <td className={cn("px-3 py-3 text-right font-mono font-semibold", tone(t.pnl!))}>{money(t.pnl!, 2)}</td>
                    <td className="px-3 py-3 text-right font-mono">{a != null && !un ? `${a}%` : "—"}</td>
                    <td className="px-3 py-3 text-muted-foreground">{t.emotion ?? "—"}</td>
                  </tr>
                );
              })}
              {rows.length === 0 && <tr><td colSpan={9} className="px-3 py-8 text-center text-muted-foreground">No closed trades match.</td></tr>}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
