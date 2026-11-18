import type { Dir, Trade } from "./types";

/** Maintenance margin rate, same as the paper-trading engine. */
const MAINT = 0.005;

/** A trade that wasn't planned first: tagged Unplanned, imported from a CSV, or synced from paper trading. */
export const isUnplanned = (t: Trade) => t.setup === "Unplanned" || t.source === "import" || t.source === "paper";

export function positionCalc(i: { dir: Dir; entry: number; stop: number; tp: number; acct: number; riskPct: number; leverage?: number }) {
  const lev = Math.max(1, i.leverage ?? 1);
  const dist = Math.abs(i.entry - i.stop);
  const riskAmt = (i.acct * i.riskPct) / 100;
  const size = dist > 0 ? riskAmt / dist : 0;
  const reward = size * Math.abs(i.tp - i.entry);
  const rr = riskAmt > 0 ? reward / riskAmt : 0;
  const long = i.dir === "long";
  const badStop =
    i.entry <= 0 || i.stop <= 0 || i.tp <= 0 || (long ? i.stop >= i.entry || i.tp <= i.entry : i.stop <= i.entry || i.tp >= i.entry);
  const notional = size * i.entry;
  const margin = notional / lev;
  // Estimated isolated liquidation price (same formula as the mock trading engine).
  const liq = long ? i.entry * (1 - 1 / lev + MAINT) : i.entry * (1 + 1 / lev - MAINT);
  const liqBeforeStop = !badStop && lev > 1 && (long ? liq >= i.stop : liq <= i.stop);
  return {
    size,
    notional,
    margin,
    liq: lev > 1 ? liq : null,
    liqBeforeStop,
    overMargin: i.acct > 0 && margin > i.acct,
    riskAmt,
    reward,
    rr,
    badStop,
    warnRR: !badStop && rr < 1.5,
    warnRisk: i.riskPct > 2,
  };
}

/** Realized result of a planned trade, sized from the plan's risk. */
export function realized(t: Trade, actualEntry: number, actualExit: number, fees: number) {
  const { size, riskAmt } = positionCalc(t);
  const move = t.dir === "long" ? actualExit - actualEntry : actualEntry - actualExit;
  const pnl = move * size - fees;
  return { pnl, r: riskAmt > 0 ? pnl / riskAmt : null };
}

export const adherence = (checks?: boolean[]) => (checks ? Math.round((checks.filter(Boolean).length / 4) * 100) : null);

export const parse = (s: string) => new Date(s).getTime();
export const dayOf = (s: string) => s.slice(0, 10);
export const hourOf = (s: string) => parseInt(s.slice(11, 13), 10) || 0;

export const holdMinutes = (t: Trade) =>
  t.openedAt && t.closedAt ? Math.max(0, (parse(t.closedAt) - parse(t.openedAt)) / 60000) : null;

export function localISO(d = new Date()) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

export const fmt = (n: number, d = 2) => n.toLocaleString("en-US", { maximumFractionDigits: d, minimumFractionDigits: 0 });
export const money = (n: number, d = 0) => `${n > 0 ? "+" : n < 0 ? "−" : ""}$${fmt(Math.abs(n), d)}`;
export const rText = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n).toFixed(2)}R`;
export const tone = (n: number) => (n > 0 ? "text-up" : n < 0 ? "text-down" : "text-foreground");
export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
