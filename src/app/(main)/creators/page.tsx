import type { Metadata } from "next";
import Link from "next/link";
import { Award, LayoutDashboard } from "lucide-react";
import { PageTitle, SampleBadge } from "@/components/common/bits";
import { FollowButton } from "@/components/feed/interactive";
import { CREATORS, fmtNum } from "@/lib/sample-data";

export const metadata: Metadata = {
  title: "크리에이터",
  description: "핀톡의 금융 분석 크리에이터 랭킹과 우수 콘텐츠를 확인하세요.",
};

export default function CreatorsPage() {
  const ranked = [...CREATORS].sort((a, b) => b.upvotes - a.upvotes);
  return (
    <div className="space-y-4">
      <PageTitle
        title="크리에이터"
        desc="추천 수 기준 작성자 랭킹입니다."
        right={
          <Link href="/creators/dashboard" className="inline-flex items-center gap-1.5 rounded-lg border bg-card px-3 py-2 text-sm font-medium hover:bg-muted">
            <LayoutDashboard className="size-4" /> 내 대시보드
          </Link>
        }
      />
      <SampleBadge label="샘플 작성자" />

      <div className="rounded-lg border border-dashed bg-card p-3 text-xs leading-relaxed text-muted-foreground">
        <b className="text-foreground">광고 수익 공유는 준비 중입니다.</b> 초기 버전에서는 실제 수익 지급 기능이 활성화되지 않으며, FinScore와 정산 기능은 광고 매출과 운영 정책이 확정된 이후 제공됩니다.
      </div>

      <ol className="space-y-2.5">
        {ranked.map((c, i) => (
          <li key={c.handle} className="flex items-center gap-3 rounded-xl border bg-card p-3 shadow-xs sm:p-4">
            <span className={`w-6 text-center text-lg font-extrabold ${i < 3 ? "text-brand" : "text-muted-foreground"}`}>{i + 1}</span>
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-brand-soft text-lg font-bold text-brand">{c.name.slice(0, 1)}</span>
            <Link href={`/creators/${c.handle}`} className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 truncate font-semibold hover:text-brand">
                {c.name}
                {c.featured && <span className="inline-flex items-center gap-0.5 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-400/15 dark:text-amber-300"><Award className="size-3" />우수</span>}
              </p>
              <p className="truncate text-xs text-muted-foreground">@{c.handle} · {c.focus}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">팔로워 {fmtNum(c.followers)} · 추천 {fmtNum(c.upvotes)} · 조회 {fmtNum(c.views)}</p>
            </Link>
            <FollowButton small />
          </li>
        ))}
      </ol>
    </div>
  );
}
