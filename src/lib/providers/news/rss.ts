import Parser from "rss-parser";
import type { NewsProvider } from "../types";
import FEEDS from "./feeds.json";

/**
 * 무료 RSS 뉴스 공급처 (rss-parser).
 * - 피드 목록·라이선스 검토 결과는 feeds.json 에서 관리합니다. (연결 테스트 스크립트도 같은 파일을 사용)
 * - license: "allowed" 만 운영에 기본 노출. "unverified"/"restricted" 는 운영에서 비활성이며,
 *   약관·계약으로 허용을 확인한 경우에만 PROVIDER_LICENSE_VERIFIED 에 \`rss-<id>\` 를 등록해 켭니다.
 * - 추가 피드: NEWS_RSS_FEEDS="id|표시이름|URL|카테고리;..." (기본 license=unverified)
 * - 제목·짧은 요약·원문 링크·출처·발행 시각만 사용합니다. 기사 전문과 이미지(enclosure/media)는 가져오지 않습니다.
 */

export type Feed = {
  id: string;
  name: string;
  url: string;
  category: string;
  classify: boolean;
  license: "allowed" | "unverified" | "restricted";
  licenseNote?: string;
  /** 연결 테스트에서 이 시간보다 오래된 최신 기사는 경고 (발행이 드문 피드용) */
  staleHours?: number;
};

export const DEFAULT_FEEDS = FEEDS as Feed[];

const parser = new Parser({ timeout: 4000 });

function safeUrl(u: string | undefined) {
  try {
    const url = new URL(u ?? "");
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : "";
  } catch {
    return "";
  }
}

const clean = (s: string | undefined) => (s ?? "").replace(/\s+/g, " ").trim();

/** Google 뉴스 제목 끝의 " - 언론사" 는 실제 출처이므로 분리합니다. */
function splitPublisher(title: string, isGoogle: boolean) {
  if (!isGoogle) return { title, publisher: "" };
  const i = title.lastIndexOf(" - ");
  return i > 0 ? { title: title.slice(0, i), publisher: title.slice(i + 3) } : { title, publisher: "" };
}

export async function parseRss(xml: string, source: string, isGoogle = false) {
  const feed = await parser.parseString(xml);
  return (feed.items ?? []).slice(0, 50).flatMap((it) => {
    const link = safeUrl(it.link);
    const { title, publisher } = splitPublisher(clean(it.title), isGoogle);
    if (!title || !link) return [];
    const t = Date.parse(it.isoDate ?? it.pubDate ?? "");
    return [
      {
        id: link,
        title,
        // Google 뉴스 description 은 링크 목록이라 사용하지 않습니다.
        summary: isGoogle ? "" : clean(it.contentSnippet).slice(0, 160),
        url: link,
        source: publisher ? `${source} · ${publisher}` : source,
        publishedAt: Number.isNaN(t) ? Date.now() : t,
      },
    ];
  });
}

function envFeeds(): Feed[] {
  return (process.env.NEWS_RSS_FEEDS ?? "")
    .split(";")
    .map((x) => x.trim().split("|").map((p) => p.trim()))
    .filter((p) => p.length >= 3 && /^[a-z0-9-]+$/i.test(p[0]) && /^https?:\/\//.test(p[2]))
    .map(([id, name, url, category]) => ({ id, name, url, category: category || "macro", classify: true, license: "unverified" as const }));
}

export function rssProviders(): (NewsProvider & { feed: Feed })[] {
  return [...DEFAULT_FEEDS, ...envFeeds()].map((feed) => ({
    feed,
    category: feed.category,
    classify: feed.classify,
    meta: {
      id: `rss-${feed.id}`,
      name: feed.name,
      kind: "news",
      termsUrl: feed.url,
      attribution: `출처: ${feed.name}`,
      rateLimit: { max: 6, windowMs: 60_000 },
      ttlMs: 5 * 60_000,
      licensedByDefault: feed.license === "allowed",
    },
    async fetchLatest(signal) {
      const res = await fetch(feed.url, {
        signal,
        // 외부 요청 최소화: 서버 데이터 캐시 5분 + 공급처 가드의 메모리 캐시
        next: { revalidate: 300 },
        headers: { Accept: "application/rss+xml, application/atom+xml, text/xml", "User-Agent": "FinTalk-RSS/1.0" },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return parseRss(await res.text(), feed.name, feed.id.startsWith("google-news"));
    },
  }));
}
