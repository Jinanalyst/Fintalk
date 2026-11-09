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
