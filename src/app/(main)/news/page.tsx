import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
import { AdSlot } from "@/components/common/ad-slot";
import { PageTitle, Pills, SampleBadge } from "@/components/common/bits";
import { ArticleCard, NewsCard } from "@/components/feed/cards";
import { getLatestNews } from "@/lib/providers";
import { NEWS, NEWS_CATEGORIES } from "@/lib/sample-data";

export const metadata: Metadata = {
  title: "금융 뉴스",
  description: "국내외 주식, 암호화폐, 거시경제, 금리, 외환·원자재 등 주요 금융 뉴스를 카테고리별로 확인하세요.",
};

export default async function NewsPage({ searchParams }: PageProps<"/news">) {
  const sp = await searchParams;
  const cat = typeof sp.cat === "string" ? sp.cat : "all";
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const articles = await getLatestNews({ cat, q, limit: 40 }).catch(() => []);
  // 라이선스 확인된 피드가 없고 운영이 아닐 때만 샘플 뉴스를 보여줍니다.
  const sampleMode = articles.length === 0 && process.env.NODE_ENV !== "production";
  const list = !sampleMode ? [] : NEWS.filter(
    (n) =>
      (cat === "all" || n.category === cat) &&
      (!q || (n.title + n.summary + n.tickers.join(" ")).toLowerCase().includes(q.toLowerCase())),
  );
  const href = (c: string) => (c === "all" ? "/news" : `/news?cat=${c}`) + (q ? `${c === "all" ? "?" : "&"}q=${encodeURIComponent(q)}` : "");

  return (
    <div>
      <PageTitle title="금융 뉴스" desc="최신순 · 출처와 원문 링크를 함께 표시합니다." right={sampleMode ? <SampleBadge label="샘플 뉴스" /> : <span className="text-xs text-muted-foreground">RSS · 원문은 각 언론사에서 확인</span>} />

      <form action="/news" className="mb-3">
        {cat !== "all" && <input type="hidden" name="cat" value={cat} />}
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            name="q"
            defaultValue={q}
            placeholder="뉴스 검색 (제목, 요약, 종목)"
            className="h-10 w-full rounded-lg border bg-card pl-9 pr-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
          />
        </div>
      </form>

      <Pills items={NEWS_CATEGORIES} active={cat} hrefFor={href} className="mb-4" />

      {articles.length === 0 && list.length === 0 ? (
        <div className="rounded-xl border bg-card p-10 text-center text-sm text-muted-foreground">
          조건에 맞는 뉴스가 없습니다. <Link href="/news" className="text-brand underline">필터 초기화</Link>
        </div>
      ) : (
        <div className="space-y-2.5">
          {articles.map((n, i) => (
            <div key={n.id} className="contents">
              <ArticleCard item={n} />
              {i === 3 && <AdSlot slot="news-inline" />}
            </div>
          ))}
          {list.map((n, i) => (
            <div key={n.id} className="contents">
              <NewsCard item={n} />
              {i === 3 && <AdSlot slot="news-inline" />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
