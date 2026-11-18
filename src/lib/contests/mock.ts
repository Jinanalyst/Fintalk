import type { Contest, LeaderboardRow } from "./types";
import { buildRows, type ParticipantStats } from "./snapshot";
import { DAY } from "./time";

/** Deterministic PRNG so the mock data is stable between renders. */
function rng(seed: number) {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const NAMES = [
  "satoshi_jr", "AlphaWolf", "bullrun88", "ChartNinja", "DeltaDan", "EthEnjoyer", "FibFox", "GammaRay", "HodlHannah", "IronCondor",
  "JpegJoe", "KellyKat", "LeverageLou", "MoonMia", "NightTrader", "OrderFlow", "PipPilot", "QuantQuinn", "RSI_Rider", "ScalpSam",
  "TrendTina", "UptickUma", "VolVince", "WickWatcher", "XrpXavier", "YieldYara", "ZenTrader", "BasisBen", "CandleCarl", "DipBuyer99",
  "EdgeEmma", "FuturesFin", "GridGuru", "HedgeHal", "IchimokuIvy", "JadeJack", "KnifeCatcher", "LiquidityLeo",
];

function mockStats(contestId: string, seed: number, count: number, opts: { dq: number; short: number; ended: boolean }): ParticipantStats[] {
  const r = rng(seed);
  const out: ParticipantStats[] = [];
  for (let i = 0; i < count; i++) {
    let returnPct = (r() - 0.38) * (opts.ended ? 220 : 90);
    let mddPct = 4 + r() * 50;
    let trades = 10 + Math.floor(r() * 90);
    let manualDqReason: string | undefined;
    if (i >= count - opts.dq) {
      // disqualified: either MDD blown or admin-flagged
      if (i % 2 === 0) mddPct = 72 + r() * 24;
      else manualDqReason = "Multiple accounts detected";
      returnPct = r() * 160 - 20;
    } else if (i >= count - opts.dq - opts.short) {
      trades = 2 + Math.floor(r() * 7); // not yet qualified
    }
    out.push({
      userId: `${contestId}-u${i}`,
      nickname: NAMES[(i * 7 + seed) % NAMES.length] + (i >= NAMES.length ? String(i) : ""),
      returnPct: Math.round(returnPct * 100) / 100,
      mddPct: Math.round(mddPct * 100) / 100,
      trades,
      manualDqReason,
    });
  }
  // de-dupe nicknames
  const seen = new Set<string>();
  for (const s of out) {
    while (seen.has(s.nickname)) s.nickname += "_";
    seen.add(s.nickname);
  }
  return out;
}

const day0 = Math.floor(Date.now() / DAY) * DAY;
const iso = (ms: number) => new Date(ms).toISOString();

const base = { prizes: [50, 30, 20] as [number, number, number], startingBalance: 10_000, minTrades: 10, mddLimit: 70 };

export const MOCK_CONTESTS: Contest[] = [
  { ...base, id: "3", number: 3, name: "FinTalk Trading Championship #3", startsAt: iso(day0 + 14 * DAY), endsAt: iso(day0 + 44 * DAY), freezeLast24h: true },
  { ...base, id: "2", number: 2, name: "FinTalk Trading Championship #2", startsAt: iso(day0 - 10 * DAY), endsAt: iso(day0 + 20 * DAY), freezeLast24h: true },
  { ...base, id: "1", number: 1, name: "FinTalk Trading Championship #1", startsAt: iso(day0 - 50 * DAY), endsAt: iso(day0 - 20 * DAY), freezeLast24h: false },
];

type MockSpec = { seed: number; count: number; dq: number; short: number; ended: boolean };
const SPEC: Record<string, MockSpec> = {
  "1": { seed: 11, count: 31, dq: 3, short: 4, ended: true },
  "2": { seed: 23, count: 33, dq: 2, short: 5, ended: false },
  "3": { seed: 5, count: 0, dq: 0, short: 0, ended: false }, // upcoming: nobody has traded yet
};

/** Registered-participant count for an upcoming contest (no stats yet). */
export const MOCK_REGISTERED: Record<string, number> = { "3": 28 };

/**
 * Mock leaderboard. `phase: "frozen"` returns a slightly older, different ordering to mimic the
 * snapshot taken at the start of the freeze window.
 */
export function mockLeaderboard(contestId: string, phase: "current" | "frozen" = "current"): LeaderboardRow[] {
  const s = SPEC[contestId];
  const c = MOCK_CONTESTS.find((x) => x.id === contestId);
  if (!s || !c || s.count === 0) return [];
  const stats = mockStats(contestId, s.seed, s.count, s);
  if (phase === "frozen") {
    const r = rng(s.seed + 100);
    for (const st of stats) st.returnPct = Math.round(st.returnPct * (0.8 + r() * 0.35) * 100) / 100;
  }
  return buildRows(c, stats);
}
