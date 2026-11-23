import ip3country from "ip3country";

/**
 * Visitor country (ISO 3166-1 alpha-2) on the server, or null when unknown.
 *
 *  1. Hosting geo headers: Vercel `x-vercel-ip-country`, Cloudflare `cf-ipcountry`.
 *  2. Otherwise (fintalk.space runs on Hostinger, which sends neither): look up the client IP from
 *     the proxy headers in a bundled IP→country table (ip3country, IP2Location LITE data, IPv4 only).
 * Callers must treat null as "not allowed" (fail closed).
 */
type HeaderGetter = { get(name: string): string | null };

const HEADER_KEYS = ["x-vercel-ip-country", "cf-ipcountry"];
/** Codes some CDNs use for "unknown" or Tor. */
const UNKNOWN = new Set(["XX", "T1", "ZZ"]);
const IPV4 = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;

let ready = false;
function lookupIp(ip: string): string | null {
  if (!IPV4.test(ip)) return null; // ip3country is IPv4-only; anything else → unknown
  if (!ready) {
    ip3country.init();
    ready = true;
  }
  const c = ip3country.lookupStr(ip);
  return c && /^[A-Z]{2}$/.test(c) ? c : null;
}

/** First client address from the usual proxy headers (strips an IPv4 ":port" and the IPv6-mapped prefix). */
export function clientIp(h: HeaderGetter): string | null {
  const raw = h.get("cf-connecting-ip") ?? h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",")[0] ?? null;
  if (!raw) return null;
  let ip = raw.trim().replace(/^::ffff:/i, "");
  if (/^\d+\.\d+\.\d+\.\d+:\d+$/.test(ip)) ip = ip.slice(0, ip.lastIndexOf(":"));
  return ip || null;
}

export function visitorCountry(h: HeaderGetter): string | null {
  for (const k of HEADER_KEYS) {
    const v = h.get(k)?.trim().toUpperCase();
    if (v && /^[A-Z]{2}$/.test(v) && !UNKNOWN.has(v)) return v;
  }
  const ip = clientIp(h);
  return ip ? lookupIp(ip) : null;
}
