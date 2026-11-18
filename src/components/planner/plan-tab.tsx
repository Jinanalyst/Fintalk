"use client";

import Link from "next/link";
import { useState } from "react";
import { planner } from "@/lib/planner/store";
import { fmt, localISO, positionCalc, uid } from "@/lib/planner/calc";
import { SETUPS, TIMEFRAMES, type Dir, type Trade } from "@/lib/planner/types";
import { EXCHANGE_CONFIG, EXCHANGE_IDS, exchangeConfig } from "@/lib/planner/exchanges";
import { cn } from "@/lib/utils";
import { SYMBOLS, pricePrecision } from "@/lib/trade";
import { Chip, Field, Notice, Panel, PanelTitle, Pill, inputCls, primaryBtn, secondaryBtn, selectCls, statusPill } from "./ui";
import { useLivePrices } from "./use-live-price";

const LEVERAGE_PRESETS = [1, 3, 5, 10, 20, 50];
const toPair = (s: string) => s.replace(/[-/\s]/g, "").toUpperCase();
const roundPx = (p: number) => String(Number(p.toFixed(pricePrecision(p))));

export function PlanTab({ trades, goJournal }: { trades: Trade[]; goJournal: () => void }) {
  const [sym, setSym] = useState("BTC-USDT");
  const [symDraft, setSymDraft] = useState("BTC-USDT");
  const [lev, setLev] = useState("1");
  const [pendingKey, setPendingKey] = useState<string | null>("BTCUSDT|long");
  const [exch, setExch] = useState("Mock");
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
  // Everything below follows the chosen exchange: leverage cap, taker fee, symbol format.
  const ex = exchangeConfig(exch);
  const leverage = Math.min(ex.maxLeverage, Math.max(1, Math.round(n(lev)) || 1));
  const c = positionCalc({ dir, entry: n(entry), stop: n(stop), tp: n(tp), acct: n(acct), riskPct: n(risk), leverage, feeRate: ex.takerFee });
  const changeExchange = (id: string) => {
    setExch(id);
    setSaved("");
    setLev(String(Math.min(leverage, exchangeConfig(id).maxLeverage)));
  };
  const base = sym.split("-")[0] || "units";
  const okToSave = !!sym.trim() && !c.badStop && c.riskAmt > 0;
  const allGood = !c.badStop && !c.warnRR && !c.warnRisk && !c.liqBeforeStop && !c.overMargin;

  // Live price for the chosen asset. When the asset or direction changes, the next price tick
  // fills entry, stop (2% away) and target (5% away) so the plan starts from the real market.
  const pair = toPair(sym);
  const { prices, price, live, valid } = useLivePrices(pair);
  const key = `${pair}|${dir}`;
  if (price && pendingKey === key) {
    const s = dir === "long" ? -1 : 1;
    setPendingKey(null);
    setEntry(roundPx(price));
    setStop(roundPx(price * (1 + s * 0.02)));
    setTp(roundPx(price * (1 - s * 0.05)));
  }
  const pickAsset = (v: string) => {
    setSymDraft(v);
    const next = v.trim().toUpperCase();
    if (SYMBOLS.some((x) => x.label === next.split("-")[0]) && /^[A-Z0-9]+-USDT$/.test(next)) commitAsset(next);
  };
  const commitAsset = (v: string) => {
    const next = v.trim().toUpperCase();
    if (!next) return;
    setSym(next);
    setSymDraft(next);
    setPendingKey(`${toPair(next)}|${dir}`);
  };
  const changeDir = (d: Dir) => {
    setDir(d);
    setPendingKey(`${pair}|${d}`);
  };

  const save = (status: "planned" | "open") => {
    if (!okToSave) return;
    const now = localISO();
    planner.add({
      id: uid(), source: "plan", sym: sym.trim().toUpperCase(), exch, dir, tf,
      entry: n(entry), stop: n(stop), tp: n(tp), acct: n(acct), riskPct: n(risk), leverage,
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
          <Field label="Asset" htmlFor="sym">
            <input id="sym" list="planner-assets" className={inputCls} value={symDraft} autoComplete="off" spellCheck={false}
              onChange={(e) => pickAsset(e.target.value)} onBlur={() => commitAsset(symDraft)}
              onKeyDown={(e) => { if (e.key === "Enter") commitAsset(symDraft); }} />
            <p className="text-xs text-muted-foreground">On {ex.label}: <span className="font-mono">{ex.symbol(base)}</span></p>
            <datalist id="planner-assets">{SYMBOLS.map((s) => <option key={s.symbol} value={`${s.label}-USDT`}>{s.name}</option>)}</datalist>
          </Field>
          <Field label="Exchange" htmlFor="exch">
            <select id="exch" className={selectCls} value={exch} onChange={(e) => changeExchange(e.target.value)}>
              {EXCHANGE_IDS.map((x) => <option key={x} value={x}>{EXCHANGE_CONFIG[x].label}</option>)}
            </select>
            <p className="text-xs text-muted-foreground">{ex.note} · max {ex.maxLeverage}x</p>
          </Field>
          <Field label="Direction">
            <div role="group" aria-label="Direction" className="flex h-11 gap-1 rounded-lg border bg-background p-1">
              {(["long", "short"] as const).map((d) => (
                <button key={d} type="button" aria-pressed={dir === d} onClick={() => changeDir(d)}
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

        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-surface px-4 py-3 text-sm" aria-live="polite">
          {!valid ? (
            <span className="text-muted-foreground">Pick a USDT pair such as BTC-USDT to see its live price.</span>
          ) : (
            <>
              <span className="flex items-center gap-2">
                <span className={cn("size-2 rounded-full", live ? "bg-up" : "bg-amber-500")} aria-hidden />
                <span className="text-muted-foreground">{sym} {live ? "live" : "delayed"}</span>
                <strong className="font-mono text-base tabular-nums">{price ? `$${fmt(price, pricePrecision(price))}` : "Loading…"}</strong>
              </span>
              <button type="button" disabled={!price} onClick={() => price && setEntry(roundPx(price))} className="text-xs font-semibold text-brand hover:underline disabled:opacity-50">Use as entry</button>
            </>
          )}
        </div>

        <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-4 rounded-xl border bg-surface p-4 sm:p-5">
          <Field label="Entry price" htmlFor="entry"><input id="entry" inputMode="decimal" className={inputCls} value={entry} onChange={(e) => setEntry(e.target.value)} /></Field>
          <Field label="Stop loss" htmlFor="stop" tone="down"><input id="stop" inputMode="decimal" className={inputCls} value={stop} onChange={(e) => setStop(e.target.value)} /></Field>
          <Field label="Take profit" htmlFor="tp" tone="up"><input id="tp" inputMode="decimal" className={inputCls} value={tp} onChange={(e) => setTp(e.target.value)} /></Field>
          <Field label="Account size ($)" htmlFor="acct"><input id="acct" inputMode="decimal" className={inputCls} value={acct} onChange={(e) => setAcct(e.target.value)} /></Field>
          <Field label="Risk per trade (%)" htmlFor="risk"><input id="risk" inputMode="decimal" className={inputCls} value={risk} onChange={(e) => setRisk(e.target.value)} /></Field>
          <Field label={`Leverage (1–${ex.maxLeverage}x)`} htmlFor="lev">
            <input id="lev" inputMode="numeric" className={inputCls} value={lev} onChange={(e) => setLev(e.target.value.replace(/[^0-9]/g, ""))} onBlur={() => setLev(String(leverage))} />
            <div role="group" aria-label="Leverage presets" className="flex flex-wrap gap-1.5 pt-1">
              {[...LEVERAGE_PRESETS.filter((p) => p < ex.maxLeverage), ex.maxLeverage].map((p) => <Chip key={p} on={leverage === p} onClick={() => setLev(String(p))}>{p}x</Chip>)}
            </div>
          </Field>
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
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-surface p-3"><p className="text-xs text-muted-foreground">Est. round-trip fees</p><p className="font-mono text-sm font-semibold">${fmt(c.fees, 2)}</p></div>
            <div className="rounded-lg bg-surface p-3"><p className="text-xs text-muted-foreground">Exchange</p><p className="truncate text-sm font-semibold">{ex.label}</p></div>
            <div className="rounded-lg bg-surface p-3"><p className="text-xs text-muted-foreground">Margin needed ({leverage}x)</p><p className="font-mono text-sm font-semibold">${fmt(c.margin, 2)}</p></div>
            <div className="rounded-lg bg-surface p-3"><p className="text-xs text-muted-foreground">Est. liquidation</p><p className="font-mono text-sm font-semibold">{c.liq ? `$${fmt(c.liq, pricePrecision(c.liq))}` : "None (1x)"}</p></div>
          </div>
          {c.liqBeforeStop && <Notice tone="down">Liquidation (~${fmt(c.liq ?? 0, 2)}) would hit before your stop. Lower the leverage or move the stop closer.</Notice>}
          {c.overMargin && <Notice tone="down">This position needs ${fmt(c.margin, 0)} of margin, more than your ${fmt(n(acct), 0)} account. Raise the leverage or cut the risk.</Notice>}
          {leverage > 20 && !c.liqBeforeStop && <Notice tone="warn">{leverage}x leaves very little room. Small moves against you can liquidate the trade.</Notice>}
          {c.badStop && <Notice tone="down">{dir === "long" ? "For a long, stop must be below entry and target above it." : "For a short, stop must be above entry and target below it."}</Notice>}
          {c.warnRR && <Notice tone="warn">R:R is below 1.5. Widen the target or tighten the stop.</Notice>}
          {c.warnRisk && <Notice tone="warn">Risk is above 2% of your account.</Notice>}
          {allGood && <Notice tone="up">Plan is within your risk rules.</Notice>}
        </Panel>

        <Panel className="space-y-3">
          <PanelTitle muted right={<button type="button" onClick={goJournal} className="text-xs font-medium text-brand hover:underline">Go to journal →</button>}>Active plans</PanelTitle>
          {active.length === 0 && <p className="text-sm text-muted-foreground">No open or planned trades yet.</p>}
          {active.slice(0, 6).map((t) => {
            const calc = positionCalc(t);
            const rr = calc.rr;
            const mark = prices[toPair(t.sym)];
            const mine = t.source === "paper"; // synced from mock trading: closed in the terminal, not here
            const upnl = mark && t.status === "open" ? (mark - t.entry) * (t.qty ?? calc.size) * (t.dir === "long" ? 1 : -1) : null;
            return (
              <div key={t.id} className="flex items-center justify-between gap-3 rounded-lg bg-surface p-3">
                <div className="min-w-0">
                  <p className="truncate font-mono text-sm font-semibold">{t.sym} <span className={t.dir === "long" ? "text-up" : "text-down"}>{t.dir === "long" ? "Long" : "Short"}</span></p>
                  <p className="text-xs text-muted-foreground">Entry {fmt(t.entry)}{rr > 0 ? ` · R:R ${fmt(rr, 1)}` : ""} · {mine ? "Mock trading" : t.setup}{(t.leverage ?? 1) > 1 ? ` · ${t.leverage}x` : ""}</p>
                  {mark && (
                    <p className="text-xs text-muted-foreground">Now <span className="font-mono">${fmt(mark, pricePrecision(mark))}</span>
                      {upnl != null && <span className={cn("ml-2 font-mono font-semibold", upnl >= 0 ? "text-up" : "text-down")}>{upnl >= 0 ? "+" : "−"}${fmt(Math.abs(upnl), 2)}</span>}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {statusPill(t.status)}
                  {mine && <Link href="/trade" className="text-xs font-medium text-brand hover:underline">Manage</Link>}
                  {!mine && t.status === "planned" && <button type="button" onClick={() => planner.update(t.id, { status: "open", openedAt: localISO() })} className="text-xs font-medium text-brand hover:underline">Open</button>}
                  {!mine && <button type="button" aria-label={`Cancel ${t.sym} plan`} onClick={() => planner.update(t.id, { status: "cancelled" })} className="text-xs text-muted-foreground hover:text-down">✕</button>}
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
