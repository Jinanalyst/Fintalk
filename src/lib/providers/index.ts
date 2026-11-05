import { callProvider } from "./guard";
import { coingecko } from "./quotes/coingecko";
import { upbit } from "./quotes/upbit";
import { rssProviders } from "./news/rss";
import type { NewsArticle, Quote, QuoteProvider, QuoteTarget } from "./types";

export type { NewsArticle, Quote } from "./types";
export { isLicensed } from "./guard";
export { tradingview, tvSymbol } from "./tradingview";

/**
 * 공급처 레지스트리: 시장별 우선순위 목록입니다. 공급처를 바꾸려면 여기만 수정하면 됩니다.
 * 목록에 없는 시장(국내/미국 주식 등)은 TradingView 위젯이 직접 시세를 보여줍니다.
 */
const QUOTE_CHAIN: Record<string, QuoteProvider[]> = {
  crypto: [upbit, coingecko],
};

/** 첫 번째로 성공한 공급처의 시세. 모두 실패/미허가면 null (페이지는 계속 렌더링됩니다). */
export async function getQuote(t: QuoteTarget): Promise<Quote | null> {
  for (const p of QUOTE_CHAIN[t.market] ?? []) {
    if (!p.supports(t)) continue;
    const r = await callProvider(p.meta, t.symbol, (signal) => p.fetchQuote(t, signal));
    if (r.ok) return { ...r.data, provider: p.meta.id, attribution: p.meta.attribution };
  }
  return null;
}

/** 등록된 모든 RSS 피드에서 키워드와 관련된 기사를 최신순으로 모읍니다. */
export async function getNewsFor(keywords: string[], limit = 6): Promise<NewsArticle[]> {
  const needles = keywords.map((k) => k.toLowerCase()).filter((k) => k.length >= 2);
  const lists = await Promise.all(
    rssProviders().map(async (p) => {
      const r = await callProvider(p.meta, "latest", (signal) => p.fetchLatest(signal));
      return r.ok ? r.data.map((a): NewsArticle => ({ ...a, provider: p.meta.id, attribution: p.meta.attribution })) : [];
    }),
  );
  return lists
    .flat()
    .filter((a) => needles.some((n) => (a.title + " " + a.summary).toLowerCase().includes(n)))
    .sort((a, b) => b.publishedAt - a.publishedAt)
    .slice(0, limit);
}
