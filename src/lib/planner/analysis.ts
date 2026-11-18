import { adherence, dayOf, holdMinutes, hourOf, parse } from "./calc";
import type { Trade } from "./types";

const when = (t: Trade) => t.closedAt ?? t.createdAt;

export const closedTrades = (ts: Trade[]) =>
  ts.filter((t) => t.status === "closed" && t.pnl != null).sort((a, b) => parse(when(a)) - parse(when(b)));

const mean = (a: number[]) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
const rOf = (a: Trade[]) => mean(a.filter((t) => t.r != null).map((t) => t.r!));

export function kpis(ts: Trade[]) {
  const c = closedTrades(ts);
  const wins = c.filter((t) => t.pnl! > 0);
  const losses = c.filter((t) => t.pnl! < 0);
  const gw = wins.reduce((s, t) => s + t.pnl!, 0);
  const gl = Math.abs(losses.reduce((s, t) => s + t.pnl!, 0));

  let run = 0, peak = 0, maxDd = 0, ddFrom = "", ddTo = "", peakDay = "";
  const base = c[0]?.acct ?? 10000;
  const curve = c.map((t) => {
    run += t.pnl!;
    if (run > peak) { peak = run; peakDay = dayOf(when(t)); }
    if (peak - run > maxDd) { maxDd = peak - run; ddFrom = peakDay; ddTo = dayOf(when(t)); }
    return { day: dayOf(when(t)), total: run };
  });

  return {
    n: c.length,
    wins: wins.length,
    losses: losses.length,
    winRate: c.length ? (wins.length / c.length) * 100 : 0,
    net: gw - gl,
    profitFactor: gl > 0 ? gw / gl : gw > 0 ? Infinity : 0,
    expectancy: rOf(c),
    avgWinR: rOf(wins),
    avgLossR: rOf(losses),
    maxDdAmt: maxDd,
    maxDdPct: (maxDd / base) * 100,
    ddFrom,
    ddTo,
    curve,
  };
}

export function bySetup(ts: Trade[]) {
  const m = new Map<string, Trade[]>();
  for (const t of closedTrades(ts)) m.set(t.setup || "Other", [...(m.get(t.setup || "Other") ?? []), t]);
  return [...m.entries()]
    .map(([name, a]) => ({ name, n: a.length, wr: (a.filter((t) => t.pnl! > 0).length / a.length) * 100, avgR: rOf(a), pnl: a.reduce((s, t) => s + t.pnl!, 0) }))
    .sort((a, b) => b.avgR - a.avgR);
}

const SLOTS: [string, number, number][] = [
  ["00–03", 0, 3], ["03–06", 3, 6], ["06–09", 6, 9], ["09–12", 9, 12],
  ["12–15", 12, 15], ["15–18", 15, 18], ["18–21", 18, 21], ["21–24", 21, 24],
];
export function byHour(ts: Trade[]) {
  return SLOTS.map(([slot, a, b]) => {
    const g = closedTrades(ts).filter((t) => {
      const h = hourOf(t.openedAt ?? t.createdAt);
      return h >= a && h < b;
    });
    return { slot, n: g.length, avgR: rOf(g), wr: g.length ? (g.filter((t) => t.pnl! > 0).length / g.length) * 100 : 0 };
  }).filter((s) => s.n > 0);
}

export function byEmotion(ts: Trade[]) {
  const m = new Map<string, Trade[]>();
  for (const t of closedTrades(ts)) if (t.emotion) m.set(t.emotion, [...(m.get(t.emotion) ?? []), t]);
  return [...m.entries()].map(([name, a]) => ({ name, n: a.length, pnl: a.reduce((s, t) => s + t.pnl!, 0) })).sort((a, b) => a.pnl - b.pnl);
}

export function planVsReality(ts: Trade[]) {
  const c = closedTrades(ts);
  const checked = c.filter((t) => t.checks);
  const stopOk = checked.filter((t) => t.checks![1]);
  const stopBad = checked.filter((t) => !t.checks![1]);
  const wr = (a: Trade[]) => (a.length ? (a.filter((t) => t.pnl! > 0).length / a.length) * 100 : 0);
  const unplanned = c.filter((t) => t.setup === "Unplanned" || t.source === "import");
  const planned = c.filter((t) => !unplanned.includes(t));
  return {
    stop: { ok: { n: stopOk.length, wr: wr(stopOk), r: rOf(stopOk) }, bad: { n: stopBad.length, wr: wr(stopBad), r: rOf(stopBad) } },
    plan: { planned: { n: planned.length, r: rOf(planned) }, unplanned: { n: unplanned.length, r: rOf(unplanned) } },
  };
}

export type Flag = { level: "HIGH" | "MED"; title: string; text: string };
export function behaviorFlags(ts: Trade[]): Flag[] {
  const c = closedTrades(ts);
  const flags: Flag[] = [];

  const revenge = c.filter((t, i) => {
    const prev = c[i - 1];
    if (!prev || prev.pnl! >= 0 || !prev.closedAt || !t.openedAt) return false;
    const gap = parse(t.openedAt) - parse(prev.closedAt);
    return gap >= 0 && gap <= 30 * 60000;
  });
  if (revenge.length >= 2) {
    const r = rOf(revenge);
    flags.push({ level: "HIGH", title: "Revenge trading", text: `${revenge.length} trades opened within 30 minutes of a loss. Average result ${r < 0 ? "−" : ""}${Math.abs(r).toFixed(1)}R.` });
  }

  const wins = c.filter((t) => t.pnl! > 0 && t.r != null && t.plannedRR);
  if (wins.length >= 3) {
    const got = mean(wins.map((t) => t.r!));
    const plan = mean(wins.map((t) => t.plannedRR!));
    if (got < plan * 0.8) flags.push({ level: "MED", title: "Cutting winners early", text: `Average winner ${got.toFixed(1)}R against a planned ${plan.toFixed(1)}R. That gap costs about ${(plan - got).toFixed(1)}R per win.` });
  }

  const perDay = new Map<string, Trade[]>();
  c.forEach((t) => perDay.set(dayOf(when(t)), [...(perDay.get(dayOf(when(t))) ?? []), t]));
  const heavy = [...perDay.entries()].filter(([, a]) => a.length >= 3);
  if (heavy.length >= 2) {
    const worst = heavy.map(([d, a]) => ({ d, pnl: a.reduce((s, t) => s + t.pnl!, 0) })).sort((a, b) => a.pnl - b.pnl)[0];
    flags.push({ level: "MED", title: "Overtrading", text: `${heavy.length} days with 3+ trades. The worst of them was ${worst.d.slice(5).replace("-", "/")}.` });
  }
  return flags;
}

const sgn = (n: number) => `${n >= 0 ? "+" : "−"}${Math.abs(n).toFixed(2)}R`;

export function styleReport(ts: Trade[]) {
  const c = closedTrades(ts);
  const holds = c.map(holdMinutes).filter((h): h is number => h != null);
  const avgHold = mean(holds);
  const style = !holds.length ? "Not enough data" : avgHold < 60 ? "Scalper" : avgHold < 1440 ? "Day Trader" : avgHold < 10080 ? "Swing Trader" : "Position Trader";
  const days = new Set(c.map((t) => dayOf(when(t)))).size;
  const setups = bySetup(ts).filter((s) => s.n >= 3);
  const hours = byHour(ts).filter((h) => h.n >= 3);
  const pv = planVsReality(ts);
  const strengths: string[] = [];
  const weak: string[] = [];

  const best = setups[0], worst = setups[setups.length - 1];
  if (best && best.avgR > 0) strengths.push(`${best.name} entries: ${Math.round(best.wr)}% win rate, ${sgn(best.avgR)} average`);
  const bh = [...hours].sort((a, b) => b.avgR - a.avgR)[0];
  if (bh && bh.avgR > 0) strengths.push(`${bh.slot} is your best entry window (${sgn(bh.avgR)} per trade)`);
  if (pv.plan.planned.n >= 3 && pv.plan.planned.r > pv.plan.unplanned.r) strengths.push(`Planned trades average ${sgn(pv.plan.planned.r)}`);

  if (worst && worst !== best && worst.avgR < 0) weak.push(`${worst.name} trades average ${sgn(worst.avgR)} — consider skipping`);
  const wh = [...hours].sort((a, b) => a.avgR - b.avgR)[0];
  if (wh && wh.avgR < 0) weak.push(`Entries between ${wh.slot} average ${sgn(wh.avgR)}`);
  if (pv.plan.unplanned.n >= 2 && pv.plan.unplanned.r < 0) weak.push(`Unplanned trades average ${sgn(pv.plan.unplanned.r)}`);

  const adh = c.map((t) => adherence(t.checks)).filter((x): x is number => x != null);
  return { style, n: c.length, avgHold, perDay: days ? c.length / days : 0, longBias: c.length ? (c.filter((t) => t.dir === "long").length / c.length) * 100 : 0, strengths, weak, avgAdh: adh.length ? mean(adh) : null };
}

export const fmtHold = (m: number) => `${Math.floor(m / 60)}h ${String(Math.round(m % 60)).padStart(2, "0")}m`;
