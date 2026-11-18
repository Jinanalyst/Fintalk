import { localISO } from "./calc";
import type { Trade } from "./types";
import { START_BALANCE, REASON_LABEL, type ClosedTrade } from "@/lib/trade";

/** Paper trades don't store a planned stop, so 1R is assumed to be 1% of the starting balance. */
export const PAPER_R = START_BALANCE * 0.01;

/** Maps a closed mock-trading position to a planner trade. Same id in → same trade out, so syncing is idempotent. */
export function paperToTrade(p: ClosedTrade): Trade {
  const sym = p.symbol.replace(/USDT$/, "-USDT");
  const closed = localISO(new Date(p.closed_at));
  const opened = p.opened_at ? localISO(new Date(p.opened_at)) : closed;
  return {
    id: `paper-${p.id}`,
    source: "paper",
    sym,
    exch: "Mock",
    dir: p.side,
    tf: "—",
    entry: p.entry_price,
    stop: 0,
    tp: 0,
    acct: START_BALANCE,
    riskPct: 1,
    leverage: p.leverage,
    setup: "Paper trade",
    why: "",
    chart: "",
    status: "closed",
    createdAt: opened,
    openedAt: opened,
    closedAt: closed,
    actualEntry: p.entry_price,
    actualExit: p.exit_price,
    fees: p.fee,
    exitReason: REASON_LABEL[p.reason] ?? p.reason,
    pnl: p.pnl,
    r: p.pnl / PAPER_R,
  };
}

type PaperPosition = {
  id: string; symbol: string; side: "long" | "short"; qty: number; entry_price: number; leverage: number;
  tp: number | null; sl: number | null; opened_at: string;
};

/** A position that is still open in mock trading shows up as an open plan with live P&L. Close it in the terminal. */
export function positionToTrade(p: PaperPosition): Trade {
  const opened = localISO(new Date(p.opened_at));
  const riskAmt = p.sl ? Math.abs(p.entry_price - p.sl) * p.qty : 0;
  const rr = p.sl && p.tp && riskAmt > 0 ? (Math.abs(p.tp - p.entry_price) * p.qty) / riskAmt : undefined;
  return {
    id: `paper-pos-${p.id}`,
    source: "paper",
    sym: p.symbol.replace(/USDT$/, "-USDT"),
    exch: "Mock",
    dir: p.side,
    tf: "—",
    entry: p.entry_price,
    stop: p.sl ?? 0,
    tp: p.tp ?? 0,
    acct: START_BALANCE,
    riskPct: riskAmt > 0 ? (riskAmt / START_BALANCE) * 100 : 1,
    leverage: p.leverage,
    qty: p.qty,
    setup: "Paper trade",
    why: "",
    chart: "",
    status: "open",
    createdAt: opened,
    openedAt: opened,
    plannedRR: rr,
  };
}
