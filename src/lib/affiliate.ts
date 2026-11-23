/**
 * OKX partner banner — optional promotion only.
 * It is NOT connected to contest entry, the referral bonus or prizes, and must never be.
 *
 * Link: NEXT_PUBLIC_OKX_AFFILIATE_URL, falling back to the existing NEXT_PUBLIC_OKX_REFERRAL_URL.
 * Clicks go through /go/okx?p=<placement>, which logs the click and redirects with UTM tags.
 */
import { OKX_REFERRAL_URL } from "./contest";

export type Placement = "trade" | "leaderboard" | "season_end";
export const PLACEMENTS: readonly Placement[] = ["trade", "leaderboard", "season_end"];
export const isPlacement = (v: unknown): v is Placement => typeof v === "string" && (PLACEMENTS as readonly string[]).includes(v);

const envOff = (name: string | undefined) => /^(0|false|off|no)$/i.test(name?.trim() ?? "");

export const AFFILIATE = {
  /** Master switch. NEXT_PUBLIC_AFFILIATE_BANNER=off hides every banner. */
  enabled: !envOff(process.env.NEXT_PUBLIC_AFFILIATE_BANNER),
  /** Per-placement switches. */
  placements: {
    trade: true,
    leaderboard: true,
    season_end: true,
  } satisfies Record<Placement, boolean>,
  url: process.env.NEXT_PUBLIC_OKX_AFFILIATE_URL?.trim() || OKX_REFERRAL_URL,
  utm: { source: "fintalk", medium: "banner", campaign: "season1" },
};

/** Always hidden here. */
const ALWAYS_BLOCKED = ["KR", "US"];

/**
 * Extra countries where the banner must not be shown.
 * TODO(owner): fill from OKX's list of restricted jurisdictions (ISO 3166-1 alpha-2 codes, e.g. "CA").
 */
export const AFFILIATE_EXTRA_BLOCKED_COUNTRIES: string[] = [];

export const AFFILIATE_BLOCKED_COUNTRIES = [...ALWAYS_BLOCKED, ...AFFILIATE_EXTRA_BLOCKED_COUNTRIES].map((c) => c.toUpperCase());

/** Fail closed: unknown country → not allowed. */
export const bannerAllowedIn = (country: string | null) => !!country && !AFFILIATE_BLOCKED_COUNTRIES.includes(country.toUpperCase());

export const placementOn = (p: Placement) => AFFILIATE.enabled && AFFILIATE.placements[p] && !!AFFILIATE.url;

/** Partner URL with UTM tags for one placement. */
export function affiliateUrl(p: Placement): string | null {
  if (!AFFILIATE.url) return null;
  try {
    const u = new URL(AFFILIATE.url);
    u.searchParams.set("utm_source", AFFILIATE.utm.source);
    u.searchParams.set("utm_medium", AFFILIATE.utm.medium);
    u.searchParams.set("utm_campaign", AFFILIATE.utm.campaign);
    u.searchParams.set("utm_content", p);
    return u.toString();
  } catch {
    return null;
  }
}
