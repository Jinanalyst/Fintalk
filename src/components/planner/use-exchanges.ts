"use client";

import { useCallback, useEffect, useState } from "react";
import { useUser } from "@/components/layout/use-user";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { syncExchanges, type Connection, type SyncResult } from "@/app/actions/connections";
import { localISO } from "@/lib/planner/calc";
import { planner } from "@/lib/planner/store";
import type { ClosedPosition } from "@/lib/planner/exchange-api";
import type { Trade } from "@/lib/planner/types";

function toTrade(exch: string, p: ClosedPosition): Trade {
  const closed = localISO(new Date(p.closedAt));
  const opened = p.openedAt ? localISO(new Date(p.openedAt)) : closed;
  return {
    id: `ex-${exch}-${p.id}`, source: "import", sym: p.sym, exch, dir: p.dir, tf: "—",
    entry: p.entry, stop: 0, tp: 0, acct: 0, riskPct: 0, leverage: p.leverage, qty: p.qty,
    setup: "Unplanned", why: "", chart: "", status: "closed",
    createdAt: opened, openedAt: opened, closedAt: closed,
    actualEntry: p.entry || undefined, actualExit: p.exit || undefined, fees: p.fee,
    exitReason: "Synced", pnl: p.pnl, r: null,
  };
}

/** Applies a server sync to the local journal and returns the connection list. */
export function applySync(res: SyncResult): Connection[] | null {
  if (!res.ok) return res.connections ?? null;
  for (const [exch, list] of Object.entries(res.positions)) planner.syncExchange(exch, list.map((p) => toTrade(exch, p)));
  return res.connections;
}

/** Connected exchanges for a signed-in user. Closed trades are pulled in on load, every 5 minutes, and on focus. */
export function useExchanges() {
  const user = useUser();
  const uid = user?.id;
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    const res = await syncExchanges().catch(() => null);
    if (!res) return;
    const next = applySync(res);
    if (next) setConnections(next);
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured || !uid) return;
    let last = 0;
    const run = () => {
      last = Date.now();
      void refresh();
    };
    run();
    const timer = setInterval(run, 300_000);
    const onFocus = () => Date.now() - last > 300_000 && run();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [uid, refresh]);

  return { connections, setConnections, refresh, loaded, signedIn: !!uid, configured: isSupabaseConfigured };
}
