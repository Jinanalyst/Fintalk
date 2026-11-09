import { createClient } from "@supabase/supabase-js";
import { SUPABASE_KEY, SUPABASE_URL, isSupabaseConfigured } from "@/lib/supabase/env";
import { fetchPrices } from "@/lib/trade";

export const dynamic = "force-dynamic";

/**
 * 시세 갱신 + 지정가 체결 + 익절/손절/강제청산 점검.
 * 외부 크론(예: Vercel Cron, cron-job.org)이 1분마다 호출합니다.
 *   curl -H "Authorization: Bearer $TRADE_TICK_SECRET" https://사이트/api/trade/tick
 */
export async function GET(req: Request) {
  const secret = process.env.TRADE_TICK_SECRET;
  if (!isSupabaseConfigured || !secret) return Response.json({ error: "not configured" }, { status: 503 });
  if (req.headers.get("authorization") !== `Bearer ${secret}`) return Response.json({ error: "unauthorized" }, { status: 401 });

  const prices = await fetchPrices();
  if (!prices) return Response.json({ error: "price feed unavailable" }, { status: 502 });

  const sb = createClient(SUPABASE_URL!, SUPABASE_KEY!, { auth: { persistSession: false } });
  const { error } = await sb.rpc("paper_tick", { p_secret: secret, p_prices: prices });
  if (error) {
    console.error("[trade] tick failed:", error.message);
    return Response.json({ error: "tick failed" }, { status: 500 });
  }
  return Response.json({ ok: true, at: new Date().toISOString() });
}
