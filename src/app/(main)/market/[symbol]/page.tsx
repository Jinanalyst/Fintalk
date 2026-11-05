import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Info } from "lucide-react";
import { Card, Change, SampleBadge, SectionHeader } from "@/components/common/bits";
import { NewsCard, PostCard } from "@/components/feed/cards";
import { WatchStar } from "@/components/feed/interactive";
import { PriceChart } from "@/components/market/charts";
import { getWatchState } from "@/lib/data/community";
import { ASSETS, MARKET_TABS, NEWS, POSTS, formatPrice, getAsset } from "@/lib/sample-data";

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

export default async function SymbolPage({ params }: PageProps<"/market/[symbol]">) {
  const { symbol } = await params;
  const a = getAsset(symbol);
  if (!a) notFound();
  const watch = await getWatchState();
  const up = a.changePct >= 0;
  const news = NEWS.filter((n) => n.tickers.includes(a.symbol));
  const posts = POSTS.filter((p) => p.tickers.includes(a.symbol));
  const hi = Math.max(...a.series);
  const lo = Math.min(...a.series);
  const marketLabel = MARKET_TABS.find((t) => t.slug === a.market)?.label;

  return (
    <div className="space-y-4">
      <Link href={`/market?m=${a.market}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-brand">
        <ArrowLeft className="size-4" /> 마켓 · {marketLabel}
      </Link>

      <Card className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold sm:text-2xl">{a.name}</h1>
              <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">{a.symbol}</span>
            </div>
            <div className="mt-2 flex flex-wrap items-baseline gap-x-3">
              <p className="text-3xl font-extrabold tabular-nums">{formatPrice(a)}<span className="ml-1 text-sm font-medium text-muted-foreground">{a.unit}</span></p>
              <Change pct={a.changePct} icon className="text-base" />
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <WatchStar symbol={a.symbol} live={watch.live} initial={watch.set.has(a.symbol)} />
            <SampleBadge label="샘플 시세" />
          </div>
        </div>

        <div className="mt-4">
          <PriceChart values={a.series} up={up} />
        </div>

        <dl className="mt-4 grid grid-cols-3 gap-2 text-center text-sm">
          <div className="rounded-lg bg-muted/60 p-2"><dt className="text-xs text-muted-foreground">기간 고가</dt><dd className="font-semibold tabular-nums">{hi.toLocaleString("ko-KR", { maximumFractionDigits: a.decimals })}</dd></div>
          <div className="rounded-lg bg-muted/60 p-2"><dt className="text-xs text-muted-foreground">기간 저가</dt><dd className="font-semibold tabular-nums">{lo.toLocaleString("ko-KR", { maximumFractionDigits: a.decimals })}</dd></div>
          <div className="rounded-lg bg-muted/60 p-2"><dt className="text-xs text-muted-foreground">데이터</dt><dd className="font-semibold text-amber-600 dark:text-amber-300">샘플</dd></div>
        </dl>

        <p className="mt-3 flex items-start gap-1.5 text-xs text-muted-foreground">
          <Info className="mt-0.5 size-3.5 shrink-0" />
          실제 연동 시 시세는 제공처 정책에 따라 지연될 수 있으며, 투자 권유가 아닙니다.
        </p>
      </Card>

      <section>
        <SectionHeader title={`${a.name} 뉴스`} href="/news" className="mb-2" />
        {news.length ? (
          <div className="space-y-2.5">{news.map((n) => <NewsCard key={n.id} item={n} compact />)}</div>
        ) : (
          <div className="rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground">관련 뉴스가 아직 없습니다.</div>
        )}
      </section>

      <section>
        <SectionHeader title={`${a.name} 토론`} href="/community" className="mb-2" />
        {posts.length ? (
          <div className="space-y-2.5">{posts.map((p) => <PostCard key={p.id} post={p} />)}</div>
        ) : (
          <div className="rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground">
            아직 토론이 없습니다. <Link href="/community/write" className="text-brand underline">첫 글 작성하기</Link>
          </div>
        )}
      </section>
    </div>
  );
}
