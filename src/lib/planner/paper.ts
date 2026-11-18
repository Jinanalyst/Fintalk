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
    exch: "Paper",
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
