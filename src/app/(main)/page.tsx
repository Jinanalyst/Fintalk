import Link from "next/link";
import { Gift, HelpCircle, Lightbulb, MessagesSquare, PenLine } from "lucide-react";
import { AdSlot } from "@/components/common/ad-slot";
import { Card, Pills, SampleBadge, SectionHeader, Tag } from "@/components/common/bits";
import { PostCard } from "@/components/feed/cards";
import { PopularCreators } from "@/components/layout/shell";
import { listPosts } from "@/lib/data/community";
import { COMMUNITY_TYPES, INSIGHT_TYPES, MARKET_LABELS, TRENDING_TICKERS, tickerName, type SortKey } from "@/lib/sample-data";

const SORTS = [
  { slug: "hot" as SortKey, label: "🔥 인기순" },
  { slug: "new" as SortKey, label: "최신순" },
];

const MARKETS = [
  { cat: "kr-stock", label: MARKET_LABELS.kr, desc: "코스피·코스닥 종목 분석" },
  { cat: "us-stock", label: MARKET_LABELS.us, desc: "미국 대형주·ETF 분석" },
  { cat: "crypto", label: MARKET_LABELS.crypto, desc: "비트코인·알트코인 분석" },
];

export default async function HomePage({ searchParams }: PageProps<"/">) {
  const sp = await searchParams;
  const sort: SortKey = sp.sort === "new" ? "new" : "hot";
  const [{ posts, live }, { posts: insights }, { posts: discussions }, { posts: questions }] = await Promise.all([
    listPosts({ sort, limit: 6, types: COMMUNITY_TYPES }),
    listPosts({ sort: "hot", limit: 3, types: INSIGHT_TYPES }),
    listPosts({ sort: "hot", limit: 3, types: ["discussion"] }),
    listPosts({ sort: "new", limit: 3, types: ["question"] }),
  ]);

  return (
    <div className="space-y-6">
      <AdSlot slot="home-top" preview className="min-h-20" />

      {/* 히어로 */}
      <section className="rounded-xl bg-gradient-to-br from-brand to-blue-700 p-5 text-primary-foreground sm:p-7 dark:from-blue-900 dark:to-slate-900">
        <p className="text-xs font-medium opacity-80">FinTalk</p>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">투자의 생각을 나누고, 함께 성장하다.</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed opacity-90">
          핀톡은 국내 주식, 미국 주식, 암호화폐 투자자들이 자신의 분석과 생각을 공유하고, 양질의 콘텐츠로 가치를 창출하는 금융 커뮤니티 플랫폼입니다.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/community/write" className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-1.5 text-sm font-semibold text-blue-700">
            <PenLine className="size-4" /> 글쓰기
          </Link>
          <Link href="/community" className="rounded-full border border-white/50 px-4 py-1.5 text-sm font-semibold">
            커뮤니티 둘러보기
          </Link>
        </div>
      </section>

      {/* 시장별 바로가기 */}
      <section className="grid grid-cols-3 gap-2.5">
        {MARKETS.map((m) => (
          <Link key={m.cat} href={`/community?cat=${m.cat}`} className="rounded-xl border bg-card p-3 shadow-xs transition-colors hover:border-brand/40 sm:p-4">
            <p className="text-sm font-bold sm:text-base">{m.label}</p>
            <p className="mt-0.5 hidden text-xs text-muted-foreground sm:block">{m.desc}</p>
          </Link>
        ))}
      </section>

      {/* 인사이트 */}
      <section>
        <SectionHeader title={<span className="inline-flex items-center gap-1.5"><Lightbulb className="size-4 text-amber-500" />추천 인사이트</span>} href="/insights" right={live ? undefined : <SampleBadge label="샘플 게시글" />} className="mb-2" />
        <div className="space-y-2.5">
          {insights.map((p) => <PostCard key={p.id} post={p} />)}
          {insights.length === 0 && <p className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">아직 분석 글이 없습니다. 첫 분석을 공유해 보세요.</p>}
        </div>
      </section>

      <div className="grid gap-5 md:grid-cols-2">
        {/* 인기 토론 */}
        <Card>
          <SectionHeader title={<span className="inline-flex items-center gap-1.5"><MessagesSquare className="size-4 text-brand" />인기 토론</span>} href="/community?type=discussion" />
          <ul className="mt-3 space-y-2">
            {discussions.length === 0 && <li className="text-sm text-muted-foreground">아직 토론이 없습니다.</li>}
            {discussions.map((p) => (
              <li key={p.id}>
                <Link href={`/community/${p.id}`} className="flex items-center justify-between gap-2 text-sm hover:text-brand">
                  <span className="truncate">{p.title}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">댓글 {p.comments}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>

        {/* 인기 질문 */}
        <Card>
          <SectionHeader title={<span className="inline-flex items-center gap-1.5"><HelpCircle className="size-4 text-brand" />최근 질문</span>} href="/community?type=question" />
          <ul className="mt-3 space-y-2">
            {questions.length === 0 && <li className="text-sm text-muted-foreground">아직 질문이 없습니다.</li>}
            {questions.map((p) => (
              <li key={p.id}>
                <Link href={`/community/${p.id}`} className="flex items-center justify-between gap-2 text-sm hover:text-brand">
                  <span className="truncate">{p.title}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">답변 {p.comments}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>

        {/* 리워드 */}
        <Card>
          <SectionHeader title={<span className="inline-flex items-center gap-1.5"><Gift className="size-4 text-brand" />리워드</span>} href="/rewards" />
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            작성한 글, 채택된 답변, 추천이 기여도로 기록됩니다. 현금 정산은 아직 제공되지 않으며, 제공 시점과 기준은 사전에 공지됩니다.
          </p>
          <Link href="/rewards" className="mt-3 inline-block rounded-lg border px-3 py-1.5 text-sm font-medium hover:bg-muted">내 기여도 보기</Link>
        </Card>
      </div>

      {/* 커뮤니티 피드 */}
      <section>
        <SectionHeader title="커뮤니티" href="/community" right={live ? undefined : <SampleBadge label="샘플 게시글" />} className="mb-2" />
        <Pills items={SORTS} active={sort} hrefFor={(s) => `/?sort=${s}`} className="mb-3" />
        <div className="space-y-2.5">
          {posts.slice(0, 3).map((p) => <PostCard key={p.id} post={p} />)}
          <AdSlot slot="feed-inline" />
          {posts.slice(3).map((p) => <PostCard key={p.id} post={p} />)}
        </div>
        {posts.length === 0 && (
          <p className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">아직 게시글이 없습니다. 첫 글을 작성해보세요.</p>
        )}
        <div className="mt-3 text-center">
          <Link href="/community" className="text-sm font-medium text-brand hover:underline">게시글 더 보기 ›</Link>
        </div>
      </section>

      <div className="xl:hidden">
        <PopularCreators limit={4} />
      </div>
      <div>
        <p className="mb-2 text-xs text-muted-foreground">인기 종목 토론</p>
        <div className="flex flex-wrap gap-1.5">
          {TRENDING_TICKERS.map((t) => (
            <Tag key={t} href={`/community?ticker=${t}`}>
              ${t} {tickerName(t) !== t ? tickerName(t) : ""}
            </Tag>
          ))}
        </div>
      </div>
    </div>
  );
}
