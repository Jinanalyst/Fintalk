import type { Metadata } from "next";
import { PageTitle, SampleBadge } from "@/components/common/bits";
import { CHALLENGES } from "@/lib/sample-data";
import { ChallengeCard } from "./challenge-card";

export const metadata: Metadata = {
  title: "챌린지",
  description: "이번 주 시장은 오를까요, 내릴까요? 간단한 상승·하락 예측에 참여하고 결과를 확인하세요.",
};

export default function ChallengesPage() {
  const open = CHALLENGES.filter((c) => c.status === "open");
  const closed = CHALLENGES.filter((c) => c.status === "closed");
  return (
    <div className="space-y-6">
      <PageTitle title="시장 예측 챌린지" desc="상승·하락을 예측하고 다른 투자자의 생각과 비교해 보세요." right={<SampleBadge label="샘플 챌린지" />} />

      <div className="rounded-lg border bg-card p-3 text-xs leading-relaxed text-muted-foreground">
        챌린지는 <b>재미와 토론을 위한 기능</b>입니다. 현금·가상자산·환금 가능한 포인트는 지급되지 않으며, 기준 가격·기준 시각·종료 시각·판정 데이터 출처는 시작 전에 공개되고 종료 후 결과가 확정됩니다.
      </div>

      <section>
        <h2 className="mb-3 text-base font-bold">진행 중</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {open.map((c) => <ChallengeCard key={c.id} c={c} />)}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-base font-bold">이전 예측 결과</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {closed.map((c) => <ChallengeCard key={c.id} c={c} />)}
        </div>
      </section>
    </div>
  );
}
