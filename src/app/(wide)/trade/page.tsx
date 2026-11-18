import type { Metadata } from "next";
import { PageTitle } from "@/components/common/bits";
import { LiveRefresh } from "@/components/common/live-refresh";
import { TradeTerminal } from "@/components/trade/terminal";
import { getTradeData } from "@/lib/data/trade";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export const metadata: Metadata = {
  title: "Paper Trading",
  description: "Practice crypto futures trading with 10,000 USDT of virtual funds. No real money is used.",
  alternates: { canonical: "/trade" },
};

export const dynamic = "force-dynamic";

export default async function TradePage() {
  const data = await getTradeData();
  return (
    <div>
      <PageTitle
        title="Futures Paper Trading"
        desc="Practice long/short, leverage, take profit and stop loss with 10,000 USDT of virtual funds."
        right={<LiveRefresh seconds={20} />}
      />
      {!isSupabaseConfigured && (
        <p className="mb-3 rounded-lg border border-dashed p-3 text-sm text-muted-foreground">Supabase is not connected, so only prices and charts are available. Orders work once it is connected.</p>
      )}
      <TradeTerminal data={data} />
    </div>
  );
}
