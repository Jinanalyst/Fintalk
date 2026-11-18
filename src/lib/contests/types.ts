export type ContestStatus = "upcoming" | "live" | "ended";

export type Contest = {
  id: string;
  number: number;
  name: string;
  startsAt: string; // ISO (UTC)
  endsAt: string; // ISO (UTC)
  prizes: [number, number, number]; // USDT for 1st / 2nd / 3rd
  startingBalance: number;
  minTrades: number;
  mddLimit: number; // % — strictly above this = disqualified
  /** When on, the leaderboard stops updating for the final 24 hours. */
  freezeLast24h: boolean;
};

/** One leaderboard line. Deliberately holds NO positions or trade history (anti copy-trading). */
export type LeaderboardRow = {
  userId: string;
  nickname: string;
  rank: number | null; // null for disqualified entries
  returnPct: number;
  mddPct: number;
  trades: number;
  qualified: boolean; // met the minimum closed-trade requirement
  disqualified: boolean;
  dqReason?: string;
};

export type Leaderboard = {
  rows: LeaderboardRow[];
  /** Time of the snapshot these rows come from (UTC ISO). Null before the first snapshot. */
  asOf: string | null;
  frozen: boolean;
};

export type ContestSummary = Contest & {
  status: ContestStatus;
  participants: number;
  prizeTotal: number;
  isSample: boolean;
  leader: { nickname: string; returnPct: number } | null;
};

/** What is sent to the browser: no user ids. */
export type PublicRow = Omit<LeaderboardRow, "userId">;
