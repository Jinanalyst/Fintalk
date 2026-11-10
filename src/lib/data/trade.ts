import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { START_BALANCE, type ClosedTrade, type CloseOrder, type Order, type Position } from "@/lib/trade";

export type TradeData = {
  loggedIn: boolean;
  balance: number;
  positions: Position[];
  orders: Order[];
  closeOrders: CloseOrder[];
  trades: ClosedTrade[];
  prices: Record<string, number>;
};

const EMPTY: TradeData = { loggedIn: false, balance: START_BALANCE, positions: [], orders: [], closeOrders: [], trades: [], prices: {} };

// numeric 컬럼은 문자열로 올 수 있어 숫자로 변환합니다.
const n = (v: unknown) => (v === null || v === undefined ? null : Number(v));
const toPos = (r: Record<string, unknown>) =>
  ({ ...r, qty: n(r.qty), entry_price: n(r.entry_price), margin: n(r.margin), tp: n(r.tp), sl: n(r.sl), liq_price: n(r.liq_price) }) as unknown as Position;
const toOrder = (r: Record<string, unknown>) =>
  ({ ...r, price: n(r.price), qty: n(r.qty), margin: n(r.margin), tp: n(r.tp), sl: n(r.sl) }) as unknown as Order;
const toCloseOrder = (r: Record<string, unknown>) => ({ ...r, price: n(r.price), qty: n(r.qty) }) as unknown as CloseOrder;
const toTrade = (r: Record<string, unknown>) =>
  ({ ...r, qty: n(r.qty), entry_price: n(r.entry_price), exit_price: n(r.exit_price), margin: n(r.margin), pnl: n(r.pnl), fee: n(r.fee) }) as unknown as ClosedTrade;

/** 대시보드용: 로그인한 본인의 전체 거래(최대 1000건)·잔고·열린 포지션·시세. 로그인 전/미연결이면 null. */
export async function getTradeStats(): Promise<{ balance: number; positions: Position[]; trades: ClosedTrade[]; prices: Record<string, number> } | null> {
  if (!isSupabaseConfigured) return null;
  const sb = await createClient();
  const [{ data: auth }, { data: pr }] = await Promise.all([sb.auth.getClaims(), sb.from("paper_prices").select("symbol,price")]);
  const uid = auth?.claims?.sub;
  if (!uid) return null;
  const prices: Record<string, number> = {};
  for (const r of pr ?? []) prices[r.symbol] = Number(r.price);
  const [acc, pos, trd] = await Promise.all([
    sb.from("paper_accounts").select("balance").eq("user_id", uid).maybeSingle(),
    sb.from("paper_positions").select("*"),
    // 최근 1000건 (RLS 로 본인 것만)
    sb.from("paper_trades").select("*").order("closed_at", { ascending: false }).limit(1000),
  ]);
  return {
    balance: acc.data ? Number(acc.data.balance) : START_BALANCE,
    positions: (pos.data ?? []).map(toPos),
    trades: (trd.data ?? []).map(toTrade),
    prices,
  };
}

export async function getTradeData(): Promise<TradeData> {
  if (!isSupabaseConfigured) return EMPTY;
  const sb = await createClient();
  // 인증 확인과 시세 조회를 동시에 (getClaims: 서버 왕복 없는 로컬 JWT 검증, 데이터는 RLS 가 다시 보호)
  const [{ data: auth }, { data: pr }] = await Promise.all([sb.auth.getClaims(), sb.from("paper_prices").select("symbol,price")]);
  const prices: Record<string, number> = {};
  for (const r of pr ?? []) prices[r.symbol] = Number(r.price);
  const uid = auth?.claims?.sub;
  if (!uid) return { ...EMPTY, prices };

  const [acc, pos, ord, cls, trd] = await Promise.all([
    sb.from("paper_accounts").select("balance").eq("user_id", uid).maybeSingle(),
    sb.from("paper_positions").select("*").order("opened_at", { ascending: false }),
    sb.from("paper_orders").select("*").eq("status", "open").order("created_at", { ascending: false }),
    sb.from("paper_close_orders").select("*").eq("status", "open").order("created_at", { ascending: false }),
    sb.from("paper_trades").select("*").order("closed_at", { ascending: false }).limit(50),
  ]);
  return {
    loggedIn: true,
    balance: acc.data ? Number(acc.data.balance) : START_BALANCE,
    positions: (pos.data ?? []).map(toPos),
    orders: (ord.data ?? []).map(toOrder),
    closeOrders: (cls.data ?? []).map(toCloseOrder), // 마이그레이션 전이면 error 로 비어 있음
    trades: (trd.data ?? []).map(toTrade),
    prices,
  };
}

export type LeaderRow = {
  id: string; nickname: string; avatar: string | null; rank: number;
  trades: number; wins: number; losses: number; pnl: number;
  /** 시작 자금 대비 실현 수익률 (%) */
  returnPct: number;
  /** 승률 (%), 승·패가 없으면 null */
  winRate: number | null;
};

export type LeaderPeriod = "week" | "month" | "all";
const PERIOD_DAYS: Record<LeaderPeriod, number | null> = { week: 7, month: 30, all: null };

/** 모의투자 리더보드 (기간별 실현 손익 순). 미연결이거나 마이그레이션 전이면 빈 목록. */
export async function getLeaderboard(period: LeaderPeriod): Promise<LeaderRow[]> {
  if (!isSupabaseConfigured) return [];
  const sb = await createClient();
  const { data, error } = await sb.rpc("paper_leaderboard", { p_days: PERIOD_DAYS[period], p_min_trades: 3, p_limit: 100 });
  if (error || !data) {
    if (error) console.error("[paper_leaderboard]", error.message);
    return [];
  }
  return (data as Record<string, unknown>[]).map((r, i) => {
    const wins = Number(r.wins), losses = Number(r.losses), pnl = Number(r.pnl);
    return {
      id: String(r.id), nickname: String(r.nickname), avatar: (r.avatar_url as string | null) ?? null, rank: i + 1,
      trades: Number(r.trades), wins, losses, pnl,
      returnPct: (pnl / START_BALANCE) * 100,
      winRate: wins + losses ? (wins / (wins + losses)) * 100 : null,
    };
  });
}
