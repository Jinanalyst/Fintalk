import { UserAvatar } from "@/components/common/user-avatar";
import { TrendingTickers } from "@/components/feed/trending-tickers";
import { getTrendingTickers } from "@/lib/data/trending";
import Link from "next/link";
import { Award } from "lucide-react";
import { SampleBadge } from "@/components/common/bits";
import { contributionLevel, contributionScore, getCurrentUser, getMyStats } from "@/lib/data/community";
import { getTopHelpers } from "@/lib/data/creators";
import { fmtNum } from "@/lib/sample-data";

/** 내 기여도: 로그인 사용자의 실제 지표로 계산합니다. 금액은 표시하지 않습니다. */
export async function MyContributionCard() {
  const me = await getCurrentUser().catch(() => null);
  const stats = me ? await getMyStats(me.id).catch(() => null) : null;

  if (!me || !stats) {
    return (
      <section className="rounded-2xl bg-slate-900 p-5 text-white">
        <p className="text-xs font-bold text-blue-300">내 기여도</p>
        <p className="mt-2 text-base font-bold leading-snug">답하고, 공유하고, 채택되면 기여도가 쌓여요.</p>
        <p className="mt-1.5 text-xs leading-relaxed text-slate-300">로그인하면 내 활동 점수와 다음 단계까지 남은 점수를 볼 수 있어요.</p>
        <Link href="/login" className="mt-3 inline-flex h-9 items-center rounded-lg bg-white px-4 text-sm font-bold text-slate-900">로그인</Link>
      </section>
    );
  }

  const score = contributionScore(stats);
  const lv = contributionLevel(score);
  return (
    <section className="rounded-2xl bg-slate-900 p-5 text-white">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-blue-300">내 기여도 · {lv.cur.name}</p>
        <Link href="/rewards" className="text-xs text-slate-300 hover:text-white">자세히 ›</Link>
      </div>
      <p className="mt-1 text-3xl font-extrabold tracking-tight">{fmtNum(score)}<span className="ml-1 text-sm font-medium text-slate-300">점</span></p>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-700" role="progressbar" aria-valuenow={lv.pct} aria-valuemin={0} aria-valuemax={100} aria-label="다음 단계까지">
        <div className="h-full rounded-full bg-blue-400" style={{ width: `${lv.pct}%` }} />
      </div>
      <p className="mt-2 text-xs leading-relaxed text-slate-300">
        {lv.next ? `다음 단계 ${lv.next.name}까지 ${lv.remain}점. 답변이 채택되면 +15점이에요.` : "최고 단계예요. 계속 도움을 나눠 주세요."}
      </p>
      <p className="mt-2 text-[11px] text-slate-400">현금 정산은 준비 중이며 기여도만 기록됩니다.</p>
    </section>
  );
}

/** 채택 답변이 가장 많은 작성자 */
export async function TopHelpersCard() {
  const { items, live } = await getTopHelpers(3);
  return (
    <section className="rounded-2xl border bg-card p-4 shadow-xs">
      <div className="flex items-center justify-between gap-2">
        <h2 className="inline-flex items-center gap-1.5 text-sm font-bold"><Award className="size-4 text-amber-500" />도움왕</h2>
        {!live && <SampleBadge label="샘플" />}
      </div>
      <p className="mt-0.5 text-[11px] text-muted-foreground">채택된 답변이 가장 많은 작성자</p>
      <ol className="mt-3 space-y-2.5">
        {items.length === 0 && <li className="text-sm text-muted-foreground">아직 채택된 답변이 없습니다.</li>}
        {items.map((c, i) => (
          <li key={c.handle} className="flex items-center gap-2.5">
            <span className="w-4 text-center text-sm font-bold text-brand">{i + 1}</span>
            <UserAvatar name={c.name} url={c.avatar} className="bg-amber-100 text-sm text-amber-800 dark:bg-amber-400/15 dark:text-amber-300" />
            <Link href={`/creators/${encodeURIComponent(c.handle)}`} className="min-w-0 flex-1 truncate text-sm font-semibold hover:text-brand">{c.name}</Link>
            <span className="text-xs font-bold text-amber-700 dark:text-amber-300">채택 {c.accepted}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** 인기 종목 토론 (실시간 순위) — 사이드 카드 */
export async function TrendingTickersCard() {
  const { items, live } = await getTrendingTickers(6);
  return <TrendingTickers initial={items} live={live} variant="card" />;
}

/** 인기 종목 토론 (실시간 순위) — 가로 칩 */
export async function TrendingTickersStrip() {
  const { items, live } = await getTrendingTickers(6);
  return <TrendingTickers initial={items} live={live} variant="strip" />;
}
