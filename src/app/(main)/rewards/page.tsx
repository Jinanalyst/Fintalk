import type { Metadata } from "next";
import Link from "next/link";
import { Lock } from "lucide-react";
import { Card, SampleBadge, SectionHeader } from "@/components/common/bits";
import { LiveRefresh } from "@/components/common/live-refresh";
import { type MyStats, contributionLevel, contributionScore, getContributionRanking, getCurrentUser, getMyStats, listPosts, TRADE_CAP } from "@/lib/data/community";
import { RankingPanel } from "@/components/common/ranking-panel";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { POSTS, fmtNum, postTypeLabel } from "@/lib/sample-data";

export const metadata: Metadata = {
  title: "Rewards",
  description: "See how the help you share builds up as contribution points, live.",
  robots: { index: false, follow: true },
};

export const dynamic = "force-dynamic";

/** 샘플 모드(Supabase 미연결) 미리보기용 */
const DEMO: MyStats & { trades: number; shared: number } = { trades: 18, shared: 3, posts: 12, insights: 4, answers: 30, accepted: 6, upvotes: 140, views: 4200, followers: 38, following: 12 };

// 기여도 가중치. contributionScore() 와 같은 값이어야 합니다.
const RULES = [
  { k: "posts", label: "Posts written", unit: 2, hint: "per post" },
  { k: "insights", label: "Insights (analysis, strategy, review, resource)", unit: 5, hint: "bonus per post" },
  { k: "answers", label: "Answers and comments", unit: 2, hint: "each" },
  { k: "accepted", label: "Accepted answers", unit: 15, hint: "each" },
  { k: "upvotes", label: "Upvotes received", unit: 1, hint: "each" },
  { k: "trades", label: "Closed paper trades (max 30)", unit: 1, hint: "per trade" },
  { k: "shared", label: "Shared trade cards", unit: 3, hint: "each" },
  { k: "views", label: "Views", unit: 1 / 50, hint: "1 pt per 50 views" },
] as const;

type Stats = MyStats & { trades: number; shared: number };

function points(k: (typeof RULES)[number]["k"], s: Stats) {
  const unit = RULES.find((r) => r.k === k)!.unit;
  return Math.floor((k === "trades" ? Math.min(s.trades, TRADE_CAP) : s[k]) * unit);
}

export default async function RewardsPage() {
  const live = isSupabaseConfigured;
  const me = live ? await getCurrentUser().catch(() => null) : null;
  const baseStats = me ? await getMyStats(me.id).catch(() => null) : live ? null : DEMO;

  const [{ posts: mine }, ranking] = await Promise.all([
    me ? listPosts({ authorId: me.id, sort: "new", limit: 20 }) : Promise.resolve({ posts: live ? [] : POSTS.slice(0, 3), live }),
    live ? getContributionRanking().catch(() => []) : Promise.resolve([]),
  ]);

  if (live && (!me || !baseStats)) {
    return (
      <div className="space-y-5">
        <Header live={live} />
        <Card className="p-8 text-center">
          <h2 className="text-lg font-bold">Log in to see your contribution live</h2>
          <p className="mt-1 text-sm text-muted-foreground">See how posts, answers, accepted answers and upvotes turn into points.</p>
          <Link href="/login?next=/rewards" className="mt-4 inline-flex h-11 items-center rounded-xl bg-brand px-6 text-sm font-bold text-primary-foreground">Log in</Link>
        </Card>
        {ranking.length > 0 && <RankingPanel rows={ranking.slice(0, 50)} meId={null} total={ranking.length} />}
        <Guide />
        <Future />
      </div>
    );
  }

  const myRow = me ? ranking.find((r) => r.id === me.id) : undefined;
  const s: Stats = { ...baseStats!, trades: myRow?.trades ?? (baseStats as Stats).trades ?? 0, shared: myRow?.shared ?? (baseStats as Stats).shared ?? 0 };
  const score = contributionScore(s);
  const lv = contributionLevel(score);

  const rank = myRow ? { pos: myRow.rank, total: ranking.length } : null;
  const week = mine.filter((p) => p.ageMin <= 7 * 24 * 60).length;

  // 다음 활동 제안: 아직 안 해 본 활동부터, 점수가 큰 순
  const todo = [
    s.accepted === 0 && { href: "/community?type=question", title: "Answer a question and get accepted", pts: "+2 pts, +15 pts if accepted" },
    s.insights === 0 && { href: "/community/write?type=analysis", title: "Write your first insight", pts: "+7 pts" },
    s.answers < 5 && { href: "/community?type=question", title: "Answer a question waiting for replies", pts: "+2 pts" },
    { href: "/community/write", title: "Share a thought today", pts: "+2 pts" },
  ].filter(Boolean) as { href: string; title: string; pts: string }[];

  const kpis = [
    { l: "Posts", v: s.posts },
    { l: "Insights", v: s.insights },
    { l: "Answers", v: s.answers },
    { l: "Accepted", v: s.accepted },
    { l: "Upvotes", v: s.upvotes },
    { l: "Views", v: s.views },
    { l: "Followers", v: s.followers },
    { l: "Following", v: s.following },
  ];
  const maxPts = Math.max(1, ...RULES.map((r) => points(r.k, s)));

  return (
    <div className="space-y-5">
      <Header live={live} />

      {/* 내 기여도 */}
      <section className="rounded-3xl bg-slate-900 p-5 text-white sm:p-7">
        <p className="text-sm font-bold text-blue-300">{me?.nickname ?? "Preview"} · Contribution · {lv.cur.name}</p>
        <p className="mt-1 text-5xl font-extrabold tracking-tight">{fmtNum(score)}<span className="ml-1.5 text-lg font-medium text-slate-300"> pts</span></p>
        <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-slate-700" role="progressbar" aria-valuenow={lv.pct} aria-valuemin={0} aria-valuemax={100} aria-label="Progress to next level">
          <div className="h-full rounded-full bg-blue-400" style={{ width: `${lv.pct}%` }} />
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-sm text-slate-300">
          <span>{lv.next ? `${lv.remain} pts to ${lv.next.name}` : "Top level"}</span>
          <span>
            {rank && <>Rank {rank.pos} of {rank.total} · Top {Math.max(1, Math.ceil((rank.pos / rank.total) * 100))}% · </>}
            {week} new posts in the last 7 days
            {ranking.length > 0 && <> · <a href="#ranking" className="font-bold text-blue-300 underline-offset-2 hover:underline">More rankings ›</a></>}
          </span>
        </div>
        <p className="mt-3 text-xs text-slate-400">Contribution points are an activity record, not cash. Cash payouts are not available yet.</p>
      </section>

      {ranking.length > 0 ? <RankingPanel rows={ranking.slice(0, 50)} meId={me?.id ?? null} total={ranking.length} /> : null}

      {/* 지표 */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {kpis.map((k) => (
          <Card key={k.l} className="p-3">
            <p className="text-xs text-muted-foreground">{k.l}</p>
            <p className="mt-1 text-2xl font-extrabold tabular-nums">{fmtNum(k.v)}</p>
          </Card>
        ))}
      </div>

      {/* 점수 구성 */}
      <Card>
        <SectionHeader title="How points are calculated" right={!live ? <SampleBadge label="Sample" /> : undefined} />
        <ul className="mt-3 space-y-3">
          {RULES.map((r) => {
            const p = points(r.k, s);
            return (
              <li key={r.k} className="text-sm">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-medium">{r.label} <span className="text-xs font-normal text-muted-foreground">{fmtNum(s[r.k])} · {r.hint}</span></span>
                  <span className="font-bold tabular-nums">+{fmtNum(p)} pts</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-brand" style={{ width: `${(p / maxPts) * 100}%` }} /></div>
              </li>
            );
          })}
        </ul>
      </Card>

      {/* 다음 활동 */}
      <Card>
        <SectionHeader title="Earn points now" />
        <ul className="mt-2 divide-y">
          {todo.slice(0, 3).map((t) => (
            <li key={t.title}>
              <Link href={t.href} className="flex items-center justify-between gap-3 py-3 text-sm hover:text-brand">
                <span className="font-semibold">{t.title}</span>
                <span className="shrink-0 rounded-md bg-brand-soft px-2 py-0.5 text-xs font-bold text-brand">{t.pts}</span>
              </Link>
            </li>
          ))}
        </ul>
      </Card>

      {/* 내 글 성과 */}
      <Card>
        <SectionHeader title="My post performance" right={!live ? <SampleBadge label="Sample" /> : undefined} href="/me" hrefLabel="My activity" />
        <ul className="mt-2 divide-y">
          {mine.length === 0 && <li className="py-6 text-center text-sm text-muted-foreground">No posts yet. Write your first one.</li>}
          {mine.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
              <Link href={`/community/${p.id}`} className="min-w-0 flex-1 hover:text-brand">
                <span className="mr-1.5 rounded bg-muted px-1.5 py-0.5 text-[11px] font-semibold">{postTypeLabel(p.type)}</span>
                {p.acceptedCommentId && <span className="mr-1.5 rounded bg-up/10 px-1.5 py-0.5 text-[11px] font-semibold text-up">Accepted</span>}
                <span className="line-clamp-1 inline font-medium">{p.title}</span>
              </Link>
              <span className="shrink-0 text-xs text-muted-foreground">Views {fmtNum(p.views)} · Upvotes {p.upvotes} · Comments {p.comments}</span>
            </li>
          ))}
        </ul>
      </Card>

      <Guide />
      <Future />
    </div>
  );
}

function Header({ live }: { live: boolean }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-2">
      <div>
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Rewards</h1>
        <p className="mt-1 text-sm text-muted-foreground">See your contribution grow with every helpful action.</p>
      </div>
      {live ? <LiveRefresh seconds={30} /> : <SampleBadge label="Sample preview (Supabase not connected)" />}
    </div>
  );
}

/** 프로그램 안내: 어떻게 쌓이고, 무엇이 제외되는지 */
function Guide() {
  return (
    <Card>
      <SectionHeader title="About the rewards program" />
      <ol className="mt-2 grid gap-2 text-sm sm:grid-cols-3">
        {[
          ["1. Help and share", "Answer questions and share evidence-based analysis."],
          ["2. Get recognized", "Upvotes, saves and accepted answers show what was helpful."],
          ["3. Recorded as contribution", "Your activity is recorded as points and levels, and great content is featured in Insights."],
        ].map(([t, d]) => (
          <li key={t} className="rounded-lg bg-muted/60 p-3"><p className="font-semibold">{t}</p><p className="mt-1 text-xs text-muted-foreground">{d}</p></li>
        ))}
      </ol>
      <div className="mt-3 grid gap-3 text-xs leading-relaxed text-muted-foreground sm:grid-cols-2">
        <div>
          <p className="mb-1 font-bold text-foreground">Not counted toward contribution</p>
          <ul className="list-disc space-y-0.5 pl-4">
            <li>Ad clicks</li>
            <li>Fake or repeated views</li>
            <li>Duplicate or copied content</li>
            <li>False information, faked profit proof, paid signal-group promotion</li>
          </ul>
        </div>
        <div>
          <p className="mb-1 font-bold text-foreground">Payout policy (planned)</p>
          <ul className="list-disc space-y-0.5 pl-4">
            <li>Capped at 30% of distributable ad revenue</li>
            <li>Activity is reviewed by the operator before payout</li>
            <li>Announced in advance once the policy is final</li>
          </ul>
        </div>
      </div>
    </Card>
  );
}

function Future() {
  return (
    <Card className="border-dashed">
      <SectionHeader title={<span className="inline-flex items-center gap-1.5"><Lock className="size-4" />Cash payouts (coming soon)</span>} />
      <p className="mt-2 text-sm text-muted-foreground">No amounts are paid or shown at this time. The items below open once the policy is final.</p>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {["Estimated rewards", "Confirmed rewards", "Total rewards", "Monthly statements", "Payout account", "Request payout"].map((t) => (
          <div key={t} className="flex items-center justify-between rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
            {t}<span className="rounded bg-card px-1.5 py-0.5 text-[10px]">Soon</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
