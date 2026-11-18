/** One-shot handoff from the mock-trading chart to the planner's Plan tab (sessionStorage, read once). */
const KEY = "fintalk.planner.handoff";

export type PlanHandoff = { symbol: string; tf: string; images: string[]; price?: number };

export function setHandoff(h: PlanHandoff) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(h));
  } catch {
    /* storage blocked: the planner just opens without a prefill */
  }
}

/** Safe to call twice (React strict mode); call clearHandoff() once it has been used. */
export function clearHandoff() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

export function takeHandoff(): PlanHandoff | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const h = JSON.parse(raw) as PlanHandoff;
    return h && typeof h.symbol === "string" && Array.isArray(h.images) ? h : null;
  } catch {
    return null;
  }
}
