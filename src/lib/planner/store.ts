"use client";

import { useSyncExternalStore } from "react";
import { sampleTrades } from "./sample";
import type { Trade } from "./types";

type State = { trades: Trade[] };
const KEY = "chainlabs.planner.v1";

let state: State | null = null;
const listeners = new Set<() => void>();

function load(): State {
  if (state) return state;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as State;
      if (Array.isArray(p.trades)) return (state = { trades: p.trades });
    }
  } catch {}
  return (state = { trades: sampleTrades() });
}

function commit(next: State) {
  state = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {}
  listeners.forEach((l) => l());
}

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};

export const planner = {
  /** Replaces every paper-trading trade with the latest list. Real data replaces the sample data. */
  syncPaper: (paper: Trade[]) => {
    const cur = load();
    const old = cur.trades.filter((t) => t.source === "paper");
    const same = old.length === paper.length && old.every((t) => paper.some((p) => p.id === t.id && p.pnl === t.pnl));
    const hasSample = cur.trades.some((t) => t.source === "sample");
    if (same && !(paper.length > 0 && hasSample)) return;
    const rest = cur.trades.filter((t) => t.source !== "paper" && !(paper.length > 0 && t.source === "sample"));
    commit({ ...cur, trades: [...paper, ...rest] });
  },
  add: (t: Trade) => commit({ ...load(), trades: [t, ...load().trades] }),
  addMany: (ts: Trade[]) => commit({ ...load(), trades: [...ts, ...load().trades] }),
  update: (id: string, patch: Partial<Trade>) =>
    commit({ ...load(), trades: load().trades.map((t) => (t.id === id ? { ...t, ...patch } : t)) }),
  remove: (id: string) => commit({ ...load(), trades: load().trades.filter((t) => t.id !== id) }),
  clearSample: () => commit({ ...load(), trades: load().trades.filter((t) => t.source !== "sample") }),
  loadSample: () => commit({ ...load(), trades: [...load().trades.filter((t) => t.source !== "sample"), ...sampleTrades()] }),
};

/** null on the server and during hydration; the stored state afterwards. */
export function usePlanner() {
  return useSyncExternalStore<State | null>(subscribe, load, () => null);
}
