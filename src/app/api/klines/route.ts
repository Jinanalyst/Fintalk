import { makeCache } from "@/lib/server-cache";

export const dynamic = "force-dynamic";

const cache = makeCache<Row[]>();

const INTERVALS = new Set(["1m", "3m", "5m", "15m", "1h", "4h", "1d", "1w", "1M"]);
const BYBIT_ITV: Record<string, string> = { "1m": "1", "3m": "3", "5m": "5", "15m": "15", "1h": "60", "4h": "240", "1d": "D", "1w": "W", "1M": "M" };
const OKX_BAR: Record<string, string> = { "1m": "1m", "3m": "3m", "5m": "5m", "15m": "15m", "1h": "1H", "4h": "4H", "1d": "1Dutc", "1w": "1Wutc", "1M": "1Mutc" };

type Row = [number, string, string, string, string, string]; // [시작 ms, 시, 고, 저, 종, 거래량] — Binance 와 같은 모양, 오래된 봉부터
type Q = { symbol: string; interval: string; limit: number; endTime: number | null };

const get = async (url: string) => {
  const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(String(res.status));
  return res.json();
};

async function binance(base: string, q: Q): Promise<Row[]> {
  const rows = await get(`${base}?symbol=${q.symbol}&interval=${q.interval}&limit=${q.limit}${q.endTime ? `&endTime=${q.endTime}` : ""}`);
  return (rows as unknown[][]).map((r) => r.slice(0, 6) as Row);
}

async function bybit(q: Q): Promise<Row[]> {
  const j = await get(`https://api.bybit.com/v5/market/kline?category=linear&symbol=${q.symbol}&interval=${BYBIT_ITV[q.interval]}&limit=${Math.min(q.limit, 1000)}${q.endTime ? `&end=${q.endTime}` : ""}`);
  const list = j?.result?.list as string[][] | undefined;
  if (!list?.length) throw new Error("empty");
  return list.map((r) => [Number(r[0]), r[1], r[2], r[3], r[4], r[5]] as Row).reverse(); // 최신순 → 오래된 순
}

// OKX 는 한 번에 100봉까지라 몇 번 나눠 받습니다(최대 600봉, 더 과거는 스크롤하면 이어서 받음).
async function okx(q: Q): Promise<Row[]> {
  const base = q.symbol.replace(/USDT$/, "");
  const inst = `${base}-USDT-SWAP`;
  const out: Row[] = [];
  let after = q.endTime ? String(q.endTime + 1) : "";
  for (let page = 0; page < Math.min(Math.ceil(q.limit / 100), 6); page++) {
    const j = await get(`https://www.okx.com/api/v5/market/history-candles?instId=${inst}&bar=${OKX_BAR[q.interval]}&limit=100${after ? `&after=${after}` : ""}`);
    const list = j?.data as string[][] | undefined;
    if (!list?.length) break;
    for (const r of list) out.push([Number(r[0]), r[1], r[2], r[3], r[4], r[6] ?? r[5]]);
    after = list[list.length - 1][0];
    if (list.length < 100) break;
  }
  if (!out.length) throw new Error("empty");
  return out.reverse();
}

// 위에서부터 차례로 시도합니다: 선물 → 현물 → Bybit → OKX. 지역·네트워크 차단에 대비한 대체 경로입니다.
const SOURCES: ((q: Q) => Promise<Row[]>)[] = [
  (q) => binance("https://fapi.binance.com/fapi/v1/klines", q),
  (q) => binance("https://data-api.binance.vision/api/v3/klines", q),
  bybit,
  okx,
];

export async function GET(req: Request) {
  const u = new URL(req.url);
  const symbol = u.searchParams.get("symbol") ?? "";
  const interval = u.searchParams.get("interval") ?? "";
  const limit = Math.min(Math.max(Number(u.searchParams.get("limit")) || 1000, 1), 1500);
  const end = u.searchParams.get("endTime");
  if (!/^[A-Z0-9]{2,20}$/.test(symbol) || !INTERVALS.has(interval) || (end && !/^\d{1,15}$/.test(end))) {
    return Response.json({ error: "bad request" }, { status: 400 });
  }
  const q: Q = { symbol, interval, limit, endTime: end ? Number(end) : null };
  // 최신 봉은 2초, 지난 구간(endTime 지정)은 바뀌지 않으니 10분 보관. 거래소가 모두 실패하면 최대 10분 전 데이터라도 보여 줍니다.
  const ttl = q.endTime ? 600_000 : 2_000;
  try {
    const rows = await cache(`${symbol}|${interval}|${limit}|${q.endTime ?? ""}`, ttl, 600_000, async () => {
      for (const src of SOURCES) {
        try {
          const rows = await src(q);
          if (rows.length) return rows;
        } catch {
          /* 다음 서버로 */
        }
      }
      throw new Error("klines unavailable");
    });
    return Response.json(rows, { headers: { "Cache-Control": "public, s-maxage=2, stale-while-revalidate=10" } });
  } catch {
    return Response.json({ error: "klines unavailable" }, { status: 502 });
  }
}
