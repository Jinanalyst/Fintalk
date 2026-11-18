/**
 * ⚠️ 샘플 데이터 (SAMPLE DATA)
 * Phase 1 디자인 검증용 가짜 데이터입니다. 실제 이용자와 게시글이 아닙니다.
 * Phase 2~3에서 Supabase / 외부 API 로 교체됩니다.
 */

// ───────── 카테고리 ─────────
export type Category = { slug: string; label: string };

export const BOARD_CATEGORIES: Category[] = [
  { slug: "all", label: "All" },
  { slug: "kr-stock", label: "Korean stocks" },
  { slug: "us-stock", label: "US stocks" },
  { slug: "crypto", label: "Crypto" },
  { slug: "macro", label: "Macro" },
  { slug: "trading", label: "Trading" },
  { slug: "beginner", label: "Beginner" },
  { slug: "free", label: "Free discussion" },
];

/** 기존 게시글이 쓰는 이전 카테고리 (새 글 작성에는 사용하지 않음) */
const LEGACY_CATEGORIES: Record<string, string> = { strategy: "Strategy", qna: "Q&A" };

export const boardLabel = (slug: string) =>
  BOARD_CATEGORIES.find((c) => c.slug === slug)?.label ?? LEGACY_CATEGORIES[slug] ?? slug;

// 카테고리와 게시글 유형은 서로 독립적입니다. (예: 암호화폐 카테고리의 질문 / 분석 / 매매 복기)
export type PostType = "general" | "question" | "discussion" | "analysis" | "strategy" | "review" | "resource";

export const POST_TYPES: { slug: PostType; label: string; insight: boolean; hint: string }[] = [
  { slug: "general", label: "General post", insight: false, hint: "Talk about anything." },
  { slug: "question", label: "Question", insight: false, hint: "Ask what you are curious about. You can accept the most helpful answer." },
  { slug: "discussion", label: "Discussion", insight: false, hint: "Debate topics where opinions differ." },
  { slug: "analysis", label: "Market analysis", insight: true, hint: "Analyze markets, tickers and macro with evidence." },
  { slug: "strategy", label: "Investing / trading strategy", insight: true, hint: "Share your own investing principles and trading strategy." },
  { slug: "review", label: "Trade review", insight: true, hint: "Look back on real trades and note what you learned." },
  { slug: "resource", label: "Resources", insight: true, hint: "Share study material and useful summaries." },
];

export const INSIGHT_TYPES = POST_TYPES.filter((t) => t.insight).map((t) => t.slug);
export const COMMUNITY_TYPES = POST_TYPES.filter((t) => !t.insight).map((t) => t.slug);
export const postTypeLabel = (t: PostType) => POST_TYPES.find((x) => x.slug === t)?.label ?? t;
export const isPostType = (v: unknown): v is PostType => POST_TYPES.some((t) => t.slug === v);

// ───────── 종목 태그 ─────────
// 시세 없이 이름·시장 구분만 가진 종목 목록입니다. (게시글 태그, 관심 종목, 검색에 사용)
export type Market = "kr" | "us" | "crypto";

export const MARKET_LABELS: Record<Market, string> = { kr: "Korean stocks", us: "US stocks", crypto: "Crypto" };

export type Ticker = { symbol: string; name: string; market: Market };

export const TICKERS: Ticker[] = [
  { symbol: "005930", name: "Samsung Electronics", market: "kr" },
  { symbol: "000660", name: "SK Hynix", market: "kr" },
  { symbol: "035420", name: "NAVER", market: "kr" },
  { symbol: "373220", name: "LG Energy Solution", market: "kr" },
  { symbol: "KOSPI", name: "KOSPI", market: "kr" },
  { symbol: "KOSDAQ", name: "KOSDAQ", market: "kr" },
  { symbol: "NVDA", name: "NVIDIA", market: "us" },
  { symbol: "AAPL", name: "Apple", market: "us" },
  { symbol: "TSLA", name: "Tesla", market: "us" },
  { symbol: "MSFT", name: "Microsoft", market: "us" },
  { symbol: "BTC", name: "Bitcoin", market: "crypto" },
  { symbol: "ETH", name: "Ethereum", market: "crypto" },
  { symbol: "XRP", name: "XRP", market: "crypto" },
  { symbol: "SOL", name: "Solana", market: "crypto" },
  { symbol: "DOGE", name: "Dogecoin", market: "crypto" },
];

export const getTicker = (symbol: string) => TICKERS.find((t) => t.symbol.toLowerCase() === symbol.toLowerCase());
export const tickerName = (symbol: string) => getTicker(symbol)?.name ?? symbol;

// ───────── 작성자(크리에이터) ─────────
export type Creator = {
  handle: string;
  name: string;
  bio: string;
  followers: number;
  posts: number;
  upvotes: number;
  views: number;
  focus: string;
  featured?: boolean;
  weeklyGain: number; // followers gained this week (sample)
};

export const CREATORS: Creator[] = [
  { handle: "macro_minsu", name: "Macro Minsu", bio: "Summarizes macro trends around rates, FX and liquidity.", followers: 12840, posts: 214, upvotes: 18230, views: 982000, focus: "Macro", featured: true, weeklyGain: 320 },
  { handle: "chart_haeun", name: "Chart Reader Haeun", bio: "Daily/weekly technical analysis and scenarios.", followers: 9420, posts: 388, upvotes: 14110, views: 764000, focus: "Technical analysis", featured: true, weeklyGain: 255 },
  { handle: "coin_dori", name: "Coin Dori", bio: "Tracks on-chain metrics and the Bitcoin cycle.", followers: 8730, posts: 176, upvotes: 11980, views: 611000, focus: "Crypto", weeklyGain: 410 },
  { handle: "us_stock_jin", name: "US Stock Jin", bio: "Earnings-season summaries of big US tech stocks.", followers: 7215, posts: 142, upvotes: 9870, views: 502000, focus: "Global stocks", weeklyGain: 140 },
  { handle: "value_sora", name: "Value Investor Sora", bio: "How to read financial statements and long-term investing notes.", followers: 5980, posts: 98, upvotes: 8420, views: 331000, focus: "Value investing", weeklyGain: 98 },
  { handle: "bond_kim", name: "Bond Kim", bio: "Explains treasury yields and credit spreads simply.", followers: 3340, posts: 67, upvotes: 4210, views: 190000, focus: "Bonds & rates", weeklyGain: 61 },
];

export const getCreator = (handle: string) => CREATORS.find((c) => c.handle === handle);
export const creatorName = (handle: string) => getCreator(handle)?.name ?? handle;

// ───────── 게시글 ─────────
export type Post = {
  id: string;
  title: string;
  body: string[];
  category: string;
  author: string;
  createdAt: string;
  upvotes: number;
  downvotes: number;
  comments: number;
  views: number;
  tickers: string[];
  /** 게시글 유형 (카테고리와 독립) */
  type: PostType;
  /** 질문 글에서 채택된 답변 id */
  acceptedCommentId?: string | null;
  /** 협찬·이해관계 표시 */
  sponsored?: boolean;
  draft?: boolean;
  /** 예약 발행: 공개 예정 시각 (ISO). 이미 공개된 글은 없음 */
  scheduledFor?: string | null;
  hasChart?: boolean;
  pinned?: boolean;
  /** 정렬용 숫자 (낮을수록 최근) */
  ageMin: number;
  // ── Supabase 연동 시에만 채워지는 필드 ──
  live?: boolean;
  authorId?: string;
  authorAvatar?: string | null;
  images?: string[];
  /** 목록 카드 썸네일 (대표 지정 이미지 → 본문 첫 이미지) */
  thumbnail?: string | null;
  myVote?: 0 | 1 | -1;
  saved?: boolean;
  rawBody?: string;
};

type RawPost = Omit<Post, "type">;
const RAW_POSTS: RawPost[] = [
  { id: "p1", title: "Foreign investors net buying for a third day: how far can the chip cycle go?", body: ["Foreign flows have gone into large-cap chip stocks for 3 sessions in a row. Here is what stands out compared with past cycles.", "1) Signs of a rebound in memory prices\n2) Better foreign flows as FX stabilizes\n3) Earnings-season expectations", "Since this is a short-term surge, I think scaling in is sensible. What do you think?"], category: "kr-stock", author: "chart_haeun", createdAt: "35m ago", upvotes: 248, downvotes: 12, comments: 64, views: 5120, tickers: ["005930", "000660"], hasChart: true, ageMin: 35 },
  { id: "p2", title: "Bitcoin cycle analysis: average post-halving rally duration", body: ["A table comparing the average time from halving to the peak in past cycles.", "This cycle has a new variable in ETF inflows, so a simple comparison is risky, but I think it is still a useful reference.", "*Investment decisions are your own responsibility.*"], category: "crypto", author: "coin_dori", createdAt: "1h ago", upvotes: 312, downvotes: 28, comments: 97, views: 7840, tickers: ["BTC"], hasChart: true, ageMin: 60 },
  { id: "p3", title: "[Macro] Fed remarks and USD/KRW: 5 checkpoints this week", body: ["Items on this week's calendar that could move the market.", "- US CPI release\n- 3 Fed speeches\n- Treasury auctions\n- Korea trade data\n- Major tech earnings", "I will continue with scenarios for each item in the comments."], category: "macro", author: "macro_minsu", createdAt: "2h ago", upvotes: 421, downvotes: 9, comments: 112, views: 12300, tickers: ["USDKRW", "SPX"], pinned: true, ageMin: 120 },
  { id: "p4", title: "NVIDIA earnings preview: market expectations vs. guidance", body: ["Consensus expectations for revenue and the data center segment.", "What matters is likely the next-quarter guidance and comments on supply bottlenecks rather than the numbers."], category: "us-stock", author: "us_stock_jin", createdAt: "3h ago", upvotes: 187, downvotes: 15, comments: 43, views: 4310, tickers: ["NVDA"], ageMin: 180 },
  { id: "p5", title: "Beginner question: does a low P/E always mean undervalued?", body: ["I started studying stocks a month ago. I was going to buy low P/E stocks, but more experienced investors told me to be careful. I wonder why."], category: "qna", author: "value_sora", createdAt: "4h ago", upvotes: 96, downvotes: 2, comments: 38, views: 2980, tickers: [], ageMin: 240 },
  { id: "p6", title: "Is an altcoin rotation coming? Checking Solana and Ethereum relative strength", body: ["I checked whether money is moving into altcoins while BTC dominance stalls.", "There is no conclusive signal yet; I am watching whether volume follows."], category: "crypto", author: "coin_dori", createdAt: "5h ago", upvotes: 143, downvotes: 31, comments: 52, views: 3870, tickers: ["SOL", "ETH"], hasChart: true, ageMin: 300 },
  { id: "p7", title: "How falling oil prices affect inflation expectations", body: ["I looked at the correlation between oil and expected inflation using the last 2 years of data.", "Lower energy prices help headline inflation, but the core inflation path should be viewed separately."], category: "macro", author: "bond_kim", createdAt: "6h ago", upvotes: 78, downvotes: 4, comments: 21, views: 1920, tickers: ["WTI"], ageMin: 360 },
  { id: "p8", title: "A salaried worker's monthly investing strategy: a 1-year review", body: ["Sharing a 1-year record of buying ETFs on the same day each month. My conclusion: consistency mattered more than returns.", "I also wrote down lessons learned and tips for managing emotions."], category: "strategy", author: "value_sora", createdAt: "8h ago", upvotes: 205, downvotes: 6, comments: 71, views: 6540, tickers: [], ageMin: 480 },
  { id: "p9", title: "How was the market today? Chat freely", body: ["How did the market feel today? Leave a quick comment :)"], category: "free", author: "macro_minsu", createdAt: "9h ago", upvotes: 54, downvotes: 1, comments: 88, views: 2210, tickers: [], ageMin: 540 },
  { id: "p10", title: "What the Tesla options market says: reading implied volatility", body: ["A summary of how implied volatility builds up before announcement events."], category: "us-stock", author: "us_stock_jin", createdAt: "11h ago", upvotes: 64, downvotes: 8, comments: 19, views: 1530, tickers: ["TSLA"], ageMin: 660 },
  { id: "p11", title: "Battery stocks bounce: a bottom or a dead-cat bounce?", body: ["A personal view based on volume and flows. Opposing views welcome."], category: "kr-stock", author: "chart_haeun", createdAt: "13h ago", upvotes: 119, downvotes: 22, comments: 57, views: 3340, tickers: ["373220"], hasChart: true, ageMin: 780 },
  { id: "p12", title: "Understanding the link between treasury yields and stock valuations", body: ["Why do growth stocks struggle when rates rise? Explained with the discount rate."], category: "strategy", author: "bond_kim", createdAt: "1d ago", upvotes: 167, downvotes: 3, comments: 29, views: 4020, tickers: [], ageMin: 1440 },
];

/** 샘플 게시글: 이전 카테고리를 새 구조(카테고리 + 유형)로 변환 */
export const POSTS: Post[] = RAW_POSTS.map((p) => {
  const type: PostType =
    p.category === "qna" ? "question" : p.category === "strategy" ? "strategy" : p.category === "free" ? "discussion" : p.category === "macro" || p.hasChart ? "analysis" : "general";
  const category = p.category === "strategy" ? "trading" : p.category === "qna" ? "beginner" : p.category;
  return { ...p, type, category };
});

export const getPost = (id: string) => POSTS.find((p) => p.id === id);

/** 인기 점수 (Phase 4에서 서버 알고리즘으로 대체 예정) — 추천·댓글·시간 감쇠 반영 */
export const hotScore = (p: Post) =>
  (p.upvotes - p.downvotes + p.comments * 1.5) / Math.pow(p.ageMin / 60 + 2, 0.8);

export type SortKey = "hot" | "new" | "comments";
export function sortPosts(list: Post[], sort: SortKey) {
  const arr = [...list];
  if (sort === "new") return arr.sort((a, b) => a.ageMin - b.ageMin);
  if (sort === "comments") return arr.sort((a, b) => b.comments - a.comments);
  return arr.sort((a, b) => hotScore(b) - hotScore(a));
}

// ───────── 댓글 ─────────
export type Comment = {
  id: string;
  author: string;
  body: string;
  createdAt: string;
  upvotes?: number;
  mine?: boolean;
  authorAvatar?: string | null;
  /** 질문 작성자가 채택한 답변 */
  accepted?: boolean;
  replies?: Comment[];
};

export const SAMPLE_COMMENTS: Comment[] = [
  { id: "c1", author: "coin_dori", body: "Thanks for the summary. I think FX is the bigger variable.", createdAt: "20m ago", upvotes: 24, replies: [
    { id: "c1-1", author: "chart_haeun", body: "Agreed. Flow data is still positive though.", createdAt: "15m ago", upvotes: 9 },
    { id: "c1-2", author: "value_sora", body: "I feel more comfortable scaling in gradually.", createdAt: "10m ago", upvotes: 5 },
  ] },
  { id: "c2", author: "us_stock_jin", body: "It would help to look at the US earnings calendar too.", createdAt: "18m ago", upvotes: 12 },
  { id: "c3", author: "bond_kim", body: "I think it is better to wait until the rate path is clear.", createdAt: "9m ago", upvotes: 7, replies: [
    { id: "c3-1", author: "macro_minsu", body: "I will post an update after CPI!", createdAt: "4m ago", upvotes: 3 },
  ] },
];

// ───────── 광고 ─────────
export const AD_SLOTS = [
  { id: "home-top", label: "Home page top banner" },
  { id: "insights-inline", label: "Insights list (inline)" },
  { id: "feed-inline", label: "Community feed (inline)" },
  { id: "post-detail", label: "Post detail page" },
  { id: "sidebar", label: "Desktop right sidebar" },
] as const;

// ───────── 기타 ─────────

export const TRENDING_TICKERS = ["005930", "NVDA", "BTC", "000660", "TSLA", "SOL"];

export const ANNOUNCEMENTS = [
  { id: "a1", title: "FinTalk design preview (Phase 1) is live", date: "2026-11-05" },
  { id: "a2", title: "Community rules and investment disclaimer", date: "2026-11-05" },
];

export const REPORTS = [
  { id: "r1", target: "Post · “This stock will definitely go up, buy now”", reason: "False or exaggerated investment claims", reporter: "user_0412", status: "Pending" },
  { id: "r2", target: "Comment · “…(contains abuse)”", reason: "Abuse / harassment", reporter: "user_8831", status: "Pending" },
  { id: "r3", target: "Post · “Telegram signal group promo”", reason: "Spam / ads", reporter: "user_1190", status: "Resolved" },
];

export const ADMIN_USERS = [
  { id: "u1", nickname: "chart_haeun", email: "ha***@example.com", joined: "2026-08-12", role: "User", status: "Active" },
  { id: "u2", nickname: "coin_dori", email: "do***@example.com", joined: "2026-08-30", role: "User", status: "Active" },
  { id: "u3", nickname: "spam_bot_77", email: "sp***@example.com", joined: "2026-11-03", role: "User", status: "Restricted" },
  { id: "u4", nickname: "fintalk_admin", email: "ad***@example.com", joined: "2026-07-01", role: "Admin", status: "Active" },
];

export const fmtNum = (n: number) =>
  n >= 1000 ? `${(n / 1000).toFixed(n >= 100000 ? 0 : 1)}K` : n.toLocaleString("en-US");

/** 크리에이터 관심 분야 (프로필에서 최대 5개 선택) */
export const INTEREST_OPTIONS = ["Korean stocks", "US stocks", "Crypto", "Macro", "Technical analysis", "Value investing", "Quant", "ETF", "Day trading", "Beginner"];
