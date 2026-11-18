/**
 * Contest configuration.
 * Country restrictions live in ONE place here (and are mirrored in the contest_submit_entry SQL function).
 * LEGAL REVIEW REQUIRED: confirm the final restricted-country list against OKX's current terms before launch.
 */

/** ISO 3166-1 alpha-2 codes that cannot take part (IP check + residence selection). */
export const BLOCKED_COUNTRIES: readonly string[] = ["KR", "US"];

export const isBlockedCountry = (code?: string | null) => !!code && BLOCKED_COUNTRIES.includes(code.toUpperCase());

/** Your OKX affiliate / referral link. Set NEXT_PUBLIC_OKX_REFERRAL_URL in .env.local. */
export const OKX_REFERRAL_URL = process.env.NEXT_PUBLIC_OKX_REFERRAL_URL || "https://okx.com/join/FINTALK";

export const CONTEST = {
  name: "FinTalk Paper Trading Championship",
  startingBalance: 10_000,
  maxLeverage: 150,
} as const;

export const COUNTRIES: readonly { code: string; name: string }[] = [
  ["AR", "Argentina"], ["AU", "Australia"], ["AT", "Austria"], ["BD", "Bangladesh"], ["BE", "Belgium"],
  ["BR", "Brazil"], ["BG", "Bulgaria"], ["CA", "Canada"], ["CL", "Chile"], ["CN", "China"],
  ["CO", "Colombia"], ["HR", "Croatia"], ["CZ", "Czechia"], ["DK", "Denmark"], ["EG", "Egypt"],
  ["EE", "Estonia"], ["FI", "Finland"], ["FR", "France"], ["DE", "Germany"], ["GH", "Ghana"],
  ["GR", "Greece"], ["HK", "Hong Kong"], ["HU", "Hungary"], ["IN", "India"], ["ID", "Indonesia"],
  ["IE", "Ireland"], ["IL", "Israel"], ["IT", "Italy"], ["JP", "Japan"], ["KE", "Kenya"],
  ["KR", "South Korea"], ["LV", "Latvia"], ["LT", "Lithuania"], ["MY", "Malaysia"], ["MX", "Mexico"],
  ["MA", "Morocco"], ["NL", "Netherlands"], ["NZ", "New Zealand"], ["NG", "Nigeria"], ["NO", "Norway"],
  ["PK", "Pakistan"], ["PE", "Peru"], ["PH", "Philippines"], ["PL", "Poland"], ["PT", "Portugal"],
  ["RO", "Romania"], ["SA", "Saudi Arabia"], ["SG", "Singapore"], ["SK", "Slovakia"], ["SI", "Slovenia"],
  ["ZA", "South Africa"], ["ES", "Spain"], ["LK", "Sri Lanka"], ["SE", "Sweden"], ["CH", "Switzerland"],
  ["TW", "Taiwan"], ["TH", "Thailand"], ["TR", "Turkey"], ["UA", "Ukraine"], ["AE", "United Arab Emirates"],
  ["GB", "United Kingdom"], ["US", "United States"], ["VN", "Vietnam"], ["ZZ", "Other"],
].map(([code, name]) => ({ code, name }));

export const UID_RE = /^[0-9]{6,20}$/;

/** Visitor country from the hosting platform's geo headers (Vercel / Cloudflare). */
export function countryFromHeaders(h: { get(name: string): string | null }): string | null {
  const c = h.get("x-vercel-ip-country") ?? h.get("cf-ipcountry");
  return c && /^[A-Za-z]{2}$/.test(c) ? c.toUpperCase() : null;
}
