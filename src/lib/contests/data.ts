import { cache } from "react";
import type { Contest, ContestSummary, Leaderboard, LeaderboardRow } from "./types";
import { contestStatus, floorToHour, freezeStart, isFrozen } from "./time";
import { MOCK_CONTESTS, isSampleContest, mockLeaderboard } from "./mock";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

/**
 * Data access for contests. Everything reads through these functions.
 *
 * Rounds come from the `contests` table (created in /admin?tab=contest). Until that table has any
 * rows — or when Supabase is not configured — the built-in sample rounds in ./mock are used instead.
 * Leaderboards of real rounds are read through the `contest_leaderboard(p_contest)` RPC, which
 * enforces the 24h freeze server-side.
 */

export type ContestRow = {
  id: number;
  number: number;
  name: string;
  starts_at: string;
  ends_at: string;
  prize_1: number;
  prize_2: number;
  prize_3: number;
  starting_balance: number;
  min_trades: number;
  mdd_limit: number;
  freeze_last_24h: boolean;
  featured?: boolean | null;
  registration_ends_at?: string | null;
  max_leverage?: number | null;
  referral_bonus_pct?: number | null;
};

export const fromRow = (r: ContestRow): Contest => ({
  id: String(r.id),
  number: r.number,
  name: r.name,
  startsAt: r.starts_at,
  endsAt: r.ends_at,
  prizes: [Number(r.prize_1), Number(r.prize_2), Number(r.prize_3)],
  startingBalance: Number(r.starting_balance),
  minTrades: r.min_trades,
  mddLimit: Number(r.mdd_limit),
  freezeLast24h: r.freeze_last_24h,
  featured: !!r.featured,
  registrationEndsAt: r.registration_ends_at ?? r.starts_at,
  maxLeverage: r.max_leverage ?? undefined,
  referralBonusPct: r.referral_bonus_pct === null || r.referral_bonus_pct === undefined ? undefined : Number(r.referral_bonus_pct),
  source: "db",
});

/** Every round, newest number first. Cached per request. */
export const listContests = cache(async (): Promise<Contest[]> => {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await (await createClient()).from("contests").select("*").order("number", { ascending: false });
      if (!error && data && data.length > 0) return (data as ContestRow[]).map(fromRow);
    } catch {
      // fall through to the sample rounds
    }
  }
  return [...MOCK_CONTESTS].sort((a, b) => b.number - a.number);
});

export async function getContest(id: string): Promise<Contest | null> {
  return (await listContests()).find((c) => c.id === id) ?? null;
}

type RpcRow = {
  nickname: string;
  rank: number | null;
  return_pct: number;
  mdd_pct: number;
  trades_count: number;
  qualified: boolean;
  disqualified: boolean;
  dq_reason: string | null;
  user_id: string;
  snapshot_at: string;
};

async function dbLeaderboard(c: Contest, now: number): Promise<Leaderboard> {
  const frozen = contestStatus(c, now) === "live" && isFrozen(c, now);
  try {
    const { data, error } = await (await createClient()).rpc("contest_leaderboard", { p_contest: Number(c.id) });
    if (error || !data) return { rows: [], asOf: null, frozen };
    const list = data as RpcRow[];
    const rows: LeaderboardRow[] = list.map((r) => ({
      userId: r.user_id,
      nickname: r.nickname,
      rank: r.rank,
      returnPct: Number(r.return_pct),
      mddPct: Number(r.mdd_pct),
      trades: r.trades_count,
      qualified: r.qualified,
      disqualified: r.disqualified,
      dqReason: r.dq_reason ?? undefined,
    }));
    return { rows, asOf: list[0]?.snapshot_at ?? null, frozen };
  } catch {
    return { rows: [], asOf: null, frozen };
  }
}

export async function getLeaderboard(c: Contest, now = Date.now()): Promise<Leaderboard> {
  const status = contestStatus(c, now);
  if (status === "upcoming") return { rows: [], asOf: null, frozen: false };
  if (c.source === "db") return dbLeaderboard(c, now);
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

/** The round people can join right now: the featured one if still open, else the soonest upcoming, else the live one. */
export async function getJoinableContest(now = Date.now()): Promise<Contest | null> {
  const open = (await listContests()).filter((c) => contestStatus(c, now) !== "ended");
  const featured = open.find((c) => c.featured);
  if (featured) return featured;
  const upcoming = open.filter((c) => contestStatus(c, now) === "upcoming").sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt));
  return upcoming[0] ?? open.find((c) => contestStatus(c, now) === "live") ?? null;
}

async function summarize(c: Contest, now: number): Promise<ContestSummary> {
  const lb = await getLeaderboard(c, now);
  const top = lb.rows.find((r) => r.rank === 1);
  return {
    ...c,
    status: contestStatus(c, now),
    participants: await getParticipantCount(c, lb),
    prizeTotal: c.prizes.reduce((a, b) => a + b, 0),
    isSample: isSampleContest(c),
    leader: top ? { nickname: top.nickname, returnPct: top.returnPct } : null,
  };
}

/** All contests, newest round first, with the headline numbers shown in the list. */
export async function getContestSummaries(now = Date.now()): Promise<ContestSummary[]> {
  return Promise.all((await listContests()).map((c) => summarize(c, now)));
}

/**
 * The round for the home-page banner: the one an admin marked as featured; otherwise the live round,
 * then the soonest upcoming one, then the most recent.
 */
export async function getFeaturedContest(now = Date.now()): Promise<ContestSummary | null> {
  const list = await listContests();
  const pick =
    list.find((c) => c.featured) ??
    list.find((c) => contestStatus(c, now) === "live") ??
    list.filter((c) => contestStatus(c, now) === "upcoming").sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt))[0] ??
    list[0];
  return pick ? summarize(pick, now) : null;
}
