"use client";

import { useSyncExternalStore } from "react";
import { sampleTrades } from "./sample";
import { SETUPS, type Trade } from "./types";

type State = { trades: Trade[]; setups?: string[] };
const KEY = "chainlabs.planner.v1";

let state: State | null = null;
const listeners = new Set<() => void>();

function load(): State {
  if (state) return state;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as State;
      if (Array.isArray(p.trades)) return (state = { trades: p.trades, setups: Array.isArray(p.setups) ? p.setups : undefined });
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
  /**
   * Replaces every mock-trading trade (closed and open) with the latest list. For a signed-in user the
   * mock-trading account is the default data source, so the sample data is removed even if they have no trades yet.
   */
  syncPaper: (paper: Trade[]) => {
    const cur = load();
    const old = cur.trades.filter((t) => t.source === "paper");
    const key = (a: Trade[]) => JSON.stringify([...a].sort((x, y) => (x.id < y.id ? -1 : 1)));
    const hasSample = cur.trades.some((t) => t.source === "sample");
    if (!hasSample && key(old) === key(paper)) return;
    commit({ ...cur, trades: [...paper, ...cur.trades.filter((t) => t.source !== "paper" && t.source !== "sample")] });
  },
  /** Replaces the trades synced from one connected exchange (ids start with "ex-<exchange>-"). Idempotent. */
  syncExchange: (exch: string, trades: Trade[]) => {
    const cur = load();
    const prefix = `ex-${exch}-`;
    const old = cur.trades.filter((t) => t.id.startsWith(prefix));
    const key = (a: Trade[]) => JSON.stringify([...a].sort((x, y) => (x.id < y.id ? -1 : 1)));
    if (key(old) === key(trades)) return;
    commit({ ...cur, trades: [...trades, ...cur.trades.filter((t) => !t.id.startsWith(prefix))] });
  },
  add: (t: Trade) => commit({ ...load(), trades: [t, ...load().trades] }),
  addMany: (ts: Trade[]) => commit({ ...load(), trades: [...ts, ...load().trades] }),
  update: (id: string, patch: Partial<Trade>) =>
    commit({ ...load(), trades: load().trades.map((t) => (t.id === id ? { ...t, ...patch } : t)) }),
  remove: (id: string) => commit({ ...load(), trades: load().trades.filter((t) => t.id !== id) }),
  clearSample: () => commit({ ...load(), trades: load().trades.filter((t) => t.source !== "sample") }),
  /** Setup labels the user can add, rename and remove. Renaming also relabels their existing trades. */
  addSetup: (name: string) => {
    const n = name.trim().slice(0, 24);
    const cur = load();
    const list = setupList(cur);
    if (!n || list.some((x) => x.toLowerCase() === n.toLowerCase())) return false;
    commit({ ...cur, setups: [...list, n] });
    return true;
  },
  renameSetup: (from: string, to: string) => {
    const n = to.trim().slice(0, 24);
    const cur = load();
    const list = setupList(cur);
    if (!n || n === from || list.some((x) => x !== from && x.toLowerCase() === n.toLowerCase())) return false;
    commit({ trades: cur.trades.map((t) => (t.setup === from ? { ...t, setup: n } : t)), setups: list.map((x) => (x === from ? n : x)) });
    return true;
  },
  removeSetup: (name: string) => {
    const cur = load();
    const list = setupList(cur).filter((x) => x !== name);
    if (list.length) commit({ ...cur, setups: list });
  },
  loadSample: () => commit({ ...load(), trades: [...load().trades.filter((t) => t.source !== "sample"), ...sampleTrades()] }),
};

/** null on the server and during hydration; the stored state afterwards. */
export function usePlanner() {
  return useSyncExternalStore<State | null>(subscribe, load, () => null);
}

/** The user's setup labels (defaults until they edit them). */
export function setupList(s: State | null): string[] {
  return s?.setups?.length ? s.setups : [...SETUPS];
}
