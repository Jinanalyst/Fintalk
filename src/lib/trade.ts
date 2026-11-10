/** 모의투자 공용 상수·계산 (서버/클라이언트 공용). DB 함수(20261111_paper_trading.sql)와 값이 같아야 합니다. */

export const SYMBOLS = [
  { symbol: "BTCUSDT", label: "BTC", name: "비트코인" },
  { symbol: "ETHUSDT", label: "ETH", name: "이더리움" },
  { symbol: "SOLUSDT", label: "SOL", name: "솔라나" },
  { symbol: "XRPUSDT", label: "XRP", name: "리플" },
  { symbol: "BNBUSDT", label: "BNB", name: "바이낸스코인" },
  { symbol: "DOGEUSDT", label: "DOGE", name: "도지코인" },
] as const;

export type TradeSymbol = string;

/** 거래 가능한 종목: 바이낸스 USDT-M 무기한 선물(예: BTCUSDT, 1000PEPEUSDT). 만기물(BTCUSDT_250627)은 제외합니다. */
const SYMBOL_RE = /^[A-Z0-9]{1,20}USDT$/;
export const isSymbol = (s: string): boolean => SYMBOL_RE.test(s);

/** 표시용 이름: 목록에 있으면 짧은 이름, 아니면 USDT 를 뗀 코드 (예: ADAUSDT → ADA) */
export const symbolLabel = (s: string) => SYMBOLS.find((x) => x.symbol === s)?.label ?? s.replace(/USDT$/, "");

export const FEE_RATE = 0.0004;
export const START_BALANCE = 10000;
export const MAX_LEVERAGE = 150;

export type Side = "long" | "short";

/** 마진 모드: 격리(포지션별 증거금만 위험) / 교차(잔고 전체가 담보) */
export type MarginMode = "isolated" | "cross";
export const MARGIN_MODE_LABEL: Record<MarginMode, string> = { isolated: "격리", cross: "교차" };

export type Position = {
  id: string;
  symbol: string;
  side: Side;
  qty: number;
  entry_price: number;
  leverage: number;
  margin_mode: MarginMode;
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
  margin_mode: MarginMode;
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

/** 가격 자릿수: 큰 값은 소수 2자리, 작은 값(밈코인 등)은 유효숫자가 보이도록 더 길게 */
export function pricePrecision(n: number) {
  return n >= 1000 ? 2 : n >= 10 ? 3 : n >= 1 ? 4 : n >= 0.1 ? 5 : n >= 0.01 ? 6 : n >= 0.001 ? 7 : 8;
}

export function fmtPrice(n: number) {
  const d = pricePrecision(n);
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
      for (const r of rows) {
        const p = Number(r.price);
        if (isSymbol(r.symbol) && p > 0) out[r.symbol] = p;
      }
      if (out.BTCUSDT && Object.keys(out).length >= SYMBOLS.length) return out;
    } catch {
      /* 다음 주소 시도 */
    }
  }
  return null;
}

/** 유지증거금률 (DB 와 같은 값) */
export const MAINT_RATE = 0.005;

/** 격리 예상 청산가 (DB 의 _paper_liq_price 와 같은 식: 유지증거금률 0.5%) */
export const liqPrice = (side: Side, entry: number, leverage: number) =>
  side === "long" ? entry * (1 - 1 / leverage + MAINT_RATE) : entry * (1 + 1 / leverage - MAINT_RATE);

/**
 * 교차 예상 청산가 (DB 의 _paper_refresh_cross_liq 와 같은 식).
 * 담보 = 잔고 + Σ(증거금 + 미실현 손익),  유지증거금 = Σ(명목가치 × 0.5%).
 * 다른 교차 포지션의 가격은 현재 시세 그대로라고 가정하고, 새 주문(규모 sizeUsdt, 레버리지 lev, 진입가 entry)을 더했을 때의 청산가를 구합니다.
 * 롱이 0 이하가 되면 청산되지 않는 것이므로 null.
 */
export function crossLiqPrice(opts: {
  side: Side;
  entry: number;
  sizeUsdt: number;
  leverage: number;
  balance: number;
  /** 이미 열려 있는 교차 포지션 */
  positions: Pick<Position, "symbol" | "side" | "qty" | "entry_price" | "margin">[];
  prices: Record<string, number>;
  fee?: number;
}): number | null {
  const { side, entry, sizeUsdt, leverage, balance, positions, prices } = opts;
  if (!(entry > 0 && sizeUsdt > 0 && leverage >= 1)) return null;
  const q = sizeUsdt / entry;
  const newMargin = sizeUsdt / leverage;
  // 새 주문의 증거금·수수료는 잔고에서 빠지고 증거금은 담보로 다시 들어갑니다.
  let w = balance - newMargin - (opts.fee ?? sizeUsdt * FEE_RATE) + newMargin;
  for (const p of positions) {
    const m = prices[p.symbol] ?? p.entry_price;
    w += p.margin + unrealizedPnl(p, m) - p.qty * m * MAINT_RATE;
  }
  const x = side === "long" ? (entry * q - w) / (q * (1 - MAINT_RATE)) : (w + entry * q) / (q * (1 + MAINT_RATE));
  return x > 0 ? x : null;
}
