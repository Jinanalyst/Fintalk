import type { Metadata } from "next";
import Link from "next/link";
import { Trophy } from "lucide-react";
import { Card, PageTitle, Pills } from "@/components/common/bits";
import { UserAvatar } from "@/components/common/user-avatar";
import { getCurrentUser } from "@/lib/data/community";
import { getLeaderboard, type LeaderPeriod, type LeaderRow } from "@/lib/data/trade";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "모의투자 리더보드",
  description: "모의투자 실현 수익률로 겨루는 이용자 순위입니다.",
};

export const dynamic = "force-dynamic";

const PERIODS: { slug: LeaderPeriod; label: string }[] = [
  { slug: "week", label: "주간" },
  { slug: "month", label: "월간" },
  { slug: "all", label: "전체" },
];

const pct = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
const usd = (n: number) => `${n >= 0 ? "+" : "-"}$${Math.abs(Math.round(n)).toLocaleString()}`;
const tone = (n: number) => (n > 0 ? "text-up" : n < 0 ? "text-down" : "text-muted-foreground");
const MEDAL = ["bg-amber-600", "bg-slate-500", "bg-orange-800"];

function Podium({ r, first }: { r: LeaderRow; first: boolean }) {
  return (
    <Card className={cn("flex flex-col gap-4 p-5", first && "border-2 border-brand py-7")}>
      <div className="flex items-center justify-between">
        <span className={cn("grid size-8 place-items-center rounded-full text-sm font-extrabold text-white", MEDAL[r.rank - 1])}>{r.rank}</span>
        <span className="text-xs text-muted-foreground">{r.rank}위</span>
      </div>
      <div className="flex items-center gap-3">
        <UserAvatar name={r.nickname} url={r.avatar} className="size-12 text-lg" />
        <div className="min-w-0">
          <Link href={`/creators/${encodeURIComponent(r.nickname)}`} className="block truncate text-base font-bold hover:text-brand">{r.nickname}</Link>
          <p className="text-xs text-muted-foreground">거래 {r.trades}회 · 승률 {r.winRate === null ? "-" : `${Math.round(r.winRate)}%`}</p>
        </div>
      </div>
      <div className="flex items-baseline justify-between">
        <span className={cn("text-3xl font-extrabold tracking-tight", tone(r.returnPct))}>{pct(r.returnPct)}</span>
        <span className="text-xs text-muted-foreground">{usd(r.pnl)}</span>
      </div>
    </Card>
  );
}

function Stat({ label, value, cls }: { label: string; value: string; cls?: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("text-xl font-bold", cls)}>{value}</p>
    </div>
  );
}

export default async function LeaderboardPage({ searchParams }: PageProps<"/trade/leaderboard">) {
  const sp = await searchParams;
  const period = PERIODS.some((p) => p.slug === sp.period) ? (sp.period as LeaderPeriod) : "week";
  const [rows, me] = await Promise.all([getLeaderboard(period), getCurrentUser()]);
  const mine = me ? rows.find((r) => r.id === me.id) : undefined;
  const top = rows.slice(0, 3);
  // 시상대: 2위 · 1위 · 3위 순서로 배치
  const podium = [top[1], top[0], top[2]].filter(Boolean) as LeaderRow[];

  return (
    <div className="mx-auto max-w-5xl">
      <PageTitle
        title="리더보드"
        desc="모의투자 실현 수익률(시작 자금 10,000 USDT 대비) 순위입니다. 청산 거래 3회 이상인 이용자만 포함됩니다."
        right={<Pills items={PERIODS} active={period} hrefFor={(s) => `/trade/leaderboard?period=${s}`} />}
      />

      {!isSupabaseConfigured && (
        <p className="mb-3 rounded-lg border border-dashed p-3 text-sm text-muted-foreground">Supabase 가 연결되지 않아 순위를 불러올 수 없습니다.</p>
      )}

      {me && (
        <Card className="mb-4 flex flex-wrap items-center gap-x-10 gap-y-3 p-5">
          <div className="flex items-center gap-3">
            <UserAvatar name={me.nickname} url={me.avatar_url} className="size-12 text-lg" />
            <div>
              <p className="text-xs text-muted-foreground">내 현재 순위</p>
              <p className="text-2xl font-extrabold tracking-tight">
                {mine ? `${mine.rank}위` : "순위 없음"}
                <span className="ml-1 text-sm font-medium text-muted-foreground">/ {rows.length}명</span>
              </p>
            </div>
          </div>
          {mine ? (
            <div className="flex flex-1 flex-wrap gap-x-10 gap-y-2">
              <Stat label="수익률" value={pct(mine.returnPct)} cls={tone(mine.returnPct)} />
              <Stat label="승률" value={mine.winRate === null ? "-" : `${Math.round(mine.winRate)}%`} />
              <Stat label="거래 수" value={String(mine.trades)} />
            </div>
          ) : (
            <p className="flex-1 text-sm text-muted-foreground">이 기간에 청산한 거래가 3회 이상이면 순위에 표시됩니다.</p>
          )}
          <Link href={`/me/${encodeURIComponent(me.nickname)}?tab=paper`} className="rounded-lg bg-brand-soft px-4 py-2 text-sm font-semibold text-brand">내 성과 보기</Link>
        </Card>
      )}

      {rows.length === 0 ? (
        <Card className="grid place-items-center gap-2 p-12 text-center">
          <Trophy className="size-8 text-muted-foreground" />
          <p className="font-semibold">아직 순위가 없습니다</p>
          <p className="text-sm text-muted-foreground">모의투자에서 거래를 3회 이상 청산하면 리더보드에 올라갑니다.</p>
          <Link href="/trade" className="mt-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-primary-foreground">거래하러 가기</Link>
        </Card>
      ) : (
        <>
          {podium.length > 0 && (
            <section aria-label="상위 3명" className="mb-4 grid items-end gap-3 sm:grid-cols-3">
              {podium.map((r) => <Podium key={r.id} r={r} first={r.rank === 1} />)}
            </section>
          )}
          <Card className="overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] text-sm">
                <thead className="bg-muted/60 text-xs text-muted-foreground">
                  <tr className="text-right">
                    <th scope="col" className="w-20 px-4 py-3 text-left font-medium">순위</th>
                    <th scope="col" className="px-2 py-3 text-left font-medium">이용자</th>
                    <th scope="col" className="px-2 py-3 font-bold text-foreground">수익률</th>
                    <th scope="col" className="px-2 py-3 font-medium">손익</th>
                    <th scope="col" className="px-2 py-3 font-medium">거래 수</th>
                    <th scope="col" className="px-4 py-3 font-medium">승률</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className={cn("border-t hover:bg-muted/40", r.id === me?.id && "bg-brand-soft hover:bg-brand-soft")}>
                      <td className="px-4 py-3 font-bold">{r.rank}</td>
                      <td className="px-2 py-3">
                        <Link href={`/creators/${encodeURIComponent(r.nickname)}`} className="flex items-center gap-2.5 font-medium hover:text-brand">
                          <UserAvatar name={r.nickname} url={r.avatar} />
                          <span className="truncate">{r.nickname}</span>
                          {r.id === me?.id && <span className="rounded-full bg-brand-soft px-2 py-0.5 text-xs font-bold text-brand">나</span>}
                        </Link>
                      </td>
                      <td className={cn("px-2 py-3 text-right font-bold", tone(r.returnPct))}>{pct(r.returnPct)}</td>
                      <td className="px-2 py-3 text-right text-muted-foreground">{usd(r.pnl)}</td>
                      <td className="px-2 py-3 text-right text-muted-foreground">{r.trades}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <div className="h-1.5 w-14 overflow-hidden rounded-full bg-muted">
                            <div className="h-full bg-brand" style={{ width: `${Math.round(r.winRate ?? 0)}%` }} />
                          </div>
                          <span className="w-10 text-right">{r.winRate === null ? "-" : `${Math.round(r.winRate)}%`}</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
