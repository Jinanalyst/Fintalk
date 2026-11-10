/** 모의투자 성과 통계 (서버/클라이언트 공용 순수 계산). 거래 한 건 = paper_trades 한 행 (부분 청산도 각각 한 건). */
import { START_BALANCE, unrealizedPnl, type ClosedTrade, type Position, type Side } from "@/lib/trade";

type Reason = ClosedTrade["reason"];

export type SymbolStat = { symbol: string; count: number; wins: number; pnl: number };
export type SideStat = { count: number; wins: number; pnl: number };

export type TradeStats = {
  // 계좌
  equity: number; // 총자산 = 잔고 + 열린 포지션 증거금 + 미실현 손익
  returnPct: number; // 시작 자금(START_BALANCE) 대비 현재 계좌 수익률
  unrealized: number;
  openCount: number;
  // 거래
  count: number;
  wins: number;
  losses: number;
  winRate: number | null; // %
  realized: number; // 순손익 합계 (수수료 반영)
  fees: number;
  avgWin: number | null;
  avgLoss: number | null; // 음수
  payoff: number | null; // 평균 이익 / |평균 손실|
  profitFactor: number | null; // 총이익 / |총손실|
  best: ClosedTrade | null;
  worst: ClosedTrade | null;
  avgLeverage: number | null;
  // 분해
  bySide: Record<Side, SideStat>;
  byReason: Record<Reason, number>;
  bySymbol: SymbolStat[]; // 거래 많은 순
  // 최근 7일
  week: { count: number; pnl: number };
  // 누적 실현 손익 곡선 (시작 0 포함) 과 최대 낙폭
  curve: { t: number; v: number }[];
  mdd: number; // 시작 자금 + 누적 손익 기준 고점 대비 최대 낙폭 (%, 0 이하가 아닌 양수)
  mddAmount: number; // USDT
};

const WEEK_MS = 7 * 24 * 3600 * 1000;

export function computeStats(
  trades: ClosedTrade[],
  positions: Position[],
  prices: Record<string, number>,
  balance: number,
  now: number = Date.now(),
): TradeStats {
  const sorted = [...trades].sort((a, b) => new Date(a.closed_at).getTime() - new Date(b.closed_at).getTime());

  const unrealized = positions.reduce((a, p) => a + unrealizedPnl(p, prices[p.symbol] ?? p.entry_price), 0);
  const equity = balance + positions.reduce((a, p) => a + p.margin, 0) + unrealized;

  let wins = 0;
  let losses = 0;
  let grossWin = 0;
  let grossLoss = 0;
  let realized = 0;
  let fees = 0;
  let levSum = 0;
  let best: ClosedTrade | null = null;
  let worst: ClosedTrade | null = null;
  const bySide: Record<Side, SideStat> = { long: { count: 0, wins: 0, pnl: 0 }, short: { count: 0, wins: 0, pnl: 0 } };
  const byReason: Record<Reason, number> = { manual: 0, tp: 0, sl: 0, liquidation: 0, limit: 0 };
  const symMap = new Map<string, SymbolStat>();
  const week = { count: 0, pnl: 0 };

  const curve: { t: number; v: number }[] = [];
  let cum = 0;
  let peak = START_BALANCE;
  let mdd = 0;
  let mddAmount = 0;
  if (sorted.length) curve.push({ t: new Date(sorted[0].closed_at).getTime() - 1, v: 0 });

  for (const t of sorted) {
    const win = t.pnl > 0;
    if (win) {
      wins++;
      grossWin += t.pnl;
    } else if (t.pnl < 0) {
      losses++;
      grossLoss += t.pnl;
    }
    realized += t.pnl;
    fees += t.fee;
    levSum += t.leverage;
    if (!best || t.pnl > best.pnl) best = t;
    if (!worst || t.pnl < worst.pnl) worst = t;
    const s = bySide[t.side];
    s.count++;
    s.pnl += t.pnl;
    if (win) s.wins++;
    byReason[t.reason] = (byReason[t.reason] ?? 0) + 1;
    const y = symMap.get(t.symbol) ?? { symbol: t.symbol, count: 0, wins: 0, pnl: 0 };
    y.count++;
    y.pnl += t.pnl;
    if (win) y.wins++;
    symMap.set(t.symbol, y);
    const at = new Date(t.closed_at).getTime();
    if (now - at <= WEEK_MS) {
      week.count++;
      week.pnl += t.pnl;
    }

    cum += t.pnl;
    curve.push({ t: at, v: cum });
    const eq = START_BALANCE + cum;
    if (eq > peak) peak = eq;
    const dd = peak - eq;
    if (peak > 0 && (dd / peak) * 100 > mdd) {
      mdd = (dd / peak) * 100;
      mddAmount = dd;
    }
  }

  const count = sorted.length;
  const decided = wins + losses;
  const avgWin = wins ? grossWin / wins : null;
  const avgLoss = losses ? grossLoss / losses : null;

  return {
    equity,
    returnPct: ((equity - START_BALANCE) / START_BALANCE) * 100,
    unrealized,
    openCount: positions.length,
    count,
    wins,
    losses,
    winRate: decided ? (wins / decided) * 100 : null,
    realized,
    fees,
    avgWin,
    avgLoss,
    payoff: avgWin !== null && avgLoss !== null && avgLoss !== 0 ? avgWin / Math.abs(avgLoss) : null,
    profitFactor: grossLoss !== 0 ? grossWin / Math.abs(grossLoss) : null,
    best,
    worst,
    avgLeverage: count ? levSum / count : null,
    bySide,
    byReason,
    bySymbol: [...symMap.values()].sort((a, b) => b.count - a.count || b.pnl - a.pnl),
    week,
    curve,
    mdd,
    mddAmount,
  };
}

/** 미리보기(Supabase 미연결)용 샘플 거래. 결과가 항상 같도록 고정값을 사용합니다. */
export function sampleTrades(now: number = Date.now()): ClosedTrade[] {
  const day = 24 * 3600 * 1000;
  const rows: [string, Side, number, number, Reason, number][] = [
    // [종목, 방향, 레버리지, 손익, 사유, 며칠 전]
    ["BTCUSDT", "long", 10, 42.8, "tp", 13],
    ["ETHUSDT", "short", 20, -31.2, "sl", 12],
    ["BTCUSDT", "long", 10, 18.4, "manual", 11],
    ["SOLUSDT", "long", 25, -64.9, "sl", 10],
    ["BTCUSDT", "short", 10, 55.1, "tp", 9],
    ["DOGEUSDT", "long", 50, -120.5, "liquidation", 8],
    ["ETHUSDT", "long", 10, 27.6, "limit", 6],
    ["BTCUSDT", "long", 15, 73.3, "tp", 5],
    ["XRPUSDT", "short", 10, -12.7, "manual", 4],
    ["BTCUSDT", "long", 10, 36.0, "tp", 3],
    ["SOLUSDT", "short", 20, 48.2, "manual", 2],
    ["ETHUSDT", "long", 10, -22.4, "sl", 1],
  ];
  return rows.map(([symbol, side, leverage, pnl, reason, ago], i) => ({
    id: `sample-${i}`,
    symbol,
    side,
    qty: 1,
    entry_price: 100,
    exit_price: 100 + (side === "long" ? 1 : -1) * (pnl > 0 ? 1 : -1),
    leverage,
    margin: 100,
    pnl,
    fee: 1.5,
    reason,
    opened_at: new Date(now - ago * day - 3600 * 1000).toISOString(),
    closed_at: new Date(now - ago * day).toISOString(),
  }));
}
