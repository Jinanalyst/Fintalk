import type { Metadata } from "next";
import Link from "next/link";
import { ChevronDown, PenLine } from "lucide-react";
import { AdSlot } from "@/components/common/ad-slot";
import { PageTitle, Pills, SampleBadge } from "@/components/common/bits";
import { PostCard } from "@/components/feed/cards";
import { WatchStar } from "@/components/feed/interactive";
import { getWatchState, listPosts } from "@/lib/data/community";
import { BOARD_CATEGORIES, POST_TYPES, boardLabel, tickerName, type PostType, type SortKey } from "@/lib/sample-data";

export const metadata: Metadata = {
  title: "커뮤니티",
  description: "주식, 암호화폐, 거시경제, 투자 전략까지. 투자자들의 생각과 질문을 자유롭게 나눠보세요.",
};

const SORTS: { slug: SortKey; label: string }[] = [
  { slug: "hot", label: "🔥 인기순" },
  { slug: "new", label: "최신순" },
  { slug: "comments", label: "댓글순" },
];

// 인사이트 글도 커뮤니티 피드에 함께 올라옵니다 (SNS 타임라인처럼)
const TYPE_PILLS = [{ slug: "all", label: "전체" }, ...POST_TYPES.map((t) => ({ slug: t.slug as string, label: t.label }))];

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
        title={ticker ? `${ticker} ${tickerName(ticker) !== ticker ? tickerName(ticker) : ""} 토론` : cat === "all" ? "커뮤니티" : boardLabel(cat)}
        desc={ticker ? "이 종목에 대한 투자자들의 분석과 생각입니다." : "인기순은 추천·댓글·게시 시각을 함께 반영합니다."}
        right={
          <Link
            href={`/community/write?${ticker ? `ticker=${ticker}&` : ""}${type === "all" ? "" : `type=${type}`}`}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            <PenLine className="size-4" /> 글쓰기
          </Link>
        }
      />
      {ticker && watch && (
        <div className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
          <WatchStar symbol={ticker} live={watch.live} initial={watch.set.has(ticker)} /> 관심 종목에 추가
          <Link href="/community" className="ml-auto text-xs text-brand hover:underline">전체 보기</Link>
        </div>
      )}
      {!live && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <SampleBadge label="샘플 게시글 (Supabase 미연결)" />
        </div>
      )}
      <Pills items={BOARD_CATEGORIES} active={cat} hrefFor={(c) => `/community?${c === "all" ? "" : `cat=${c}&`}${ticker ? `ticker=${ticker}&` : ""}${typeQ}sort=${sort}`} className="mb-3 lg:hidden" />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <details className="group relative">
          <summary className="inline-flex h-9 cursor-pointer list-none items-center gap-1.5 rounded-lg border bg-card px-3 text-sm font-medium hover:bg-muted [&::-webkit-details-marker]:hidden">
            {TYPE_PILLS.find((t) => t.slug === type)?.label === "전체" ? "전체 유형" : TYPE_PILLS.find((t) => t.slug === type)?.label}
            <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
          </summary>
          <ul className="absolute left-0 z-10 mt-1 min-w-44 overflow-hidden rounded-xl border bg-card p-1 shadow-lg">
            {TYPE_PILLS.map((t) => (
              <li key={t.slug}>
                <Link
                  href={`/community?${cat === "all" ? "" : `cat=${cat}&`}${ticker ? `ticker=${ticker}&` : ""}${t.slug === "all" ? "" : `type=${t.slug}&`}sort=${sort}`}
                  className={`block rounded-lg px-3 py-2 text-sm hover:bg-muted ${t.slug === type ? "font-bold text-brand" : ""}`}
                >
                  {t.slug === "all" ? "전체 유형" : t.label}
                </Link>
              </li>
            ))}
          </ul>
        </details>
        <nav aria-label="정렬" className="flex items-center gap-1 text-sm">
          {SORTS.map((o) => (
            <Link key={o.slug} href={`/community?${catQ}sort=${o.slug}`} className={`rounded-md px-2.5 py-1.5 ${o.slug === sort ? "bg-muted font-bold text-foreground" : "text-muted-foreground hover:text-foreground"}`}>{o.label.replace("🔥 ", "")}</Link>
          ))}
        </nav>
      </div>

      {list.length === 0 ? (
        <div className="rounded-xl border bg-card p-10 text-center text-sm text-muted-foreground">
          아직 게시글이 없습니다. <Link href="/community/write" className="text-brand underline">첫 글을 작성해보세요.</Link>
        </div>
      ) : (
        <div className="space-y-2.5">
          {list.map((p, i) => (
            <div key={p.id} className="contents">
              <PostCard post={p} />
              {i === 4 && <AdSlot slot="feed-inline" />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
