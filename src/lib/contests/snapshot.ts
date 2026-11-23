import { createClient as createPlainClient } from "@supabase/supabase-js";
import type { Contest, LeaderboardRow } from "./types";
import { floorToHour } from "./time";
import { SUPABASE_KEY, SUPABASE_URL, isSupabaseConfigured } from "@/lib/supabase/env";

/** Raw per-participant numbers, as measured from paper trading at one point in time. */
export type ParticipantStats = {
  userId: string;
  nickname: string;
  /** Total return vs. starting balance, in %. */
  returnPct: number;
  /** Max drawdown over the contest so far, in % (positive number). */
  mddPct: number;
  /** Number of fully closed trades. */
  trades: number;
  /** Set by admins after review (multi-account, self-referral…). Always disqualifies. */
  manualDqReason?: string | null;
};

/**
 * Sort order of the leaderboard. Swap the default here to rank by a risk-adjusted metric later
 * (e.g. return / max drawdown) — nothing else needs to change.
 * Returns < 0 when `a` ranks above `b`.
 */
export type RankRule = (a: Pick<LeaderboardRow, "returnPct" | "mddPct" | "trades">, b: Pick<LeaderboardRow, "returnPct" | "mddPct" | "trades">) => number;

export const RANK_RULES = {
  /** Highest return first; ties → lower drawdown, then more trades. */
  returnPct: (a, b) => b.returnPct - a.returnPct || a.mddPct - b.mddPct || b.trades - a.trades,
  /** Example risk-adjusted rule: return per unit of drawdown (drawdown floored at 1%). */
  returnOverDrawdown: (a, b) => b.returnPct / Math.max(1, b.mddPct) - a.returnPct / Math.max(1, a.mddPct) || b.returnPct - a.returnPct,
} satisfies Record<string, RankRule>;

/** The rule used everywhere (snapshot job and sample data). */
export const rankBy: RankRule = RANK_RULES.returnPct;

/**
 * Pure ranking logic (shared by the mock data and the real snapshot job).
 *  - MDD above the limit  → disqualified
 *  - admin flag           → disqualified
 *  - trades >= minTrades  → "qualified" (prize-eligible); others stay ranked but show ⏳
 *  - Non-disqualified entries are ranked by return; disqualified ones are kept, unranked, at the bottom.
 */
export function buildRows(contest: Pick<Contest, "minTrades" | "mddLimit">, stats: ParticipantStats[]): LeaderboardRow[] {
  const rows: LeaderboardRow[] = stats.map((s) => {
    const dqReason = s.manualDqReason || (s.mddPct > contest.mddLimit ? `MDD above ${contest.mddLimit}%` : undefined);
    return {
      userId: s.userId,
      nickname: s.nickname,
      rank: null,
      returnPct: s.returnPct,
      mddPct: s.mddPct,
      trades: s.trades,
      qualified: s.trades >= contest.minTrades,
      disqualified: !!dqReason,
      dqReason,
    };
  });
  const active = rows.filter((r) => !r.disqualified).sort(rankBy);
  active.forEach((r, i) => (r.rank = i + 1));
  const dq = rows.filter((r) => r.disqualified).sort((a, b) => b.returnPct - a.returnPct);
  return [...active, ...dq];
}

/**
 * Hourly snapshot job. Called by /api/contests/snapshot (cron, top of every hour).
 *
 * Steps:
 *  1. Skip contests that are not live. Skip while frozen (last 24h) if `freezeLast24h` is on —
 *     the leaderboard keeps serving the snapshot taken at the freeze time. One final snapshot is
 *     taken right at `endsAt`, and that is the permanent final ranking.
 *  2. Measure each participant's stats  → `loadStats()` below (the ONLY place to wire real data).
 *  3. Rank with buildRows() and insert into `ranking_snapshots` with snapshot_at = top of the hour.
 */
export async function runSnapshot(
  contest: Contest,
  now = Date.now(),
): Promise<{ snapshotAt: string; rows: LeaderboardRow[] }> {
  // A round that just ended gets one final snapshot stamped at its end time.
  const snapshotAt = new Date(Math.min(floorToHour(now), Date.parse(contest.endsAt))).toISOString();
  const stats = await loadStats(contest);
  return { snapshotAt, rows: buildRows(contest, stats) };
}

const n = (v: unknown) => Math.round(Number(v) * 100) / 100;

/** Anonymous client: the snapshot RPCs are protected by the tick secret, not by a user session. */
function rpcClient() {
  return isSupabaseConfigured ? createPlainClient(SUPABASE_URL!, SUPABASE_KEY!, { auth: { persistSession: false } }) : null;
}

/**
 * Per-participant numbers from the database (contest_snapshot_stats):
 *   returnPct = (equity − start balance) / start balance, equity = balance + open margin + unrealized PnL
 *   mddPct    = running max drawdown of equity, updated by every price tick (and frozen at the end)
 *   trades    = closed contest trades inside the round
 */
async function loadStats(contest: Contest): Promise<ParticipantStats[]> {
  const sb = rpcClient();
  const secret = process.env.TRADE_TICK_SECRET;
  if (!sb || !secret || contest.source !== "db") return [];
  const { data, error } = await sb.rpc("contest_snapshot_stats", { p_secret: secret, p_contest: Number(contest.id) });
  if (error) {
    console.error("[contest] snapshot stats failed:", error.message);
    return [];
  }
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    userId: String(r.user_id),
    nickname: String(r.nickname),
    returnPct: n(r.return_pct),
    mddPct: n(r.mdd_pct),
    trades: Number(r.trades_count),
    manualDqReason: (r.dq_reason as string | null) ?? null,
  }));
}

/** Store one snapshot (idempotent per contest × user × hour). */
export async function writeSnapshot(contest: Contest, snapshotAt: string, rows: LeaderboardRow[]): Promise<number> {
  const sb = rpcClient();
  const secret = process.env.TRADE_TICK_SECRET;
  if (!sb || !secret || contest.source !== "db" || rows.length === 0) return 0;
  const { data, error } = await sb.rpc("contest_write_snapshot", {
    p_secret: secret,
    p_contest: Number(contest.id),
    p_at: snapshotAt,
    p_rows: rows.map((r) => ({
      user_id: r.userId,
      rank: r.rank,
      return_pct: r.returnPct,
      mdd_pct: r.mddPct,
      trades_count: r.trades,
      qualified: r.qualified,
      disqualified: r.disqualified,
      dq_reason: r.dqReason ?? null,
    })),
  });
  if (error) {
    console.error("[contest] snapshot write failed:", error.message);
    return 0;
  }
  return Number(data ?? 0);
}
