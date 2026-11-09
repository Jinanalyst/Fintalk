import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { START_BALANCE, type ClosedTrade, type Order, type Position } from "@/lib/trade";

export type TradeData = {
  loggedIn: boolean;
  balance: number;
  positions: Position[];
  orders: Order[];
  trades: ClosedTrade[];
  prices: Record<string, number>;
};

const EMPTY: TradeData = { loggedIn: false, balance: START_BALANCE, positions: [], orders: [], trades: [], prices: {} };

// numeric 컬럼은 문자열로 올 수 있어 숫자로 변환합니다.
const n = (v: unknown) => (v === null || v === undefined ? null : Number(v));
const toPos = (r: Record<string, unknown>) =>
  ({ ...r, qty: n(r.qty), entry_price: n(r.entry_price), margin: n(r.margin), tp: n(r.tp), sl: n(r.sl), liq_price: n(r.liq_price) }) as unknown as Position;
const toOrder = (r: Record<string, unknown>) =>
  ({ ...r, price: n(r.price), qty: n(r.qty), margin: n(r.margin), tp: n(r.tp), sl: n(r.sl) }) as unknown as Order;
const toTrade = (r: Record<string, unknown>) =>
  ({ ...r, qty: n(r.qty), entry_price: n(r.entry_price), exit_price: n(r.exit_price), margin: n(r.margin), pnl: n(r.pnl), fee: n(r.fee) }) as unknown as ClosedTrade;

export async function getTradeData(): Promise<TradeData> {
  if (!isSupabaseConfigured) return EMPTY;
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  const prices: Record<string, number> = {};
  const { data: pr } = await sb.from("paper_prices").select("symbol,price");
  for (const r of pr ?? []) prices[r.symbol] = Number(r.price);
  if (!auth.user) return { ...EMPTY, prices };

  const [acc, pos, ord, trd] = await Promise.all([
    sb.from("paper_accounts").select("balance").eq("user_id", auth.user.id).maybeSingle(),
    sb.from("paper_positions").select("*").order("opened_at", { ascending: false }),
    sb.from("paper_orders").select("*").eq("status", "open").order("created_at", { ascending: false }),
    sb.from("paper_trades").select("*").order("closed_at", { ascending: false }).limit(50),
  ]);
  return {
    loggedIn: true,
    balance: acc.data ? Number(acc.data.balance) : START_BALANCE,
    positions: (pos.data ?? []).map(toPos),
    orders: (ord.data ?? []).map(toOrder),
    trades: (trd.data ?? []).map(toTrade),
    prices,
  };
}
