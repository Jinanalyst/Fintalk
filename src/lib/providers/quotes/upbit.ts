import type { QuoteProvider } from "../types";

/** Upbit Open API — 원화(KRW) 마켓 현재가. 문서/약관: https://docs.upbit.com/ */
export const upbit: QuoteProvider = {
  meta: {
    id: "upbit",
    name: "Upbit",
    kind: "quote",
    termsUrl: "https://docs.upbit.com/",
    attribution: "시세 출처: Upbit",
    // 공식 제한(Quotation 초당 10회)보다 보수적으로 적용
    rateLimit: { max: 5, windowMs: 1000 },
    ttlMs: 5_000,
  },
  supports: (t) => t.market === "crypto",
  // 단건 조회는 fetchQuote, 목록 화면은 아래 fetchUpbitBatch 를 사용합니다.
  async fetchQuote(t, signal) {
    const res = await fetch(`https://api.upbit.com/v1/ticker?markets=KRW-${encodeURIComponent(t.symbol)}`, { signal, cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const rows = (await res.json()) as { trade_price: number; signed_change_rate: number; timestamp: number }[];
    const r = rows[0];
    if (!r || typeof r.trade_price !== "number") return null;
    return { symbol: t.symbol, price: r.trade_price, changePct: r.signed_change_rate * 100, currency: "KRW", asOf: r.timestamp };
  },
};

/** 여러 종목을 한 번의 호출로 조회합니다 (목록 화면용). */
export async function fetchUpbitBatch(symbols: string[], signal: AbortSignal) {
  const markets = symbols.map((s) => `KRW-${encodeURIComponent(s)}`).join(",");
  const res = await fetch(`https://api.upbit.com/v1/ticker?markets=${markets}`, { signal, cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const rows = (await res.json()) as { market: string; trade_price: number; signed_change_rate: number; timestamp: number }[];
  return rows.map((r) => ({ symbol: r.market.replace("KRW-", ""), price: r.trade_price, changePct: r.signed_change_rate * 100, currency: "KRW", asOf: r.timestamp }));
}
