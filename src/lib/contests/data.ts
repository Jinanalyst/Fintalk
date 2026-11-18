import type { Contest, ContestSummary, Leaderboard } from "./types";
import { contestStatus, floorToHour, freezeStart, isFrozen } from "./time";
import { MOCK_CONTESTS, isSampleContest, mockLeaderboard } from "./mock";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

/**
 * Data access for contests. Everything reads through these functions so the mock can be swapped out.
 *
 * TODO(supabase): replace the bodies with queries against `contests`, `participants` and
 * `ranking_snapshots` (see supabase/migrations/20261124_contests.sql). For the leaderboard call the
 * `contest_leaderboard(p_contest)` RPC — it already enforces the 24h freeze server-side.
 */

export async function getContest(id: string): Promise<Contest | null> {
  return MOCK_CONTESTS.find((c) => c.id === id) ?? null;
}

export async function getLeaderboard(c: Contest, now = Date.now()): Promise<Leaderboard> {
  const status = contestStatus(c, now);
  if (status === "upcoming") return { rows: [], asOf: null, frozen: false };
  if (status === "ended") return { rows: mockLeaderboard(c.id), asOf: c.endsAt, frozen: false };
  if (isFrozen(c, now)) return { rows: mockLeaderboard(c.id, "frozen"), asOf: new Date(freezeStart(c)).toISOString(), frozen: true };
  return { rows: mockLeaderboard(c.id), asOf: new Date(floorToHour(now)).toISOString(), frozen: false };
}

/** Real sign-up count from the database (0 when Supabase is not configured or the call fails). */
async function getRegisteredCount(): Promise<number> {
  if (!isSupabaseConfigured) return 0;
  try {
    const { data, error } = await (await createClient()).rpc("contest_registered_count");
    return error || typeof data !== "number" ? 0 : data;
  } catch {
    return 0;
  }
}

export async function getParticipantCount(c: Contest, lb?: Leaderboard): Promise<number> {
  if (contestStatus(c) === "upcoming") return getRegisteredCount();
  return (lb ?? (await getLeaderboard(c))).rows.length;
}

/** All contests, newest round first, with the headline numbers shown in the list. */
export async function getContestSummaries(now = Date.now()): Promise<ContestSummary[]> {
  const list = [...MOCK_CONTESTS].sort((a, b) => b.number - a.number);
  return Promise.all(
    list.map(async (c) => {
      const lb = await getLeaderboard(c, now);
      const top = lb.rows.find((r) => r.rank === 1);
      return {
        ...c,
        status: contestStatus(c, now),
        participants: await getParticipantCount(c, lb),
        prizeTotal: c.prizes.reduce((a, b) => a + b, 0),
        isSample: isSampleContest(c.id),
        leader: top ? { nickname: top.nickname, returnPct: top.returnPct } : null,
      };
    }),
  );
}
