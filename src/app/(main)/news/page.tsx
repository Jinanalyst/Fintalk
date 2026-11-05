import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
import { AdSlot } from "@/components/common/ad-slot";
import { PageTitle, Pills, SampleBadge, SectionHeader, Tag } from "@/components/common/bits";
import { ArticleCard, NewsCard, PostCard } from "@/components/feed/cards";
import { listPosts } from "@/lib/data/community";
import { getLatestNews } from "@/lib/providers";
import { NEWS, NEWS_CATEGORIES, getAsset } from "@/lib/sample-data";

const PAGE_SIZE = 20;

export const metadata: Metadata = {
  title: "금융 뉴스",
  description: "국내 주식, 미국 주식, 암호화폐, 거시경제 뉴스를 카테고리별로 검색하고 원문 링크와 관련 토론을 확인하세요.",
};

export default async function NewsPage({ searchParams }: PageProps<"/news">) {
  const sp = await searchParams;
  const cat = typeof sp.cat === "string" ? sp.cat : "all";
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const page = Math.min(10, Math.max(1, Number(sp.page) || 1));
  const fetched = await getLatestNews({ cat, q, limit: PAGE_SIZE * page + 1 }).catch(() => []);
  const hasMore = fetched.length > PAGE_SIZE * page;
  const articles = fetched.slice(0, PAGE_SIZE * page);
  // 현재 목록에서 가장 많이 언급된 종목 → 관련 종목/토론 연결
  const counts = new Map<string, number>();
  for (const a of articles) for (const t of a.tickers) counts.set(t, (counts.get(t) ?? 0) + 1);
  const hot = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  const topAsset = hot[0] ? getAsset(hot[0][0]) : undefined;
  const related = topAsset ? (await listPosts({ ticker: topAsset.symbol, sort: "new", limit: 3 }).catch(() => ({ posts: [] }))).posts : [];
  // 라이선스 확인된 피드가 없고 운영이 아닐 때만 샘플 뉴스를 보여줍니다.
  const sampleMode = articles.length === 0 && process.env.NODE_ENV !== "production";
  const list = !sampleMode ? [] : NEWS.filter(
    (n) =>
      (cat === "all" || n.category === cat) &&
      (!q || (n.title + n.summary + n.tickers.join(" ")).toLowerCase().includes(q.toLowerCase())),
  );
  const href = (c: string) => (c === "all" ? "/news" : `/news?cat=${c}`) + (q ? `${c === "all" ? "?" : "&"}q=${encodeURIComponent(q)}` : "");
  const moreHref = `/news?${new URLSearchParams({ ...(cat !== "all" && { cat }), ...(q && { q }), page: String(page + 1) })}`;

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

      <Pills items={NEWS_CATEGORIES} active={cat} hrefFor={href} className="mb-3" />

      {hot.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <span>뉴스 속 종목</span>
          {hot.map(([t, n]) => <Tag key={t} href={`/market/${t}`}>${t} · {n}</Tag>)}
        </div>
      )}

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

      {hasMore && (
        <Link href={moreHref} className="mt-4 block rounded-xl border bg-card py-3 text-center text-sm font-medium hover:border-brand/40">뉴스 더 보기</Link>
      )}

      {topAsset && (
        <section className="mt-8">
          <SectionHeader
            title={`${topAsset.name} 관련 토론`}
            right={<Link href={`/community/write?ticker=${topAsset.symbol}`} className="text-xs font-medium text-brand">이 종목으로 글쓰기</Link>}
            className="mb-2"
          />
          {related.length > 0 ? (
            <div className="space-y-2.5">{related.map((p) => <PostCard key={p.id} post={p} />)}</div>
          ) : (
            <div className="rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground">아직 토론이 없습니다. 첫 의견을 남겨보세요.</div>
          )}
        </section>
      )}
    </div>
  );
}
