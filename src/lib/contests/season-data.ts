import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { SEASON, seasonPhase, type SeasonPhase } from "@/lib/season";
import { fromRow, getLeaderboard, type ContestRow } from "./data";
import type { Contest, Leaderboard } from "./types";

/** The round the site is built around right now (contest landing, Trade bar, /leaderboard). */
export type Season = {
  /** contests.id, or null when the round only exists in src/lib/season.ts (Supabase not connected / migration not run). */
  id: number | null;
  name: string;
  label: string;
  startsAt: string;
  endsAt: string;
  registrationEndsAt: string;
  payoutDate: string;
  prizes: [number, number, number];
  startingBalance: number;
  maxLeverage: number;
  referralBonusPct: number;
  contest: Contest | null;
};

const fromConfig = (): Season => ({
  id: null,
  name: SEASON.name,
  label: SEASON.label,
  startsAt: SEASON.startsAt,
  endsAt: SEASON.endsAt,
  registrationEndsAt: SEASON.registrationEndsAt,
  payoutDate: SEASON.payoutDate,
  prizes: SEASON.prizes,
  startingBalance: SEASON.startingBalance,
  maxLeverage: SEASON.maxLeverage,
  referralBonusPct: SEASON.referralBonusPct,
  contest: null,
});

const fromContest = (c: Contest): Season => ({
  id: Number(c.id),
  name: c.name,
  label: /season\s*\d+/i.exec(c.name)?.[0].replace(/^s/, "S") ?? `Round ${c.number}`,
  startsAt: c.startsAt,
  endsAt: c.endsAt,
  registrationEndsAt: c.registrationEndsAt ?? c.startsAt,
  payoutDate: c.name === SEASON.name ? SEASON.payoutDate : new Date(Date.parse(c.endsAt) + 10 * 86_400_000).toISOString(),
  prizes: c.prizes,
  startingBalance: c.startingBalance,
  maxLeverage: c.maxLeverage ?? SEASON.maxLeverage,
  referralBonusPct: c.referralBonusPct ?? SEASON.referralBonusPct,
  contest: c,
});

/**
 * Current season: the featured round that has not ended, else the soonest round that has not ended,
 * else the most recently ended one. Falls back to src/lib/season.ts. Cached per request.
 */
export const getSeason = cache(async (): Promise<Season> => {
  if (!isSupabaseConfigured) return fromConfig();
  try {
    const sb = await createClient();
    const nowIso = new Date().toISOString();
    const { data, error } = await sb
      .from("contests")
      .select("*")
      .gt("ends_at", nowIso)
      .order("featured", { ascending: false })
      .order("starts_at", { ascending: true })
      .limit(1);
    if (error) return fromConfig();
    if (data?.[0]) return fromContest(fromRow(data[0] as ContestRow));
    const { data: last } = await sb.from("contests").select("*").order("ends_at", { ascending: false }).limit(1);
    return last?.[0] ? fromContest(fromRow(last[0] as ContestRow)) : fromConfig();
  } catch {
    return fromConfig();
  }
});

export const phaseOf = (s: Season, now = Date.now()): SeasonPhase => seasonPhase(s, now);
export const registrationOpen = (s: Season, now = Date.now()) => now < Date.parse(s.registrationEndsAt);

export type RecentTrader = { nickname: string; avatar: string | null; joinedAt: string };

export async function getSeasonParticipants(s: Season, limit = 5): Promise<{ count: number; recent: RecentTrader[] }> {
  if (s.id === null || !isSupabaseConfigured) return { count: 0, recent: [] };
  try {
    const sb = await createClient();
    const [cnt, rec] = await Promise.all([
      sb.rpc("contest_participant_count", { p_contest: s.id }),
      sb.rpc("contest_recent_participants", { p_contest: s.id, p_limit: limit }),
    ]);
    return {
      count: typeof cnt.data === "number" ? cnt.data : 0,
      recent: ((rec.data ?? []) as { nickname: string; avatar_url: string | null; joined_at: string }[]).map((r) => ({
        nickname: r.nickname,
        avatar: r.avatar_url,
        joinedAt: r.joined_at,
      })),
    };
  } catch {
    return { count: 0, recent: [] };
  }
}

export async function getSeasonLeaderboard(s: Season): Promise<Leaderboard> {
  if (!s.contest) return { rows: [], asOf: null, frozen: false };
  return getLeaderboard(s.contest);
}

/** The signed-in user's season status (null when logged out). Creates the contest account once the round is live. */
export type MyContest = {
  joined: boolean;
  funded: boolean;
  startBalance: number;
  balance: number | null;
  equity: number | null;
  returnPct: number | null;
  mddPct: number | null;
  bonus: boolean;
  rank: number | null;
  invited: number;
};

const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));

export async function getMyContest(s: Season): Promise<MyContest | null> {
  if (s.id === null || !isSupabaseConfigured) return null;
  try {
    const sb = await createClient();
    const { data, error } = await sb.rpc("contest_me", { p_contest: s.id });
    const r = (data as Record<string, unknown>[] | null)?.[0];
    if (error || !r) return null;
    return {
      joined: !!r.joined,
      funded: !!r.funded,
      startBalance: Number(r.start_balance),
      balance: num(r.balance),
      equity: num(r.equity),
      returnPct: num(r.return_pct),
      mddPct: num(r.mdd_pct),
      bonus: !!r.bonus,
      rank: num(r.rank),
      invited: Number(r.invited ?? 0),
    };
  } catch {
    return null;
  }
}

/** The signed-in user's invite code (created on first use). */
export async function getMyReferralCode(): Promise<string | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const sb = await createClient();
    const { data, error } = await sb.rpc("referral_my_code");
    return error || typeof data !== "string" ? null : data;
  } catch {
    return null;
  }
}
