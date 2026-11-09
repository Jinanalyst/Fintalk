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
  title: "리워드",
  description: "내가 나눈 도움이 기여도로 쌓이는 과정을 실시간으로 확인하세요.",
  robots: { index: false, follow: true },
};

export const dynamic = "force-dynamic";

/** 샘플 모드(Supabase 미연결) 미리보기용 */
const DEMO: MyStats & { trades: number; shared: number } = { trades: 18, shared: 3, posts: 12, insights: 4, answers: 30, accepted: 6, upvotes: 140, views: 4200, followers: 38, following: 12 };

// 기여도 가중치. contributionScore() 와 같은 값이어야 합니다.
const RULES = [
  { k: "posts", label: "작성한 글", unit: 2, hint: "게시글 1개당" },
  { k: "insights", label: "인사이트(분석·전략·복기·자료)", unit: 5, hint: "1개당 추가 점수" },
  { k: "answers", label: "남긴 답변·댓글", unit: 2, hint: "1개당" },
  { k: "accepted", label: "채택된 답변", unit: 15, hint: "1개당" },
  { k: "upvotes", label: "받은 추천", unit: 1, hint: "1개당" },
  { k: "trades", label: "청산한 모의거래 (최대 30건)", unit: 1, hint: "1건당" },
  { k: "shared", label: "공유한 거래 카드", unit: 3, hint: "1개당" },
  { k: "views", label: "조회수", unit: 1 / 50, hint: "50회당 1점" },
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
          <h2 className="text-lg font-bold">로그인하면 내 기여도를 실시간으로 볼 수 있어요</h2>
          <p className="mt-1 text-sm text-muted-foreground">글, 답변, 채택, 추천이 어떻게 점수로 쌓이는지 확인해 보세요.</p>
          <Link href="/login?next=/rewards" className="mt-4 inline-flex h-11 items-center rounded-xl bg-brand px-6 text-sm font-bold text-primary-foreground">로그인</Link>
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
    s.accepted === 0 && { href: "/community?type=question", title: "질문에 답변하고 채택받기", pts: "+2점, 채택 시 +15점" },
    s.insights === 0 && { href: "/community/write?type=analysis", title: "첫 인사이트 쓰기", pts: "+7점" },
    s.answers < 5 && { href: "/community?type=question", title: "답을 기다리는 질문에 답하기", pts: "+2점" },
    { href: "/community/write", title: "오늘의 생각 남기기", pts: "+2점" },
  ].filter(Boolean) as { href: string; title: string; pts: string }[];

  const kpis = [
    { l: "작성한 글", v: s.posts },
    { l: "인사이트", v: s.insights },
    { l: "남긴 답변", v: s.answers },
    { l: "채택된 답변", v: s.accepted },
    { l: "받은 추천", v: s.upvotes },
    { l: "조회수", v: s.views },
    { l: "팔로워", v: s.followers },
    { l: "팔로잉", v: s.following },
  ];
  const maxPts = Math.max(1, ...RULES.map((r) => points(r.k, s)));

  return (
    <div className="space-y-5">
      <Header live={live} />

      {/* 내 기여도 */}
      <section className="rounded-3xl bg-slate-900 p-5 text-white sm:p-7">
        <p className="text-sm font-bold text-blue-300">{me?.nickname ?? "미리보기"}님의 기여도 · {lv.cur.name}</p>
        <p className="mt-1 text-5xl font-extrabold tracking-tight">{fmtNum(score)}<span className="ml-1.5 text-lg font-medium text-slate-300">점</span></p>
        <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-slate-700" role="progressbar" aria-valuenow={lv.pct} aria-valuemin={0} aria-valuemax={100} aria-label="다음 단계까지">
          <div className="h-full rounded-full bg-blue-400" style={{ width: `${lv.pct}%` }} />
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-sm text-slate-300">
          <span>{lv.next ? `다음 단계 ${lv.next.name}까지 ${lv.remain}점` : "최고 단계예요"}</span>
          <span>
            {rank && <>전체 {rank.pos}위 / {rank.total}명 · 상위 {Math.max(1, Math.ceil((rank.pos / rank.total) * 100))}% · </>}
            최근 7일 새 글 {week}개
            {ranking.length > 0 && <> · <a href="#ranking" className="font-bold text-blue-300 underline-offset-2 hover:underline">순위 더보기 ›</a></>}
          </span>
        </div>
        <p className="mt-3 text-xs text-slate-400">기여도는 활동 기록이며 현금이 아닙니다. 현금 정산은 준비 중이에요.</p>
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
        <SectionHeader title="점수는 이렇게 계산돼요" right={!live ? <SampleBadge label="샘플" /> : undefined} />
        <ul className="mt-3 space-y-3">
          {RULES.map((r) => {
            const p = points(r.k, s);
            return (
              <li key={r.k} className="text-sm">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-medium">{r.label} <span className="text-xs font-normal text-muted-foreground">{fmtNum(s[r.k])}개 · {r.hint}</span></span>
                  <span className="font-bold tabular-nums">+{fmtNum(p)}점</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-brand" style={{ width: `${(p / maxPts) * 100}%` }} /></div>
              </li>
            );
          })}
        </ul>
      </Card>

      {/* 다음 활동 */}
      <Card>
        <SectionHeader title="지금 하면 점수가 쌓여요" />
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
        <SectionHeader title="내 게시글 성과" right={!live ? <SampleBadge label="샘플" /> : undefined} href="/me" hrefLabel="내 활동" />
        <ul className="mt-2 divide-y">
          {mine.length === 0 && <li className="py-6 text-center text-sm text-muted-foreground">아직 작성한 글이 없어요. 첫 글을 올려 보세요.</li>}
          {mine.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
              <Link href={`/community/${p.id}`} className="min-w-0 flex-1 hover:text-brand">
                <span className="mr-1.5 rounded bg-muted px-1.5 py-0.5 text-[11px] font-semibold">{postTypeLabel(p.type)}</span>
                {p.acceptedCommentId && <span className="mr-1.5 rounded bg-up/10 px-1.5 py-0.5 text-[11px] font-semibold text-up">채택 완료</span>}
                <span className="line-clamp-1 inline font-medium">{p.title}</span>
              </Link>
              <span className="shrink-0 text-xs text-muted-foreground">조회 {fmtNum(p.views)} · 추천 {p.upvotes} · 댓글 {p.comments}</span>
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
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">리워드</h1>
        <p className="mt-1 text-sm text-muted-foreground">도움이 된 만큼 쌓이는 내 기여도를 확인하세요.</p>
      </div>
      {live ? <LiveRefresh seconds={30} /> : <SampleBadge label="샘플 미리보기 (Supabase 미연결)" />}
    </div>
  );
}

/** 프로그램 안내: 어떻게 쌓이고, 무엇이 제외되는지 */
function Guide() {
  return (
    <Card>
      <SectionHeader title="리워드 프로그램 안내" />
      <ol className="mt-2 grid gap-2 text-sm sm:grid-cols-3">
        {[
          ["1. 돕고 나누기", "질문에 답하고, 근거 있는 분석을 공유합니다."],
          ["2. 인정받기", "추천, 저장, 채택된 답변으로 도움이 된 것이 확인됩니다."],
          ["3. 기여도로 기록", "활동이 점수와 단계로 기록되고, 우수 콘텐츠는 인사이트에 소개됩니다."],
        ].map(([t, d]) => (
          <li key={t} className="rounded-lg bg-muted/60 p-3"><p className="font-semibold">{t}</p><p className="mt-1 text-xs text-muted-foreground">{d}</p></li>
        ))}
      </ol>
      <div className="mt-3 grid gap-3 text-xs leading-relaxed text-muted-foreground sm:grid-cols-2">
        <div>
          <p className="mb-1 font-bold text-foreground">기여도에서 제외되는 것</p>
          <ul className="list-disc space-y-0.5 pl-4">
            <li>광고 클릭</li>
            <li>가짜·반복 조회</li>
            <li>중복·복사 콘텐츠</li>
            <li>허위 정보, 수익 인증 조작, 유료 리딩방 홍보</li>
          </ul>
        </div>
        <div>
          <p className="mb-1 font-bold text-foreground">정산 정책 (예정)</p>
          <ul className="list-disc space-y-0.5 pl-4">
            <li>분배 가능한 광고 수익의 최대 30% 이내에서 운영</li>
            <li>지급 전에 운영자가 활동 내용을 검토</li>
            <li>정책이 확정되면 사전에 공지</li>
          </ul>
        </div>
      </div>
    </Card>
  );
}

function Future() {
  return (
    <Card className="border-dashed">
      <SectionHeader title={<span className="inline-flex items-center gap-1.5"><Lock className="size-4" />현금 정산 (준비 중)</span>} />
      <p className="mt-2 text-sm text-muted-foreground">현재는 어떠한 금액도 지급되거나 표시되지 않습니다. 아래 항목은 정책이 확정된 뒤에 열립니다.</p>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {["예상 리워드", "확정 리워드", "누적 리워드", "월 정산 내역", "정산 계좌 등록", "지급 신청"].map((t) => (
          <div key={t} className="flex items-center justify-between rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
            {t}<span className="rounded bg-card px-1.5 py-0.5 text-[10px]">준비 중</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
