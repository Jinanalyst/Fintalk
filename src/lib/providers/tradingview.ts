import type { ProviderMeta } from "./types";

/**
 * TradingView 공식 임베드 위젯 (국내/미국 주식·지수·환율·원자재·암호화폐 차트와 시세).
 * - 위젯은 TradingView 가 직접 데이터를 제공하므로 우리 서버는 시세를 가져오거나 저장하지 않습니다.
 * - 위젯 하단의 TradingView 출처 링크(copyright)를 제거하거나 가리면 안 됩니다. (components/market/tv-widget.tsx 에서 항상 렌더링)
 * - 상업적 이용 조건: https://www.tradingview.com/widget-docs/ 및 이용약관을 배포 전에 확인하세요.
 */
export const tradingview: ProviderMeta = {
  id: "tradingview",
  name: "TradingView",
  kind: "widget",
  termsUrl: "https://www.tradingview.com/widget-docs/",
  attribution: "차트·시세: TradingView",
  rateLimit: { max: Infinity, windowMs: 1000 },
  ttlMs: 0,
};

/** 사이트 심볼 → TradingView 심볼 */
const TV: Record<string, string> = {
  KOSPI: "KRX:KOSPI",
  KOSDAQ: "KRX:KOSDAQ",
  SPX: "SP:SPX",
  NDX: "NASDAQ:NDX",
  USDKRW: "FX_IDC:USDKRW",
  JPYKRW: "FX_IDC:JPYKRW",
  EURKRW: "FX_IDC:EURKRW",
  WTI: "TVC:USOIL",
  GOLD: "TVC:GOLD",
  SILVER: "TVC:SILVER",
  AAPL: "NASDAQ:AAPL",
  MSFT: "NASDAQ:MSFT",
  NVDA: "NASDAQ:NVDA",
  TSLA: "NASDAQ:TSLA",
};

export function tvSymbol(a: { symbol: string; market: string }): string | null {
  if (TV[a.symbol]) return TV[a.symbol];
  if (a.market === "kr") return `KRX:${a.symbol}`;
  if (a.market === "crypto") return `UPBIT:${a.symbol}KRW`;
  return null;
}
