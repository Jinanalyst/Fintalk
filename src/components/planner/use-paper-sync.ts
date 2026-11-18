"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { useUser } from "@/components/layout/use-user";
import { paperToTrade, positionToTrade } from "@/lib/planner/paper";
import { planner } from "@/lib/planner/store";
import type { ClosedTrade } from "@/lib/trade";

/**
 * Keeps the planner in step with the user's mock-trading account: closed paper trades flow into the
 * Journal, Calendar and Analysis automatically (on load, every minute, and when the tab regains focus).
 */
export function usePaperSync() {
  const user = useUser();
  const uid = user?.id;
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured || !uid) return;
    const sb = createClient();
    let alive = true;
    const sync = async () => {
      const [closed, open] = await Promise.all([
        sb.from("paper_trades").select("*").order("closed_at", { ascending: false }).limit(1000),
        sb.from("paper_positions").select("*"),
      ]);
      if (!alive || closed.error || !closed.data) return;
      const trades = (closed.data as unknown as ClosedTrade[]).map((r) =>
        paperToTrade({ ...r, qty: Number(r.qty), entry_price: Number(r.entry_price), exit_price: Number(r.exit_price), margin: Number(r.margin), pnl: Number(r.pnl), fee: Number(r.fee), leverage: Number(r.leverage) }),
      );
      const positions = (open.data ?? []).map((r) =>
        positionToTrade({ id: String(r.id), symbol: String(r.symbol), side: r.side === "short" ? "short" : "long", qty: Number(r.qty), entry_price: Number(r.entry_price), leverage: Number(r.leverage), tp: r.tp == null ? null : Number(r.tp), sl: r.sl == null ? null : Number(r.sl), opened_at: String(r.opened_at) }),
      );
      planner.syncPaper([...positions, ...trades]);
      setCount(trades.length + positions.length);
    };
    sync();
    const timer = setInterval(sync, 60_000);
    const onFocus = () => sync();
    window.addEventListener("focus", onFocus);
    return () => {
      alive = false;
      clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [uid]);

  return { signedIn: !!uid, count, configured: isSupabaseConfigured };
}
