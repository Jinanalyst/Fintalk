import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Info, MessageSquare } from "lucide-react";
import { Card, Change, SampleBadge, SectionHeader } from "@/components/common/bits";
import { ArticleCard, NewsCard, PostCard } from "@/components/feed/cards";
import { WatchStar } from "@/components/feed/interactive";
import { SymbolComposer } from "@/components/feed/symbol-composer";
import { PriceChart } from "@/components/market/charts";
import { TradingViewWidget } from "@/components/market/tv-widget";
import { getWatchState, listCommentPreviews, listPosts } from "@/lib/data/community";
import { getNewsFor, getQuote, newsKeywords, tvSymbol } from "@/lib/providers";
import { ASSETS, MARKET_TABS, NEWS, formatPrice, getAsset } from "@/lib/sample-data";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export function generateStaticParams() {
  return ASSETS.map((a) => ({ symbol: a.symbol }));
}

export async function generateMetadata({ params }: PageProps<"/market/[symbol]">): Promise<Metadata> {
  const { symbol } = await params;
  const a = getAsset(symbol);
  if (!a) return {};
  return {
    title: `${a.name}(${a.symbol}) 시세·뉴스·토론`,
    description: `${a.name} 가격 차트와 관련 뉴스, 투자자 커뮤니티 토론을 확인하세요.`,
  };
}

const BOARD_BY_MARKET: Record<string, string> = { kr: "kr-stock", us: "us-stock", crypto: "crypto" };
const isProd = process.env.NODE_ENV === "production";

export default async function SymbolPage({ params }: PageProps<"/market/[symbol]">) {
  const { symbol } = await params;
  const a = getAsset(symbol);
  if (!a) notFound();

  // 각 블록은 독립적으로 실패해도 페이지 전체는 렌더링됩니다.
  const [watch, quote, articles, { posts }] = await Promise.all([
    getWatchState().catch(() => ({ live: false, set: new Set<string>() })),
    getQuote(a).catch(() => null),
    getNewsFor(newsKeywords(a)).catch(() => []),
    listPosts({ ticker: a.symbol, sort: "new", limit: 20 }).catch(() => ({ posts: [], live: false })),
  ]);
  const previews: Awaited<ReturnType<typeof listCommentPreviews>> = await listCommentPreviews(posts.filter((p) => p.live).map((p) => p.id)).catch(() => ({}));

  const tv = tvSymbol(a);
  const marketLabel = MARKET_TABS.find((t) => t.slug === a.market)?.label;
  const hi = Math.max(...a.series);
  const lo = Math.min(...a.series);
  // 운영에서는 라이선스가 확인된 공급처 시세 또는 TradingView 위젯만 노출합니다. 샘플 시세는 개발 환경에서만 보입니다.
  const krx = !!tv?.startsWith("KRX:"); // TradingView 무료 위젯은 KRX 시세를 제공하지 않음
  const showSample = !quote && !(isProd && tv && !krx);
  const sampleNews = !isProd && articles.length === 0 ? NEWS.filter((n) => n.tickers.includes(a.symbol)) : [];

  return (
    <div className="space-y-4">
      <Link href={`/market?m=${a.market}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-brand">
        <ArrowLeft className="size-4" /> 마켓 · {marketLabel}
      </Link>

      {/* 상단: 종목 정보 */}
      <Card className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold sm:text-2xl">{a.name}</h1>
              <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">{a.symbol}</span>
              <span className="rounded bg-brand-soft px-1.5 py-0.5 text-xs font-medium text-brand">{marketLabel}</span>
            </div>
            {quote ? (
              <div className="mt-2">
                <div className="flex flex-wrap items-baseline gap-x-3">
                  <p className="text-3xl font-extrabold tabular-nums">
                    {quote.price.toLocaleString("ko-KR", { maximumFractionDigits: a.decimals })}
                    <span className="ml-1 text-sm font-medium text-muted-foreground">{quote.currency}</span>
                  </p>
                  <Change pct={quote.changePct} icon className="text-base" />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{quote.attribution}</p>
              </div>
            ) : showSample ? (
              <div className="mt-2 flex flex-wrap items-baseline gap-x-3">
                <p className="text-3xl font-extrabold tabular-nums">{formatPrice(a)}<span className="ml-1 text-sm font-medium text-muted-foreground">{a.unit}</span></p>
                <Change pct={a.changePct} icon className="text-base" />
              </div>
            ) : krx ? (
              <p className="mt-2 text-sm text-muted-foreground">국내 종목의 실시간 시세는 데이터 라이선스 확보 후 제공됩니다.</p>
            ) : tv ? (
              <TradingViewWidget kind="symbol-info" symbol={tv} className="mt-2 h-[190px] w-full" />
            ) : null}
          </div>
          <div className="flex flex-col items-end gap-2">
            <WatchStar symbol={a.symbol} live={watch.live} initial={watch.set.has(a.symbol)} />
            {showSample && <SampleBadge label="샘플 시세" />}
          </div>
        </div>
      </Card>

      {/* 중앙: 차트 */}
      <Card className="p-3 sm:p-4">
        {tv && !krx ? (
          <TradingViewWidget kind="advanced-chart" symbol={tv} className="h-[420px] w-full" />
        ) : krx && isProd ? (
          <p className="p-6 text-center text-sm text-muted-foreground">국내 종목 차트는 데이터 라이선스 확보 후 제공됩니다.</p>
        ) : (
          <>
            <PriceChart values={a.series} up={a.changePct >= 0} />
            <dl className="mt-4 grid grid-cols-3 gap-2 text-center text-sm">
              <div className="rounded-lg bg-muted/60 p-2"><dt className="text-xs text-muted-foreground">기간 고가</dt><dd className="font-semibold tabular-nums">{hi.toLocaleString("ko-KR", { maximumFractionDigits: a.decimals })}</dd></div>
              <div className="rounded-lg bg-muted/60 p-2"><dt className="text-xs text-muted-foreground">기간 저가</dt><dd className="font-semibold tabular-nums">{lo.toLocaleString("ko-KR", { maximumFractionDigits: a.decimals })}</dd></div>
              <div className="rounded-lg bg-muted/60 p-2"><dt className="text-xs text-muted-foreground">데이터</dt><dd className="font-semibold text-amber-600 dark:text-amber-300">샘플</dd></div>
            </dl>
          </>
        )}
        <p className="mt-3 flex items-start gap-1.5 text-xs text-muted-foreground">
          <Info className="mt-0.5 size-3.5 shrink-0" />
          시세는 제공처 정책에 따라 지연될 수 있으며, 투자 권유가 아닙니다.
        </p>
      </Card>

      {/* 중앙: 관련 뉴스 */}
      <section>
        <SectionHeader title={`${a.name} 뉴스`} href="/news" className="mb-2" />
        {articles.length > 0 ? (
          <div className="space-y-2.5">
            {articles.map((n) => <ArticleCard key={n.id} item={n} compact />)}
          </div>
        ) : sampleNews.length > 0 ? (
          <div className="space-y-2.5">{sampleNews.map((n) => <NewsCard key={n.id} item={n} compact />)}</div>
        ) : (
          <div className="rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground">관련 뉴스가 아직 없습니다.</div>
        )}
      </section>

      {/* 하단: 커뮤니티 */}
      <section className="space-y-2.5">
        <SectionHeader title={`${a.name} 토론`} href={`/community`} className="mb-0" />
        <SymbolComposer symbol={a.symbol} name={a.name} category={BOARD_BY_MARKET[a.market] ?? "macro"} live={isSupabaseConfigured} />
        {posts.length > 0 ? (
          posts.map((p) => (
            <div key={p.id}>
              <PostCard post={p} />
              {(previews[p.id] ?? []).length > 0 && (
                <ul className="ml-3 mt-1 space-y-1 border-l-2 pl-3 sm:ml-6">
                  {previews[p.id].map((c) => (
                    <li key={c.id} className="flex items-start gap-1.5 text-sm">
                      <MessageSquare className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                      <span className="min-w-0"><b className="font-medium">{c.author}</b> <span className="text-muted-foreground">{c.createdAt}</span><span className="line-clamp-2 block text-muted-foreground">{c.body}</span></span>
                    </li>
                  ))}
                  {p.comments > previews[p.id].length && (
                    <li><Link href={`/community/${p.id}`} className="text-xs text-brand hover:underline">댓글 {p.comments}개 모두 보기</Link></li>
                  )}
                </ul>
              )}
            </div>
          ))
        ) : (
          <div className="rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground">아직 {a.name} 관련 글이 없습니다. 첫 분석 글을 남겨보세요.</div>
        )}
      </section>
    </div>
  );
}
