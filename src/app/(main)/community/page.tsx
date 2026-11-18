import type { Metadata } from "next";
import Link from "next/link";
import { ChevronDown, PenLine } from "lucide-react";
import { PageTitle, Pills, SampleBadge } from "@/components/common/bits";
import { PostCard } from "@/components/feed/cards";
import { WatchStar } from "@/components/feed/interactive";
import { getWatchState, listPosts } from "@/lib/data/community";
import { BOARD_CATEGORIES, POST_TYPES, boardLabel, tickerName, type PostType, type SortKey } from "@/lib/sample-data";

export const metadata: Metadata = {
  title: "Community",
  description: "Stocks, crypto, macro and trading strategy. Share your thoughts and questions with other investors.",
  alternates: { canonical: "/community" },
};

const SORTS: { slug: SortKey; label: string }[] = [
  { slug: "hot", label: "🔥 Hot" },
  { slug: "new", label: "Newest" },
  { slug: "comments", label: "Most comments" },
];

// 인사이트 글도 커뮤니티 피드에 함께 올라옵니다 (SNS 타임라인처럼)
const TYPE_PILLS = [{ slug: "all", label: "All" }, ...POST_TYPES.map((t) => ({ slug: t.slug as string, label: t.label }))];

export default async function CommunityPage({ searchParams }: PageProps<"/community">) {
  const sp = await searchParams;
  const cat = typeof sp.cat === "string" && BOARD_CATEGORIES.some((c) => c.slug === sp.cat) ? sp.cat : "all";
  const sort: SortKey = sp.sort === "new" || sp.sort === "comments" ? sp.sort : "hot";
  const ticker = typeof sp.ticker === "string" && /^[0-9A-Za-z._-]{1,20}$/.test(sp.ticker) ? sp.ticker.toUpperCase() : undefined;
  const type = TYPE_PILLS.some((t) => t.slug === sp.type && t.slug !== "all") ? (sp.type as PostType) : "all";
  const { posts: list, live } = await listPosts({ cat, sort, ticker, types: type === "all" ? undefined : [type] });
  const watch = ticker ? await getWatchState().catch(() => ({ live: false, set: new Set<string>() })) : null;
  const typeQ = type === "all" ? "" : `type=${type}&`;
  const catQ = (cat === "all" ? "" : `cat=${cat}&`) + (ticker ? `ticker=${ticker}&` : "") + typeQ;

  return (
    <div>
      <PageTitle
        title={ticker ? `${ticker} ${tickerName(ticker) !== ticker ? tickerName(ticker) : ""} discussion` : cat === "all" ? "Community" : boardLabel(cat)}
        desc={ticker ? "Investor analysis and thoughts on this ticker." : "Hot ranking combines upvotes, comments and post time."}
        right={
          <Link
            href={`/community/write?${ticker ? `ticker=${ticker}&` : ""}${type === "all" ? "" : `type=${type}`}`}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            <PenLine className="size-4" /> Write
          </Link>
        }
      />
      {ticker && watch && (
        <div className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
          <WatchStar symbol={ticker} live={watch.live} initial={watch.set.has(ticker)} /> Add to watchlist
          <Link href="/community" className="ml-auto text-xs text-brand hover:underline">View all</Link>
        </div>
      )}
      {!live && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <SampleBadge label="Sample posts (Supabase not connected)" />
        </div>
      )}
      <Pills items={BOARD_CATEGORIES} active={cat} hrefFor={(c) => `/community?${c === "all" ? "" : `cat=${c}&`}${ticker ? `ticker=${ticker}&` : ""}${typeQ}sort=${sort}`} className="mb-3 lg:hidden" />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <details className="group relative">
          <summary className="inline-flex h-9 cursor-pointer list-none items-center gap-1.5 rounded-lg border bg-card px-3 text-sm font-medium hover:bg-muted [&::-webkit-details-marker]:hidden">
            {TYPE_PILLS.find((t) => t.slug === type)?.label === "All" ? "All types" : TYPE_PILLS.find((t) => t.slug === type)?.label}
            <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
          </summary>
          <ul className="absolute left-0 z-10 mt-1 min-w-44 overflow-hidden rounded-xl border bg-card p-1 shadow-lg">
            {TYPE_PILLS.map((t) => (
              <li key={t.slug}>
                <Link
                  href={`/community?${cat === "all" ? "" : `cat=${cat}&`}${ticker ? `ticker=${ticker}&` : ""}${t.slug === "all" ? "" : `type=${t.slug}&`}sort=${sort}`}
                  className={`block rounded-lg px-3 py-2 text-sm hover:bg-muted ${t.slug === type ? "font-bold text-brand" : ""}`}
                >
                  {t.slug === "all" ? "All types" : t.label}
                </Link>
              </li>
            ))}
          </ul>
        </details>
        <nav aria-label="Sort" className="flex items-center gap-1 text-sm">
          {SORTS.map((o) => (
            <Link key={o.slug} href={`/community?${catQ}sort=${o.slug}`} className={`rounded-md px-2.5 py-1.5 ${o.slug === sort ? "bg-muted font-bold text-foreground" : "text-muted-foreground hover:text-foreground"}`}>{o.label.replace("🔥 ", "")}</Link>
          ))}
        </nav>
      </div>

      {list.length === 0 ? (
        <div className="rounded-xl border bg-card p-10 text-center text-sm text-muted-foreground">
          No posts yet. <Link href="/community/write" className="text-brand underline">Write the first post.</Link>
        </div>
      ) : (
        <div className="space-y-2.5">
          {list.map((p) => (
            <div key={p.id} className="contents">
              <PostCard post={p} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
