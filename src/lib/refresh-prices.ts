import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchPrices } from "@/lib/trade";

/** 최신 시세를 DB 에 반영합니다. (비밀값은 서버만 알고 있어 클라이언트가 가격을 조작할 수 없음) */
let lastTick = 0;
export async function refreshPrices(sb: SupabaseClient) {
  const secret = process.env.TRADE_TICK_SECRET;
  if (!secret) return;
  // 직전 1.5초 안에 갱신했다면 건너뜁니다. 연속 요청마다 거래소 조회+DB 왕복을 반복하지 않도록.
  if (Date.now() - lastTick < 1500) return;
  lastTick = Date.now();
  const prices = await fetchPrices();
  if (prices) await sb.rpc("paper_tick", { p_secret: secret, p_prices: prices });
}
