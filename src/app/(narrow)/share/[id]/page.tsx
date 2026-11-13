import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card } from "@/components/common/bits";
import { ShareActions } from "@/components/trade/share-actions";
import { getShare } from "@/lib/data/share";
import { fmtUsd } from "@/lib/trade";

export async function generateMetadata({ params }: PageProps<"/share/[id]">): Promise<Metadata> {
  const { id } = await params;
  const s = await getShare(id);
  if (!s) return {};
  const coin = s.symbol.replace("USDT", "");
  const title = `${s.nickname}님의 ${coin} ${s.side === "long" ? "롱" : "숏"} ${s.leverage}x ${s.roe >= 0 ? "+" : ""}${s.roe.toFixed(2)}% (모의투자)`;
  const description = `핀톡 모의투자 · ${s.closed ? "종료" : "진행 중"} · 손익 ${s.pnl >= 0 ? "+" : ""}${fmtUsd(s.pnl)} USDT. 가상 자금 기록이며 실제 수익이 아닙니다.`;
  return { title, description, alternates: { canonical: `/share/${id}` }, openGraph: { title, description, type: "article", images: [{ url: `/api/share/${s.id}`, width: 1200, height: 630 }] }, twitter: { card: "summary_large_image", title, description, images: [`/api/share/${s.id}`] } };
}

export default async function SharePage({ params }: PageProps<"/share/[id]">) {
  const { id } = await params;
  const s = await getShare(id);
  if (!s) notFound();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">모의투자 포지션 카드</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          <Link href={`/creators/${encodeURIComponent(s.nickname)}`} className="font-semibold text-foreground hover:text-brand">
            {s.nickname}
          </Link>
          님이 공유한 기록입니다. 가상 자금으로 거래한 결과이며 실제 수익이 아닙니다.
        </p>
      </div>

      {/* 카드는 SNS 미리보기와 같은 이미지를 그대로 보여 줍니다 */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/api/share/${s.id}`} alt={`${s.symbol} ${s.side} ${s.roe.toFixed(2)}%`} width={1200} height={630} className="w-full rounded-2xl border shadow-sm" />

      <ShareActions id={s.id} nickname={s.nickname} postId={s.postId} demo={s.id === "demo"} />

      <Card className="p-4 text-xs leading-relaxed text-muted-foreground">
        <p>
          <b className="text-foreground">수익률(ROE)</b>은 이 포지션의 증거금 대비 손익이며, 계좌 전체 수익률과는 다른 지표입니다. 진행 중 포지션은 공유 시점의 미실현 손익이고, 종료된 포지션은 수수료를 반영한 확정 손익입니다. 모든 수치는 서버에 저장된 거래 기록에서 자동 계산되며 수정할 수 없습니다.
        </p>
      </Card>
    </div>
  );
}
