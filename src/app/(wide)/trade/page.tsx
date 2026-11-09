import type { Metadata } from "next";
import { PageTitle } from "@/components/common/bits";
import { LiveRefresh } from "@/components/common/live-refresh";
import { TradeTerminal } from "@/components/trade/terminal";
import { getTradeData } from "@/lib/data/trade";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export const metadata: Metadata = {
  title: "모의투자",
  description: "10,000 USDT 가상 자금으로 암호화폐 선물 거래를 연습해 보세요. 실제 자금은 사용되지 않습니다.",
};

export const dynamic = "force-dynamic";

export default async function TradePage() {
  const data = await getTradeData();
  return (
    <div>
      <PageTitle
        title="선물 모의투자"
        desc="10,000 USDT 가상 자금으로 롱·숏, 레버리지, 익절·손절을 연습해 보세요."
        right={<LiveRefresh seconds={20} />}
      />
      {!isSupabaseConfigured && (
        <p className="mb-3 rounded-lg border border-dashed p-3 text-sm text-muted-foreground">Supabase 가 연결되지 않아 시세와 차트만 볼 수 있습니다. 주문은 연결 후 가능합니다.</p>
      )}
      <TradeTerminal data={data} />
    </div>
  );
}
