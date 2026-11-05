import type { QuoteProvider } from "../types";

const IDS: Record<string, string> = { BTC: "bitcoin", ETH: "ethereum", XRP: "ripple", SOL: "solana", DOGE: "dogecoin" };

/** CoinGecko API — Upbit 장애 시 대체 공급처. 약관: https://www.coingecko.com/en/api_terms (상업 이용은 플랜별 확인 필요) */
export const coingecko: QuoteProvider = {
  meta: {
    id: "coingecko",
    name: "CoinGecko",
    kind: "quote",
    termsUrl: "https://www.coingecko.com/en/api_terms",
    attribution: "Powered by CoinGecko",
    rateLimit: { max: 10, windowMs: 60_000 },
    ttlMs: 60_000,
  },
  supports: (t) => t.market === "crypto" && t.symbol in IDS,
  async fetchQuote(t, signal) {
    const id = IDS[t.symbol];
    const key = process.env.COINGECKO_API_KEY;
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=krw&include_24hr_change=true&include_last_updated_at=true`,
      { signal, cache: "no-store", headers: key ? { "x-cg-demo-api-key": key } : undefined },
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const j = (await res.json()) as Record<string, { krw?: number; krw_24h_change?: number; last_updated_at?: number }>;
    const r = j[id];
    if (!r || typeof r.krw !== "number") return null;
    return { symbol: t.symbol, price: r.krw, changePct: r.krw_24h_change ?? 0, currency: "KRW", asOf: (r.last_updated_at ?? Date.now() / 1000) * 1000 };
  },
};
