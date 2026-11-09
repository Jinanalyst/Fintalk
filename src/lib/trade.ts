/** 모의투자 공용 상수·계산 (서버/클라이언트 공용). DB 함수(20261111_paper_trading.sql)와 값이 같아야 합니다. */

export const SYMBOLS = [
  { symbol: "BTCUSDT", label: "BTC", name: "비트코인" },
  { symbol: "ETHUSDT", label: "ETH", name: "이더리움" },
  { symbol: "SOLUSDT", label: "SOL", name: "솔라나" },
  { symbol: "XRPUSDT", label: "XRP", name: "리플" },
  { symbol: "BNBUSDT", label: "BNB", name: "바이낸스코인" },
  { symbol: "DOGEUSDT", label: "DOGE", name: "도지코인" },
] as const;

export type TradeSymbol = (typeof SYMBOLS)[number]["symbol"];
export const isSymbol = (s: string): s is TradeSymbol => SYMBOLS.some((x) => x.symbol === s);

export const FEE_RATE = 0.0004;
export const START_BALANCE = 10000;
export const MAX_LEVERAGE = 150;

export type Side = "long" | "short";

export type Position = {
  id: string;
  symbol: string;
  side: Side;
  qty: number;
  entry_price: number;
  leverage: number;
  margin: number;
  tp: number | null;
  sl: number | null;
  liq_price: number;
  opened_at: string;
};

export type Order = {
  id: string;
  symbol: string;
  side: Side;
  price: number;
  qty: number;
  leverage: number;
  margin: number;
  tp: number | null;
  sl: number | null;
  created_at: string;
};

/** 지정가 청산 주문 (reduce-only): 포지션의 일부 또는 전부를 지정한 가격에 청산 */
export type CloseOrder = {
  id: string;
  position_id: string;
  price: number;
  qty: number;
  created_at: string;
};

export type ClosedTrade = {
  id: string;
  symbol: string;
  side: Side;
  qty: number;
  entry_price: number;
  exit_price: number;
  leverage: number;
  margin: number;
  pnl: number;
  fee: number;
  reason: "manual" | "tp" | "sl" | "liquidation" | "limit";
  opened_at?: string | null;
  closed_at: string;
};

export const unrealizedPnl = (p: Pick<Position, "side" | "qty" | "entry_price">, mark: number) =>
  (mark - p.entry_price) * p.qty * (p.side === "long" ? 1 : -1);

export const REASON_LABEL: Record<ClosedTrade["reason"], string> = {
  manual: "직접 청산",
  tp: "익절",
  sl: "손절",
  liquidation: "강제청산",
  limit: "지정가 청산",
};

/** 가격 자릿수: 큰 값은 소수 2자리, 작은 값은 더 길게 */
export function fmtPrice(n: number) {
  const d = n >= 1000 ? 2 : n >= 10 ? 3 : n >= 1 ? 4 : 5;
  return n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
}

export const fmtUsd = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Binance 선물 전체 시세를 {SYMBOL: price} 로 가져옵니다. (서버 전용) 선물 API 가 막힌 지역이면 현물 공개 API 로 대체 */
export async function fetchPrices(): Promise<Record<string, number> | null> {
  const urls = ["https://fapi.binance.com/fapi/v1/ticker/price", "https://data-api.binance.vision/api/v3/ticker/price"];
  for (const url of urls) {
    try {
      const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(4000) });
      if (!res.ok) continue;
      const rows = (await res.json()) as { symbol: string; price: string }[];
      const out: Record<string, number> = {};
      for (const r of rows) if (isSymbol(r.symbol)) out[r.symbol] = Number(r.price);
      if (Object.keys(out).length === SYMBOLS.length) return out;
    } catch {
      /* 다음 주소 시도 */
    }
  }
  return null;
}

/** 예상 청산가 (DB 의 _paper_liq_price 와 같은 식: 유지증거금률 0.5%) */
export const liqPrice = (side: Side, entry: number, leverage: number) =>
  side === "long" ? entry * (1 - 1 / leverage + 0.005) : entry * (1 + 1 / leverage - 0.005);
