import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, MessageCircleQuestion, PenLine } from "lucide-react";
import { Pills, SampleBadge, SectionHeader } from "@/components/common/bits";
import { InsightCard, PostCard, questionStatus } from "@/components/feed/cards";
import { SideCards } from "@/components/layout/shell";
import { TrendingTickersStrip } from "@/components/layout/side-cards";
import { getCurrentUser, listPosts, listWaitingQuestions } from "@/lib/data/community";
import { listFollowingIds } from "@/lib/data/creators";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { INSIGHT_TYPES, boardLabel } from "@/lib/sample-data";

export const metadata: Metadata = { alternates: { canonical: "/" } };

type Tab = "hot" | "new" | "following";

const TABS: { slug: Tab; label: string }[] = [
  { slug: "hot", label: "추천" },
  { slug: "new", label: "최신" },
  { slug: "following", label: "팔로잉" },
];

const FLOW = ["질문 올리기", "경험자가 답변", "도움 된 답변 채택", "기여도로 기록"];

export default async function HomePage({ searchParams }: PageProps<"/">) {
  const sp = await searchParams;
  const tab: Tab = sp.tab === "new" || sp.tab === "following" ? sp.tab : "hot";

  // 팔로잉 탭: 내가 팔로우한 크리에이터의 글만
  let following: { posts: Awaited<ReturnType<typeof listPosts>>["posts"]; needLogin: boolean; empty: boolean } | null = null;
  if (tab === "following") {
    const me = isSupabaseConfigured ? await getCurrentUser().catch(() => null) : null;
    if (!me) following = { posts: [], needLogin: true, empty: false };
    else {
      const ids = await listFollowingIds(me.id);
      following = { posts: (await listPosts({ authorIds: ids, sort: "new", limit: 20 })).posts, needLogin: false, empty: ids.length === 0 };
    }
  }

  const [waiting, feed, insights] = await Promise.all([
    listWaitingQuestions(4),
    tab === "following" ? Promise.resolve({ posts: [], live: isSupabaseConfigured }) : listPosts({ sort: tab, limit: 8 }),
    listPosts({ sort: "hot", limit: 3, types: INSIGHT_TYPES }),
  ]);
  const posts = following ? following.posts : feed.posts;
  const live = feed.live;

  return (
    <div className="space-y-7">

      {/* 히어로: 돕는 커뮤니티 */}
      <section className="overflow-hidden rounded-3xl border bg-card p-5 shadow-xs sm:p-8">
        <p className="inline-flex rounded-full bg-brand-soft px-3 py-1 text-xs font-bold text-brand">국내 주식 · 미국 주식 · 암호화폐</p>
        <h1 className="mt-4 text-3xl font-extrabold leading-tight tracking-tight sm:text-5xl">
          투자의 생각을 나누고,
          <br />
          <span className="text-brand">함께 성장하다.</span>
        </h1>
        <p className="mt-4 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
          혼자 고민하던 질문에 경험 있는 투자자가 답해 줍니다. 아는 만큼 답하면 채택과 기여도로 돌아와요.
        </p>
        <div className="mt-6 flex flex-wrap gap-2.5">
          <Link href="/community/write?type=question" className="inline-flex h-12 items-center rounded-xl bg-brand px-6 text-base font-bold text-primary-foreground hover:opacity-90">
            질문하고 답 받기
          </Link>
          <Link href="/community/write?type=analysis" className="inline-flex h-12 items-center gap-1.5 rounded-xl border-2 px-6 text-base font-bold hover:bg-muted">
            <PenLine className="size-4" /> 내 분석 공유하기
          </Link>
        </div>
        <ol className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
          {FLOW.map((s, i) => (
            <li key={s} className="flex items-center gap-2">
              <span className="grid size-5 place-items-center rounded-full bg-foreground text-[11px] font-bold text-background">{i + 1}</span>
              {s}
            </li>
          ))}
        </ol>
      </section>

      {/* 지금 답을 기다리는 질문 */}
      <section>
        <SectionHeader
          title={<span className="inline-flex items-center gap-1.5"><MessageCircleQuestion className="size-5 text-brand" />지금 답을 기다리는 질문</span>}
          href="/community?type=question"
          hrefLabel="질문 전체"
          right={waiting.live ? undefined : <SampleBadge label="샘플 게시글" />}
          className="mb-2"
        />
        <ul className="divide-y rounded-2xl border bg-card shadow-xs">
          {waiting.posts.length === 0 && <li className="p-6 text-center text-sm text-muted-foreground">대기 중인 질문이 없어요. 궁금한 점을 먼저 올려 보세요.</li>}
          {waiting.posts.map((p) => {
            const st = questionStatus(p);
            return (
              <li key={p.id} className="flex items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-muted-foreground">
                    {boardLabel(p.category)} · {p.createdAt}
                    {st && <span className={`ml-2 rounded px-1.5 py-0.5 text-[11px] ${st.cls}`}>{st.label}</span>}
                  </p>
                  <Link href={`/community/${p.id}`} className="mt-0.5 block text-[15px] font-bold leading-snug hover:text-brand">{p.title}</Link>
                </div>
                <Link href={`/community/${p.id}#answer`} className="inline-flex h-10 shrink-0 items-center gap-1 rounded-lg bg-brand-soft px-3.5 text-sm font-bold text-brand hover:bg-brand hover:text-primary-foreground">
                  답변하기 <ArrowRight className="size-3.5" />
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      {/* 추천 인사이트 */}
      {insights.posts.length > 0 && (
        <section>
          <SectionHeader title="추천 인사이트" href="/insights" right={insights.live ? undefined : <SampleBadge label="샘플 게시글" />} className="mb-2" />
          <div className="grid gap-3 md:grid-cols-3">
            {insights.posts.map((p) => <InsightCard key={p.id} post={p} />)}
          </div>
        </section>
      )}

      {/* 인기 종목 토론: 넓은 화면에서는 오른쪽 열 카드로 보이므로 좁은 화면에서만 */}
      <div className="xl:hidden">
        <TrendingTickersStrip />
      </div>

      {/* 피드 */}
      <section>
        <SectionHeader title="커뮤니티" href="/community" right={live ? undefined : <SampleBadge label="샘플 게시글" />} className="mb-2" />
        <Link href="/community/write" className="mb-3 flex items-center gap-3 rounded-2xl border bg-card p-3 shadow-xs hover:border-brand/40">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-soft font-bold text-brand" aria-hidden="true">나</span>
          <span className="flex-1 rounded-xl bg-muted px-4 py-2.5 text-sm text-muted-foreground">궁금한 점이나 오늘의 생각을 남겨 보세요</span>
          <span className="hidden h-10 items-center rounded-xl border-2 border-brand px-4 text-sm font-bold text-brand sm:inline-flex">글쓰기</span>
        </Link>
        <Pills items={TABS} active={tab} hrefFor={(t) => (t === "hot" ? "/" : `/?tab=${t}`)} className="mb-3" />
        <div className="space-y-2.5">
          {posts.slice(0, 3).map((p) => <PostCard key={p.id} post={p} />)}
          {posts.slice(3).map((p) => <PostCard key={p.id} post={p} />)}
        </div>
        {posts.length === 0 && (
          <div className="rounded-2xl border bg-card p-8 text-center text-sm text-muted-foreground">
            {following?.needLogin ? (
              <>팔로잉 피드는 로그인 후 볼 수 있어요. <Link href="/login?next=/%3Ftab%3Dfollowing" className="text-brand underline">로그인</Link></>
            ) : following?.empty ? (
              <>아직 팔로우한 크리에이터가 없어요. <Link href="/creators" className="text-brand underline">크리에이터 찾아보기</Link></>
            ) : following ? (
              "팔로우한 크리에이터의 새 글이 아직 없어요."
            ) : (
              <>아직 게시글이 없습니다. <Link href="/community/write" className="text-brand underline">첫 글을 작성해보세요.</Link></>
            )}
          </div>
        )}
        <div className="mt-3 text-center">
          <Link href="/community" className="text-sm font-medium text-brand hover:underline">게시글 더 보기 ›</Link>
        </div>
      </section>

      {/* 좁은 화면에서는 오른쪽 열 대신 여기에 */}
      <div className="space-y-4 xl:hidden">
        <SideCards trending={false} />
      </div>

    </div>
  );
}
