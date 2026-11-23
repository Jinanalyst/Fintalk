/**
 * Season settings in one place.
 *
 * When the database has a featured round in `contests` (see migration 20261130_season_accounts.sql),
 * its dates / balance / leverage cap win. These values are the defaults and the fallback used when
 * Supabase is not connected.
 * All times are UTC.
 */
export const SEASON = {
  name: "FinTalk Season 1",
  label: "Season 1",
  /** Sign-ups close at the end of Nov 30 (UTC). */
  registrationEndsAt: "2026-12-01T00:00:00Z",
  startsAt: "2026-12-01T00:00:00Z",
  endsAt: "2027-01-01T00:00:00Z",
  /** When the prize is paid. */
  payoutDate: "2027-01-11T00:00:00Z",
  prizes: [100, 0, 0] as [number, number, number],
  startingBalance: 10_000,
  /** Hard leverage cap for contest accounts (also enforced in the database per round). */
  maxLeverage: Number(process.env.NEXT_PUBLIC_CONTEST_MAX_LEVERAGE) || 20,
  /** Both inviter and invitee get this much extra starting balance, once. */
  referralBonusPct: 10,
  /** The participant count is hidden on the landing page until more than this many have joined. */
  showParticipantsAbove: 10,
  /** Community board used for "Contest talk" on the landing page. */
  talkBoard: "trading",
} as const;

/** Practice accounts are not tied to a round. */
export const PRACTICE_MAX_LEVERAGE = 150;

export type SeasonPhase = "registration" | "live" | "ended";

export function seasonPhase(s: { startsAt: string; endsAt: string }, now = Date.now()): SeasonPhase {
  if (now < Date.parse(s.startsAt)) return "registration";
  if (now < Date.parse(s.endsAt)) return "live";
  return "ended";
}

const md = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric" });
/** "Dec 1" */
export const shortDate = (iso: string | number) => md.format(new Date(iso));

/** The last day of registration ("Nov 30"), i.e. one second before the registration end. */
export const registrationLastDay = (iso: string) => shortDate(Date.parse(iso) - 1000);

/** "Dec 1 – Jan 1" (end shown as the last moment, so a round ending Jan 1 00:00 reads "Jan 1"). */
export const dateRange = (s: { startsAt: string; endsAt: string }) => `${shortDate(s.startsAt)} – ${shortDate(s.endsAt)}`;

export const money = (n: number) => `$${n.toLocaleString("en-US")}`;

/** Whole days left until `iso` (rounded up). */
export const daysUntil = (iso: string, now = Date.now()) => Math.max(0, Math.ceil((Date.parse(iso) - now) / 86_400_000));
