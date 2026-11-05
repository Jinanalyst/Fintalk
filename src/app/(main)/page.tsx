import Link from "next/link";
import { Flame, Zap } from "lucide-react";
import { AdSlot } from "@/components/common/ad-slot";
import { Card, Pills, SampleBadge, SectionHeader, Tag } from "@/components/common/bits";
import { ArticleCard, NewsCard, PostCard } from "@/components/feed/cards";
import { TradingViewWidget } from "@/components/market/tv-widget";
import { getLatestNews, tvItems } from "@/lib/providers";
import { PopularCreators } from "@/components/layout/shell";
import { SplitBar } from "@/components/market/charts";
import { listPosts } from "@/lib/data/community";
import {
  MARKET_MOOD,
  NEWS,
  TICKER_SYMBOLS,
  TRENDING_TICKERS,
  getAsset,
  type SortKey,
} from "@/lib/sample-data";

const SORTS = [
  { slug: "hot" as SortKey, label: "🔥 인기순" },
  { slug: "new" as SortKey, label: "최신순" },
];

export default async function HomePage({ searchParams }: PageProps<"/">) {
  const sp = await searchParams;
  const sort: SortKey = sp.sort === "new" ? "new" : "hot";
  const quotes = TICKER_SYMBOLS.map((s) => getAsset(s)!);
  const articles = await getLatestNews({ limit: 5 }).catch(() => []);
  const sampleNews = articles.length === 0 && process.env.NODE_ENV !== "production";
  const breaking = sampleNews ? NEWS.filter((n) => n.breaking).concat(NEWS.filter((n) => !n.breaking)).slice(0, 5) : [];
  const { posts, live } = await listPosts({ sort, limit: 6 });

  return (
    <div className="space-y-5">
      <AdSlot slot="home-top" preview className="min-h-20" />

      {/* 히어로 */}
      <section className="rounded-xl bg-gradient-to-br from-brand to-blue-700 p-5 text-primary-foreground sm:p-6 dark:from-blue-900 dark:to-slate-900">
        <p className="text-xs font-medium opacity-80">FinTalk</p>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">시장을 읽고, 생각을 나누다.</h1>
        <p className="mt-2 max-w-xl text-sm opacity-90">
          주식·코인·채권·외환·원자재 뉴스를 한눈에 보고, 다른 투자자와 의견을 나눠보세요.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/community" className="rounded-full bg-white px-4 py-1.5 text-sm font-semibold text-blue-700">
            커뮤니티 둘러보기
          </Link>
          <Link href="/challenges" className="rounded-full border border-white/50 px-4 py-1.5 text-sm font-semibold">
            이번 주 챌린지
          </Link>
        </div>
      </section>

      {/* 주요 시세 */}
      <section>
        <SectionHeader title="주요 금융시장" href="/market" className="mb-2" />
        <div className="overflow-hidden rounded-xl border bg-card px-2 pt-1">
          <TradingViewWidget kind="ticker-tape" items={tvItems(quotes)} className="min-h-[96px]" />
        </div>
      </section>

      <div className="grid gap-5 md:grid-cols-2">
        {/* 시장 심리 */}
        <Card>
          <SectionHeader title="오늘의 시장 심리" right={<SampleBadge label="샘플" />} />
          <div className="mt-3 flex items-end gap-3">
            <p className="text-4xl font-extrabold tabular-nums text-up">{MARKET_MOOD.greed}</p>
            <p className="pb-1 text-sm font-medium">{MARKET_MOOD.label}</p>
          </div>
          <SplitBar up={MARKET_MOOD.bullish} className="mt-3" />
          <div className="mt-2 flex justify-between text-xs text-muted-foreground">
            <span className="text-up">상승 전망 {MARKET_MOOD.bullish}%</span>
            <span>중립 {MARKET_MOOD.neutral}%</span>
            <span className="text-down">하락 전망 {MARKET_MOOD.bearish}%</span>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            정식 오픈 시 챌린지 투표와 커뮤니티 활동을 바탕으로 산출됩니다.
          </p>
        </Card>

        {/* 인기 종목 */}
        <Card>
          <SectionHeader title={<span className="inline-flex items-center gap-1.5"><Flame className="size-4 text-down" />인기 종목</span>} href="/market" />
          <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2.5">
            {TRENDING_TICKERS.map((s, i) => {
              const a = getAsset(s)!;
              return (
                <li key={s}>
                  <Link href={`/market/${s}`} className="flex items-center justify-between gap-2 text-sm hover:text-brand">
                    <span className="truncate">
                      <span className="mr-1.5 font-bold text-brand">{i + 1}</span>
                      {a.name}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>

      {/* 실시간 뉴스 */}
      <section>
        <SectionHeader
          title={<span className="inline-flex items-center gap-1.5"><Zap className="size-4 text-down" />실시간 금융 뉴스</span>}
          href="/news"
          right={sampleNews ? <SampleBadge label="샘플 뉴스" /> : undefined}
          className="mb-2"
        />
        <div className="space-y-2.5">
          {articles.map((n) => <ArticleCard key={n.id} item={n} compact />)}
          {articles.length === 0 && !sampleNews && <p className="rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground">표시할 뉴스가 아직 없습니다.</p>}
          {breaking.map((n) => (
            <NewsCard key={n.id} item={n} compact />
          ))}
        </div>
      </section>

      {/* 커뮤니티 피드 */}
      <section>
        <SectionHeader title="커뮤니티 게시글" href="/community" right={live ? undefined : <SampleBadge label="샘플 게시글" />} className="mb-2" />
        <Pills items={SORTS} active={sort} hrefFor={(s) => `/?sort=${s}`} className="mb-3" />
        <div className="space-y-2.5">
          {posts.slice(0, 3).map((p) => (
            <PostCard key={p.id} post={p} />
          ))}
          <AdSlot slot="feed-inline" />
          {posts.slice(3).map((p) => (
            <PostCard key={p.id} post={p} />
          ))}
        </div>
        {posts.length === 0 && (
          <p className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">아직 게시글이 없습니다. 첫 글을 작성해보세요.</p>
        )}
        <div className="mt-3 text-center">
          <Link href="/community" className="text-sm font-medium text-brand hover:underline">
            게시글 더 보기 ›
          </Link>
        </div>
      </section>

      <div className="xl:hidden">
        <PopularCreators limit={4} />
      </div>
      <div className="xl:hidden">
        <p className="mb-2 text-xs text-muted-foreground">관련 태그</p>
        <div className="flex flex-wrap gap-1.5">
          {TRENDING_TICKERS.map((t) => (
            <Tag key={t} href={`/market/${t}`}>
              ${t}
            </Tag>
          ))}
        </div>
      </div>
    </div>
  );
}
