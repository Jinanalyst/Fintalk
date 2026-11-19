import { makeCache } from "@/lib/server-cache";
import { fetchPrices } from "@/lib/trade";

export const dynamic = "force-dynamic";

const cache = makeCache<Record<string, number>>();

/**
 * 전 종목 시세. 브라우저의 WebSocket 이 막혔을 때 클라이언트가 대신 폴링합니다.
 * 접속자가 아무리 많아도 거래소에는 1초에 한 번만 요청합니다.
 */
export async function GET() {
  try {
    const prices = await cache("all", 1_000, 30_000, async () => {
      const p = await fetchPrices();
      if (!p) throw new Error("unavailable");
      return p;
    });
    return Response.json(prices, { headers: { "Cache-Control": "public, s-maxage=1, stale-while-revalidate=3" } });
  } catch {
    return Response.json({ error: "price feed unavailable" }, { status: 502 });
  }
}
