"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { useUser } from "@/components/layout/use-user";
import { paperToTrade } from "@/lib/planner/paper";
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
      const { data, error } = await sb.from("paper_trades").select("*").order("closed_at", { ascending: false }).limit(1000);
      if (!alive || error || !data) return;
      const trades = (data as unknown as ClosedTrade[]).map((r) =>
        paperToTrade({ ...r, qty: Number(r.qty), entry_price: Number(r.entry_price), exit_price: Number(r.exit_price), margin: Number(r.margin), pnl: Number(r.pnl), fee: Number(r.fee), leverage: Number(r.leverage) }),
      );
      planner.syncPaper(trades);
      setCount(trades.length);
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
