/**
 * Feature flags. Sections that are switched off here are only hidden from menus, the home page and
 * cross-links — their pages and data stay in place and can be turned back on at any time.
 *
 * Override without a code change: NEXT_PUBLIC_FEATURES="insights,planner"   (comma-separated, turns those on)
 *                                 NEXT_PUBLIC_FEATURES="-community"          (a leading "-" turns one off)
 */
const DEFAULTS = {
  /** Insights menu + "Recommended insights" on home */
  insights: false,
  /** Creators menu, popular authors, follow feed */
  creators: false,
  /** Trading Planner menu */
  planner: false,
  /** Rewards / contribution ranking menu and "My contribution" card */
  rewards: false,
  /** The old all-time paper trading leaderboard (/trade/leaderboard) in menus */
  paperLeaderboard: false,
  /** Old community home (Q&A, feed tabs, sidebar cards) — replaced by the contest landing */
  communityHome: false,
  /** Old multi-round contest list (/contests) and the OKX UID entry form (/contest) */
  legacyContests: false,
  /** Order book on /trade */
  orderBook: true,
  /** Symbol info strip and TradingView switch on /trade (also shows the order book) */
  advancedTrade: false,
} as const;

export type Feature = keyof typeof DEFAULTS;

function parse(raw: string | undefined): Partial<Record<Feature, boolean>> {
  const out: Partial<Record<Feature, boolean>> = {};
  for (const part of (raw ?? "").split(",").map((s) => s.trim()).filter(Boolean)) {
    const off = part.startsWith("-");
    const key = (off ? part.slice(1) : part) as Feature;
    if (key in DEFAULTS) out[key] = !off;
  }
  return out;
}

export const FEATURES: Record<Feature, boolean> = { ...DEFAULTS, ...parse(process.env.NEXT_PUBLIC_FEATURES) };

export const isOn = (f: Feature) => FEATURES[f];
