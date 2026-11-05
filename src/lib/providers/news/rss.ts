import type { NewsProvider } from "../types";

/**
 * 공식 RSS 뉴스 공급처. 피드는 환경변수로 등록합니다.
 *   NEWS_RSS_FEEDS="id|표시이름|https://피드주소;id2|이름2|https://..."
 * 각 피드는 `rss-<id>` 로 PROVIDER_LICENSE_VERIFIED 에 별도 등록해야 운영에 노출됩니다.
 * 제목·짧은 요약·원문 링크만 사용하며 본문 전체를 복제하지 않습니다.
 */

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

export function rssProviders(): NewsProvider[] {
  return (process.env.NEWS_RSS_FEEDS ?? "")
    .split(";")
    .map((s) => s.trim().split("|").map((p) => p.trim()))
    .filter((p) => p.length === 3 && /^[a-z0-9-]+$/i.test(p[0]) && /^https?:\/\//.test(p[2]))
    .map(
      ([id, name, url]): NewsProvider => ({
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
          const res = await fetch(url, { signal, cache: "no-store", headers: { Accept: "application/rss+xml, application/atom+xml, text/xml" } });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return parseRss(await res.text(), name);
        },
      }),
    );
}
