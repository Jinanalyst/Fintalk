import type { Contest, LeaderboardRow } from "./types";
import { floorToHour } from "./time";

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
  const active = rows.filter((r) => !r.disqualified).sort((a, b) => b.returnPct - a.returnPct || b.trades - a.trades);
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
  const snapshotAt = new Date(floorToHour(now)).toISOString();
  const stats = await loadStats(contest);
  return { snapshotAt, rows: buildRows(contest, stats) };
}

/**
 * TODO(paper-trading): connect real paper-trading data here.
 *
 * For each row in `participants` (status != 'disqualified' unless you want to keep tracking them) return:
 *   - returnPct : (equity_now − contest.startingBalance) / contest.startingBalance * 100
 *                 where equity comes from the paper account balance + unrealized PnL.
 *   - mddPct    : max peak-to-trough drop of the equity curve since contest.startsAt (needs an
 *                 equity history table or hourly equity rows — not in the schema yet).
 *   - trades    : count of closed rows in `paper_trades` with closed_at between startsAt and endsAt
 *                 (see supabase/migrations/20261120_paper_leaderboard.sql for the existing aggregation).
 *   - manualDqReason : participants.dq_reason
 * Important: the contest needs its own virtual account reset to 10,000 USDT at join time, otherwise the
 * existing global paper balance would leak into the contest.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function loadStats(_contest: Contest): Promise<ParticipantStats[]> {
  return [];
}
