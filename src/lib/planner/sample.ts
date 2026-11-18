import type { Trade } from "./types";

// [day, hour, holdMin, symbol, dir, setup, R, checks passed, emotion]
const ROWS: [number, number, number, string, "long" | "short", string, number, number, string][] = [
  [2, 10, 240, "ETH-USDT", "long", "Pullback", 1.4, 4, "Calm"],
  [3, 9, 300, "BTC-USDT", "long", "Breakout", 2.2, 4, "Calm"],
  [3, 14, 120, "SOL-USDT", "short", "Range", -1.0, 3, "Calm"],
  [4, 10, 360, "ETH-USDT", "long", "Pullback", 1.8, 4, "Calm"],
  [5, 11, 200, "BTC-USDT", "long", "Trend", 0.9, 3, "Calm"],
  [6, 9, 60, "BTC-USDT", "short", "Range", -1.1, 2, "FOMO"],
  [6, 10, 45, "ETH-USDT", "long", "Breakout", -1.0, 2, "Fear"],
  [6, 15, 30, "SOL-USDT", "long", "Unplanned", -0.6, 0, "Revenge"],
  [9, 10, 280, "ETH-USDT", "short", "Pullback", 1.6, 4, "Calm"],
  [10, 9, 220, "BTC-USDT", "long", "Pullback", 0.7, 4, "Calm"],
  [10, 22, 90, "DOGE-USDT", "long", "Unplanned", -0.7, 0, "Bored"],
  [11, 10, 300, "ETH-USDT", "short", "Trend", 1.8, 4, "Calm"],
  [12, 1, 150, "BTC-USDT", "long", "Range", -0.9, 2, "Fear"],
  [12, 23, 80, "DOGE-USDT", "long", "Unplanned", -0.6, 0, "Bored"],
  [13, 9, 120, "BTC-USDT", "long", "News", -2.0, 1, "FOMO"],
  [13, 11, 40, "BTC-USDT", "short", "Range", -1.2, 2, "Revenge"],
  [13, 16, 100, "ETH-USDT", "long", "News", -1.0, 1, "FOMO"],
  [14, 10, 330, "SOL-USDT", "long", "Breakout", 2.2, 3, "Calm"],
  [16, 14, 90, "BTC-USDT", "short", "Range", -1.3, 2, "Revenge"],
  [16, 20, 260, "ETH-USDT", "long", "Pullback", 1.2, 4, "Calm"],
  [17, 10, 230, "ETH-USDT", "long", "Pullback", 1.4, 4, "Calm"],
  [17, 13, 300, "SOL-USDT", "long", "Breakout", 1.9, 3, "Calm"],
  [17, 21, 200, "BTC-USDT", "long", "Trend", 1.0, 3, "Greedy"],
  [18, 9, 220, "ETH-USDT", "long", "Pullback", 2.3, 4, "Calm"],
];

const p = (n: number) => String(n).padStart(2, "0");
const iso = (day: number, h: number, m = 0) => `2026-11-${p(day)}T${p(h)}:${p(m)}:00`;
const add = (day: number, h: number, mins: number) => {
  const total = h * 60 + mins;
  return iso(day + Math.floor(total / 1440), Math.floor((total % 1440) / 60), total % 60);
};

/** Fixed example data so every screen has something to show before a user logs a trade. */
export function sampleTrades(): Trade[] {
  const closed = ROWS.map(([day, hour, hold, sym, dir, setup, r, ok, emotion], i): Trade => {
    const entry = sym.startsWith("BTC") ? 97000 : sym.startsWith("ETH") ? 3420 : sym.startsWith("SOL") ? 180 : 0.4;
    const dist = entry * 0.02;
    const sign = dir === "long" ? 1 : -1;
    const unplanned = setup === "Unplanned";
    return {
      id: `sample-${i}`,
      source: "sample",
      sym,
      exch: "OKX",
      dir,
      tf: "1h",
      entry,
      stop: entry - sign * dist,
      tp: entry + sign * dist * 2.5,
      acct: 10000,
      riskPct: 1,
      setup,
      why: "",
      chart: "",
      status: "closed",
      createdAt: iso(day, hour),
      openedAt: iso(day, hour, unplanned ? 0 : 5),
      closedAt: add(day, hour, hold),
      plannedRR: unplanned ? undefined : 2.5,
      actualEntry: entry,
      actualExit: entry + sign * dist * r,
      fees: 0,
      exitReason: r > 0 ? "Manual — early" : "Stop hit",
      emotion,
      checks: [0, 1, 2, 3].map((k) => !unplanned && k < ok),
      lesson: "",
      pnl: Math.round(r * 100),
      r,
    };
  });

  const open: Trade = {
    id: "sample-open",
    source: "sample",
    sym: "ETH-USDT",
    exch: "OKX",
    dir: "long",
    tf: "1h",
    entry: 3420,
    stop: 3350,
    tp: 3602,
    acct: 10000,
    riskPct: 1,
    setup: "Pullback",
    why: "Reclaimed the 4h level; stop below the swing low.",
    chart: "",
    status: "open",
    createdAt: iso(18, 8),
    openedAt: iso(18, 8, 20),
    plannedRR: 2.6,
  };
  const planned: Trade = {
    id: "sample-planned",
    source: "sample",
    sym: "SOL-USDT",
    exch: "OKX",
    dir: "short",
    tf: "4h",
    entry: 182.4,
    stop: 187.2,
    tp: 172.3,
    acct: 10000,
    riskPct: 1,
    setup: "Range",
    why: "Rejection at range high.",
    chart: "",
    status: "planned",
    createdAt: iso(18, 9),
    plannedRR: 2.1,
  };
  return [...closed, open, planned];
}
