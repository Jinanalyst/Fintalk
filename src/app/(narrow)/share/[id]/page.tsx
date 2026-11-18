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
  const title = `${s.nickname}'s ${coin} ${s.side === "long" ? "Long" : "Short"} ${s.leverage}x ${s.roe >= 0 ? "+" : ""}${s.roe.toFixed(2)}% (paper trading)`;
  const description = `Chainlabs paper trading · ${s.closed ? "Closed" : "Open"} · PnL ${s.pnl >= 0 ? "+" : ""}${fmtUsd(s.pnl)} USDT. Virtual funds only; not real profit.`;
  return { title, description, alternates: { canonical: `/share/${id}` }, openGraph: { title, description, type: "article", images: [{ url: `/api/share/${s.id}`, width: 1200, height: 630 }] }, twitter: { card: "summary_large_image", title, description, images: [`/api/share/${s.id}`] } };
}

export default async function SharePage({ params }: PageProps<"/share/[id]">) {
  const { id } = await params;
  const s = await getShare(id);
  if (!s) notFound();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Paper trading position card</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          <Link href={`/creators/${encodeURIComponent(s.nickname)}`} className="font-semibold text-foreground hover:text-brand">
            {s.nickname}
          </Link>
          shared this record. It is the result of trading with virtual funds and is not real profit.
        </p>
      </div>

      {/* 카드는 SNS 미리보기와 같은 이미지를 그대로 보여 줍니다 */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/api/share/${s.id}`} alt={`${s.symbol} ${s.side} ${s.roe.toFixed(2)}%`} width={1200} height={630} className="w-full rounded-2xl border shadow-sm" />

      <ShareActions id={s.id} nickname={s.nickname} postId={s.postId} demo={s.id === "demo"} />

      <Card className="p-4 text-xs leading-relaxed text-muted-foreground">
        <p>
          <b className="text-foreground">Return (ROE)</b>is the profit or loss relative to this position&apos;s margin and differs from the whole-account return. For open positions it is the unrealized PnL at the time of sharing; for closed positions it is the final PnL after fees. All figures are calculated automatically from trade records stored on the server and cannot be edited.
        </p>
      </Card>
    </div>
  );
}
