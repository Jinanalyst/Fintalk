export const dynamic = "force-dynamic";

const INTERVALS = new Set(["1m", "3m", "5m", "15m", "1h", "4h", "1d", "1w", "1M"]);
// 선물 API가 막힌 지역·네트워크에서도 차트가 나오도록 서버에서 대신 받아 오고, 실패하면 현물 시세 서버로 넘어갑니다.
const SOURCES = ["https://fapi.binance.com/fapi/v1/klines", "https://data-api.binance.vision/api/v3/klines"];

export async function GET(req: Request) {
  const u = new URL(req.url);
  const symbol = u.searchParams.get("symbol") ?? "";
  const interval = u.searchParams.get("interval") ?? "";
  const limit = Math.min(Math.max(Number(u.searchParams.get("limit")) || 1000, 1), 1500);
  const endTime = u.searchParams.get("endTime");
  if (!/^[A-Z0-9]{2,20}$/.test(symbol) || !INTERVALS.has(interval) || (endTime && !/^\d{1,15}$/.test(endTime))) {
    return Response.json({ error: "bad request" }, { status: 400 });
  }
  const qs = `symbol=${symbol}&interval=${interval}&limit=${limit}${endTime ? `&endTime=${endTime}` : ""}`;
  for (const base of SOURCES) {
    try {
      const res = await fetch(`${base}?${qs}`, { cache: "no-store", signal: AbortSignal.timeout(8000) });
      if (!res.ok) continue;
      const rows = await res.json();
      if (!Array.isArray(rows)) continue;
      return Response.json(rows.map((r: unknown[]) => r.slice(0, 6)), { headers: { "Cache-Control": "public, s-maxage=3, stale-while-revalidate=10" } });
    } catch {
      /* 다음 서버로 */
    }
  }
  return Response.json({ error: "klines unavailable" }, { status: 502 });
}
