import type { Contest, ContestStatus } from "./types";

export const HOUR = 3_600_000;
export const DAY = 24 * HOUR;

export function contestStatus(c: Pick<Contest, "startsAt" | "endsAt">, now = Date.now()): ContestStatus {
  if (now < Date.parse(c.startsAt)) return "upcoming";
  if (now >= Date.parse(c.endsAt)) return "ended";
  return "live";
}

/** Start of the freeze window (end − 24h). */
export const freezeStart = (c: Pick<Contest, "endsAt">) => Date.parse(c.endsAt) - DAY;

export function isFrozen(c: Pick<Contest, "startsAt" | "endsAt" | "freezeLast24h">, now = Date.now()) {
  return c.freezeLast24h && contestStatus(c, now) === "live" && now >= freezeStart(c);
}

/** Rankings refresh hourly: snapshots are always aligned to the top of the hour (UTC). */
export const floorToHour = (ms: number) => Math.floor(ms / HOUR) * HOUR;

const dt = (tz: string) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: tz, day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const tm = (tz: string) => new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const dy = (tz: string) => new Intl.DateTimeFormat("en-GB", { timeZone: tz, day: "2-digit", month: "short", year: "numeric" });

/** "18 Nov 2026, 09:00 UTC" */
export const formatUTC = (iso: string | number) => `${dt("UTC").format(new Date(iso))} UTC`;
/** "18 Nov 2026, 18:00 KST" */
export const formatKST = (iso: string | number) => `${dt("Asia/Seoul").format(new Date(iso))} KST`;

/** Compact date range, e.g. "01 Nov 2026 – 30 Nov 2026 (UTC)". */
export function formatRange(c: Pick<Contest, "startsAt" | "endsAt">) {
  const d = dy("UTC");
  return `${d.format(new Date(c.startsAt))} – ${d.format(new Date(c.endsAt))} (UTC)`;
}

/** Both zones on one line: "18 Nov 2026, 09:00 UTC / 18:00 KST" (KST date added only if it differs). */
export function formatBoth(iso: string | number) {
  const d = new Date(iso);
  const kstDay = dy("Asia/Seoul").format(d);
  const kst = kstDay === dy("UTC").format(d) ? tm("Asia/Seoul").format(d) : `${kstDay}, ${tm("Asia/Seoul").format(d)}`;
  return `${dy("UTC").format(d)}, ${tm("UTC").format(d)} UTC / ${kst} KST`;
}

export function splitDuration(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
}

export const usd = (n: number) => `$${n.toLocaleString("en-US")}`;
