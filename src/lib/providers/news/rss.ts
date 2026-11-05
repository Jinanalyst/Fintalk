import type { NewsProvider } from "../types";

/**
 * 무료 RSS 뉴스 공급처.
 * - 기본 피드는 아래 DEFAULT_FEEDS, 추가 피드는 환경변수로 등록합니다.
 *     NEWS_RSS_FEEDS="id|표시이름|https://피드주소|카테고리;id2|..."   (카테고리 생략 가능)
 * - 운영에서는 각 피드(`rss-<id>`)를 PROVIDER_LICENSE_VERIFIED 에 등록해야 노출됩니다.
 *   기본 피드는 이용약관을 아직 확인하지 않았으므로 모두 개발·테스트 전용입니다.
 *   (예: 연합뉴스 RSS 는 "무단 전재·재배포, AI 학습 및 활용 금지" 문구를 포함 — 사용 전 계약/허락 필요)
 * - 제목·짧은 요약·원문 링크만 사용하며 본문 전체를 복제하지 않습니다.
 */

type Feed = { id: string; name: string; url: string; category: string };

export const DEFAULT_FEEDS: Feed[] = [
  { id: "yna-economy", name: "연합뉴스 경제", url: "https://www.yna.co.kr/rss/economy.xml", category: "macro" },
  { id: "yna-market", name: "연합뉴스 증시", url: "https://www.yna.co.kr/rss/market.xml", category: "kr-stock" },
  { id: "hankyung-finance", name: "한국경제 증권", url: "https://www.hankyung.com/feed/finance", category: "kr-stock" },
  { id: "coindesk", name: "CoinDesk", url: "https://www.coindesk.com/arc/outboundfeeds/rss/", category: "crypto" },
  { id: "cointelegraph", name: "Cointelegraph", url: "https://cointelegraph.com/rss", category: "crypto" },
  { id: "bbc-business", name: "BBC Business", url: "https://feeds.bbci.co.uk/news/business/rss.xml", category: "macro" },
];

const decode = (s: string) =>
  s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const tag = (block: string, name: string) => block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i"))?.[1] ?? "";

function safeUrl(u: string) {
  try {
    const url = new URL(decode(u));
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : "";
  } catch {
    return "";
  }
}

export function parseRss(xml: string, source: string) {
  const blocks = xml.match(/<item[\s>][\s\S]*?<\/item>|<entry[\s>][\s\S]*?<\/entry>/gi) ?? [];
  return blocks.slice(0, 50).flatMap((b) => {
    const title = decode(tag(b, "title"));
    const link = safeUrl(tag(b, "link") || b.match(/<link[^>]*href="([^"]+)"/i)?.[1] || "");
    if (!title || !link) return [];
    const date = Date.parse(decode(tag(b, "pubDate") || tag(b, "published") || tag(b, "updated")));
    const summary = decode(tag(b, "description") || tag(b, "summary")).slice(0, 160);
    return [{ id: link, title, summary, url: link, source, publishedAt: Number.isNaN(date) ? Date.now() : date }];
  });
}

function envFeeds(): Feed[] {
  return (process.env.NEWS_RSS_FEEDS ?? "")
    .split(";")
    .map((x) => x.trim().split("|").map((p) => p.trim()))
    .filter((p) => p.length >= 3 && /^[a-z0-9-]+$/i.test(p[0]) && /^https?:\/\//.test(p[2]))
    .map(([id, name, url, category]) => ({ id, name, url, category: category || "macro" }));
}

export function rssProviders(): NewsProvider[] {
  const feeds = [...DEFAULT_FEEDS, ...envFeeds()];
  return feeds.map(
    ({ id, name, url, category }): NewsProvider => ({
      category,
      meta: {
        id: `rss-${id}`,
        name,
        kind: "news",
        termsUrl: url,
        attribution: `출처: ${name}`,
        rateLimit: { max: 6, windowMs: 60_000 },
        ttlMs: 5 * 60_000,
      },
      async fetchLatest(signal) {
        const res = await fetch(url, { signal, cache: "no-store", headers: { Accept: "application/rss+xml, application/atom+xml, text/xml", "User-Agent": "FinTalk-RSS/1.0" } });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return parseRss(await res.text(), name);
      },
    }),
  );
}
