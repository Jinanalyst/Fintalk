import type { Metadata } from "next";
import { Eye, Lock, ThumbsUp, Users, FileText } from "lucide-react";
import { Card, PageTitle, SampleBadge, SectionHeader } from "@/components/common/bits";
import { Sparkline } from "@/components/market/charts";
import { POSTS, fmtNum, getCreator } from "@/lib/sample-data";

export const metadata: Metadata = {
  title: "리워드",
  description: "양질의 분석 콘텐츠가 만든 가치를 확인하세요.",
};

const weekly = [12, 18, 15, 24, 31, 28, 40, 38, 52, 47, 61, 70];

export default function RewardsPage() {
  const me = getCreator("chart_haeun")!;
  const mine = POSTS.filter((p) => p.author === me.handle);
  const kpis = [
    { l: "총 조회수", v: fmtNum(me.views), d: "+8.2%", i: Eye },
    { l: "받은 추천", v: fmtNum(me.upvotes), d: "+5.4%", i: ThumbsUp },
    { l: "팔로워", v: fmtNum(me.followers), d: `+${me.weeklyGain}`, i: Users },
    { l: "게시글", v: String(me.posts), d: "+6", i: FileText },
  ];
  return (
    <div className="space-y-5">
      <PageTitle title="리워드" desc="내 분석이 만든 가치를 확인합니다." right={<SampleBadge label="샘플 통계" />} />

      <Card>
        <SectionHeader title="리워드는 이렇게 쌓입니다" />
        <ol className="mt-2 grid gap-2 text-sm sm:grid-cols-3">
          {[
            ["1. 분석 공유", "국내 주식·미국 주식·암호화폐에 대한 근거 있는 분석과 생각을 작성합니다."],
            ["2. 인정받기", "다른 투자자의 추천, 댓글, 조회로 콘텐츠의 가치가 확인됩니다."],
            ["3. 가치 창출", "우수 콘텐츠는 인사이트에 노출되고, 광고 수익 공유 정책이 확정되면 보상으로 연결됩니다."],
          ].map(([t, d]) => (
            <li key={t} className="rounded-lg bg-muted/60 p-3"><p className="font-semibold">{t}</p><p className="mt-1 text-xs text-muted-foreground">{d}</p></li>
          ))}
        </ol>
      </Card>

      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        {kpis.map((k) => (
          <Card key={k.l} className="p-3">
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><k.i className="size-3.5" />{k.l}</p>
            <p className="mt-1 text-xl font-extrabold tabular-nums">{k.v}</p>
            <p className="text-xs font-medium text-up">{k.d} <span className="font-normal text-muted-foreground">지난주 대비</span></p>
          </Card>
        ))}
      </div>

      <Card>
        <SectionHeader title="주간 조회수 추이 (최근 12주)" />
        <Sparkline values={weekly} up className="mt-3 h-28 w-full" />
      </Card>

      <Card>
        <SectionHeader title="내 게시글 성과" />
        <ul className="mt-2 divide-y">
          {mine.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
              <span className="line-clamp-1 flex-1 font-medium">{p.title}</span>
              <span className="shrink-0 text-xs text-muted-foreground">👁 {p.views.toLocaleString("ko-KR")} · 👍 {p.upvotes} · 💬 {p.comments}</span>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="border-dashed">
        <SectionHeader title={<span className="inline-flex items-center gap-1.5"><Lock className="size-4" />수익화 (개발 예정)</span>} />
        <p className="mt-2 text-sm text-muted-foreground">
          FinScore, 광고 수익 공유, 예상 수익, 정산 내역, 정산 계좌 등록, 수익 지급 신청은 광고 매출과 운영 정책이 확정된 이후 제공됩니다. 현재 버전에서는 어떠한 수익도 지급되지 않습니다.
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {["FinScore", "예상 수익", "정산 내역", "정산 계좌 등록", "수익 지급 신청"].map((t) => (
            <div key={t} className="flex items-center justify-between rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
              {t}<span className="rounded bg-card px-1.5 py-0.5 text-[10px]">준비 중</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
