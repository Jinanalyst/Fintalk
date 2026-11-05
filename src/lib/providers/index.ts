import { callProvider } from "./guard";
import { coingecko } from "./quotes/coingecko";
import { fetchUpbitBatch, upbit } from "./quotes/upbit";
import { ASSETS } from "@/lib/sample-data";
import { rssProviders } from "./news/rss";
import type { NewsArticle, Quote, QuoteProvider, QuoteTarget } from "./types";

export type { NewsArticle, Quote } from "./types";
export { isLicensed } from "./guard";
export { tradingview, tvItems, tvSymbol } from "./tradingview";

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

const ALIASES: Record<string, string[]> = {
  BTC: ["bitcoin", "btc"], ETH: ["ethereum", "ether"], XRP: ["ripple", "xrp"], SOL: ["solana"], DOGE: ["dogecoin"],
  NVDA: ["nvidia"], AAPL: ["apple"], TSLA: ["tesla"], MSFT: ["microsoft"], "005930": ["삼성전자"], "000660": ["하이닉스"],
  GOLD: ["gold"], WTI: ["crude", "원유"], USDKRW: ["환율", "원·달러", "원/달러"], KOSPI: ["코스피"], KOSDAQ: ["코스닥"], SPX: ["s&p"], NDX: ["나스닥", "nasdaq"],
};

/** 종목 연관 뉴스 검색용 키워드 */
export const newsKeywords = (a: { symbol: string; name: string }) => [a.name, ...(ALIASES[a.symbol] ?? []), ...(/^[A-Z]{3,}$/.test(a.symbol) ? [a.symbol] : [])];

const CATEGORY_RULES: [string, RegExp][] = [
  ["rates", /금리|채권|국채|국고채|기준금리|yield|treasury|rate (cut|hike)/i],
  ["fx-commodity", /환율|달러|엔화|유가|원유|금값|원자재|oil|gold|commodit|forex/i],
  ["crypto", /비트코인|이더리움|암호화폐|가상자산|bitcoin|ethereum|crypto|solana|ripple/i],
];

function classify(text: string, fallback: string) {
  return CATEGORY_RULES.find(([, re]) => re.test(text))?.[0] ?? fallback;
}

function tickersIn(text: string): string[] {
  const t = text.toLowerCase();
  return ASSETS.filter((a) => newsKeywords(a).some((k) => k.length >= 2 && t.includes(k.toLowerCase()))).map((a) => a.symbol).slice(0, 4);
}

export type NewsQuery = { cat?: string; q?: string; keywords?: string[]; limit?: number };

/** 허가된 RSS 피드 전체에서 최신 기사를 모읍니다. 피드 하나가 실패해도 나머지로 계속 동작합니다. */
export async function getLatestNews({ cat = "all", q = "", keywords, limit = 30 }: NewsQuery = {}): Promise<NewsArticle[]> {
  const lists = await Promise.all(
    rssProviders().map(async (p) => {
      const r = await callProvider(p.meta, "latest", (signal) => p.fetchLatest(signal));
      if (!r.ok) return [];
      return r.data.map((a): NewsArticle => {
        const text = a.title + " " + a.summary;
        return { ...a, category: classify(text, p.category), tickers: tickersIn(text), provider: p.meta.id, attribution: p.meta.attribution };
      });
    }),
  );
  const needles = (keywords ?? []).map((k) => k.toLowerCase()).filter((k) => k.length >= 2);
  const query = q.trim().toLowerCase();
  const seen = new Set<string>();
  return lists
    .flat()
    .filter((a) => {
      if (seen.has(a.url)) return false;
      seen.add(a.url);
      const text = (a.title + " " + a.summary).toLowerCase();
      return (cat === "all" || a.category === cat) && (!query || text.includes(query)) && (needles.length === 0 || needles.some((n) => text.includes(n)));
    })
    .sort((a, b) => b.publishedAt - a.publishedAt)
    .slice(0, limit);
}

export const getNewsFor = (keywords: string[], limit = 6) => getLatestNews({ keywords, limit });

/** 암호화폐 목록 시세(Upbit 단일 호출). 실패/미허가면 null. */
export async function getCryptoQuotes(symbols: string[]): Promise<Record<string, Quote> | null> {
  const key = [...symbols].sort().join(",");
  const r = await callProvider(upbit.meta, `batch:${key}`, (signal) => fetchUpbitBatch(symbols, signal));
  if (!r.ok) return null;
  return Object.fromEntries(r.data.map((q) => [q.symbol, { ...q, provider: upbit.meta.id, attribution: upbit.meta.attribution }]));
}
