export type Dir = "long" | "short";
export type Status = "planned" | "open" | "closed" | "cancelled";
export type Source = "plan" | "import" | "sample" | "paper";

export const SETUPS = ["Breakout", "Pullback", "Range", "Trend", "News"] as const;
export const EMOTIONS = ["Calm", "FOMO", "Fear", "Revenge", "Greedy"] as const;
/** Venues you can import a CSV from (mock trading syncs by itself). */
export const IMPORT_EXCHANGES = ["OKX", "Binance", "Bybit", "Bitget", "Other"] as const;
export const TIMEFRAMES = ["15m", "1h", "4h", "1D"] as const;
export const EXIT_REASONS = ["Target hit", "Stop hit", "Manual — early", "Time exit"] as const;
export const ADHERENCE_CHECKS = [
  "Entered at the planned price",
  "Respected the stop loss",
  "Used the planned position size",
  "Took profit per plan",
] as const;

/** Timestamps are naive local strings: "YYYY-MM-DDTHH:mm:ss". */
export type Trade = {
  id: string;
  source: Source;
  sym: string;
  exch: string;
  dir: Dir;
  tf: string;
  entry: number;
  stop: number;
  tp: number;
  acct: number;
  riskPct: number;
  leverage?: number;
  qty?: number;
  /** Chart screenshots (IndexedDB ids): at planning time and at close. */
  images?: string[];
  exitImages?: string[];
  setup: string;
  why: string;
  chart: string;
  status: Status;
  createdAt: string;
  openedAt?: string;
  closedAt?: string;
  plannedRR?: number;
  actualEntry?: number;
  actualExit?: number;
  fees?: number;
  exitReason?: string;
  emotion?: string;
  checks?: boolean[];
  lesson?: string;
  pnl?: number;
  r?: number | null;
};

export type PlanTier = "free" | "pro";
