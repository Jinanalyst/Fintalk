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
  { slug: "hot", label: "Top" },
  { slug: "new", label: "Newest" },
  { slug: "following", label: "Following" },
];

const FLOW = ["Ask a question", "Experienced investors answer", "Accept the helpful answer", "Earn contribution points"];

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
  // 대기 중인 질문이 없으면 답변이 달린 인기 질문으로 대체, 그것도 없으면 섹션을 숨김
  const showingWaiting = waiting.posts.length > 0;
  const qa = showingWaiting
    ? waiting
    : await listPosts({ sort: "hot", types: ["question"], limit: 20 }).then((r) => ({ posts: r.posts.filter((p) => p.comments > 0).slice(0, 4), live: r.live }));
  const posts = following ? following.posts : feed.posts;
  const live = feed.live;

  return (
    <div className="space-y-7">

      {/* 히어로: 돕는 커뮤니티 */}
      <section className="overflow-hidden rounded-3xl border bg-card p-5 shadow-xs sm:p-8">
        <p className="inline-flex rounded-full bg-brand-soft px-3 py-1 text-xs font-bold text-brand">Stocks · US equities · Crypto</p>
        <h1 className="mt-4 text-3xl font-extrabold leading-tight tracking-tight sm:text-5xl">
          Share your ideas,
          <br />
          <span className="text-brand">grow together.</span>
        </h1>
        <p className="mt-4 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
          Experienced investors answer the questions you have been stuck on. Share what you know and earn accepted answers and contribution points.
        </p>
        <div className="mt-6 flex flex-wrap gap-2.5">
          <Link href="/community/write?type=question" className="inline-flex h-12 items-center rounded-xl bg-brand px-6 text-base font-bold text-primary-foreground hover:opacity-90">
            Ask and get answers
          </Link>
          <Link href="/community/write?type=analysis" className="inline-flex h-12 items-center gap-1.5 rounded-xl border-2 px-6 text-base font-bold hover:bg-muted">
            <PenLine className="size-4" /> Share my analysis
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
      {qa.posts.length > 0 && (
      <section>
        <SectionHeader
          title={<span className="inline-flex items-center gap-1.5"><MessageCircleQuestion className="size-5 text-brand" />{showingWaiting ? "Questions waiting for answers" : "Popular answered questions"}</span>}
          href="/community?type=question"
          hrefLabel="All questions"
          right={qa.live ? undefined : <SampleBadge label="Sample post" />}
          className="mb-2"
        />
        <ul className="divide-y rounded-2xl border bg-card shadow-xs">
          {qa.posts.map((p) => {
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
                <Link href={showingWaiting ? `/community/${p.id}#answer` : `/community/${p.id}`} className="inline-flex h-10 shrink-0 items-center gap-1 rounded-lg bg-brand-soft px-3.5 text-sm font-bold text-brand hover:bg-brand hover:text-primary-foreground">
                  {showingWaiting ? "Answer" : "View answers"} <ArrowRight className="size-3.5" />
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
      )}

      {/* 추천 인사이트 */}
      {insights.posts.length > 0 && (
        <section>
          <SectionHeader title="Recommended insights" href="/insights" right={insights.live ? undefined : <SampleBadge label="Sample post" />} className="mb-2" />
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
        <SectionHeader title="Community" href="/community" right={live ? undefined : <SampleBadge label="Sample post" />} className="mb-2" />
        <Link href="/community/write" className="mb-3 flex items-center gap-3 rounded-2xl border bg-card p-3 shadow-xs hover:border-brand/40">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-soft font-bold text-brand" aria-hidden="true">Me</span>
          <span className="flex-1 rounded-xl bg-muted px-4 py-2.5 text-sm text-muted-foreground">Ask a question or share your thoughts today</span>
          <span className="hidden h-10 items-center rounded-xl border-2 border-brand px-4 text-sm font-bold text-brand sm:inline-flex">Write</span>
        </Link>
        <Pills items={TABS} active={tab} hrefFor={(t) => (t === "hot" ? "/" : `/?tab=${t}`)} className="mb-3" />
        <div className="space-y-2.5">
          {posts.slice(0, 3).map((p) => <PostCard key={p.id} post={p} />)}
          {posts.slice(3).map((p) => <PostCard key={p.id} post={p} />)}
        </div>
        {posts.length === 0 && (
          <div className="rounded-2xl border bg-card p-8 text-center text-sm text-muted-foreground">
            {following?.needLogin ? (
              <>Log in to see your Following feed. <Link href="/login?next=/%3Ftab%3Dfollowing" className="text-brand underline">Log in</Link></>
            ) : following?.empty ? (
              <>You are not following any creators yet. <Link href="/creators" className="text-brand underline">Find creators</Link></>
            ) : following ? (
              "No new posts from creators you follow."
            ) : (
              <>No posts yet. <Link href="/community/write" className="text-brand underline">Write the first post.</Link></>
            )}
          </div>
        )}
        <div className="mt-3 text-center">
          <Link href="/community" className="text-sm font-medium text-brand hover:underline">More posts ›</Link>
        </div>
      </section>

      {/* 좁은 화면에서는 오른쪽 열 대신 여기에 */}
      <div className="space-y-4 xl:hidden">
        <SideCards trending={false} />
      </div>

    </div>
  );
}
