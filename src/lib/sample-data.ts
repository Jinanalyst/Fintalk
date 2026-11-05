/**
 * ⚠️ 샘플 데이터 (SAMPLE DATA)
 * Phase 1 디자인 검증용 가짜 데이터입니다. 실제 이용자와 게시글이 아닙니다.
 * Phase 2~3에서 Supabase / 외부 API 로 교체됩니다.
 */

// ───────── 카테고리 ─────────
export type Category = { slug: string; label: string };

export const BOARD_CATEGORIES: Category[] = [
  { slug: "all", label: "전체" },
  { slug: "kr-stock", label: "국내 주식" },
  { slug: "us-stock", label: "미국 주식" },
  { slug: "crypto", label: "암호화폐" },
  { slug: "macro", label: "거시경제" },
  { slug: "trading", label: "트레이딩" },
  { slug: "beginner", label: "투자 입문" },
  { slug: "free", label: "자유 토론" },
];

/** 기존 게시글이 쓰는 이전 카테고리 (새 글 작성에는 사용하지 않음) */
const LEGACY_CATEGORIES: Record<string, string> = { strategy: "투자 전략", qna: "질문 및 답변" };

export const boardLabel = (slug: string) =>
  BOARD_CATEGORIES.find((c) => c.slug === slug)?.label ?? LEGACY_CATEGORIES[slug] ?? slug;

// 카테고리와 게시글 유형은 서로 독립적입니다. (예: 암호화폐 카테고리의 질문 / 분석 / 매매 복기)
export type PostType = "general" | "question" | "discussion" | "analysis" | "strategy" | "review" | "resource";

export const POST_TYPES: { slug: PostType; label: string; insight: boolean; hint: string }[] = [
  { slug: "general", label: "일반 게시글", insight: false, hint: "자유롭게 이야기를 나눠요." },
  { slug: "question", label: "질문", insight: false, hint: "궁금한 점을 물어보세요. 도움이 된 답변을 채택할 수 있어요." },
  { slug: "discussion", label: "토론", insight: false, hint: "의견이 갈리는 주제를 함께 토론해요." },
  { slug: "analysis", label: "시장 분석", insight: true, hint: "시장·종목·거시경제를 근거와 함께 분석해요." },
  { slug: "strategy", label: "투자·트레이딩 전략", insight: true, hint: "나만의 투자 원칙과 매매 전략을 공유해요." },
  { slug: "review", label: "매매 복기", insight: true, hint: "실제 매매를 돌아보고 배운 점을 남겨요." },
  { slug: "resource", label: "자료 공유", insight: true, hint: "학습 자료와 유용한 정리를 공유해요." },
];

export const INSIGHT_TYPES = POST_TYPES.filter((t) => t.insight).map((t) => t.slug);
export const COMMUNITY_TYPES = POST_TYPES.filter((t) => !t.insight).map((t) => t.slug);
export const postTypeLabel = (t: PostType) => POST_TYPES.find((x) => x.slug === t)?.label ?? t;
export const isPostType = (v: unknown): v is PostType => POST_TYPES.some((t) => t.slug === v);

// ───────── 종목 태그 ─────────
// 시세 없이 이름·시장 구분만 가진 종목 목록입니다. (게시글 태그, 관심 종목, 검색에 사용)
export type Market = "kr" | "us" | "crypto";

export const MARKET_LABELS: Record<Market, string> = { kr: "국내 주식", us: "미국 주식", crypto: "암호화폐" };

export type Ticker = { symbol: string; name: string; market: Market };

export const TICKERS: Ticker[] = [
  { symbol: "005930", name: "삼성전자", market: "kr" },
  { symbol: "000660", name: "SK하이닉스", market: "kr" },
  { symbol: "035420", name: "NAVER", market: "kr" },
  { symbol: "373220", name: "LG에너지솔루션", market: "kr" },
  { symbol: "KOSPI", name: "코스피", market: "kr" },
  { symbol: "KOSDAQ", name: "코스닥", market: "kr" },
  { symbol: "NVDA", name: "엔비디아", market: "us" },
  { symbol: "AAPL", name: "애플", market: "us" },
  { symbol: "TSLA", name: "테슬라", market: "us" },
  { symbol: "MSFT", name: "마이크로소프트", market: "us" },
  { symbol: "BTC", name: "비트코인", market: "crypto" },
  { symbol: "ETH", name: "이더리움", market: "crypto" },
  { symbol: "XRP", name: "리플", market: "crypto" },
  { symbol: "SOL", name: "솔라나", market: "crypto" },
  { symbol: "DOGE", name: "도지코인", market: "crypto" },
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
  weeklyGain: number; // 이번 주 팔로워 증가 (샘플)
};

export const CREATORS: Creator[] = [
  { handle: "macro_minsu", name: "거시경제 민수", bio: "금리·환율·유동성 중심으로 매크로 흐름을 정리합니다.", followers: 12840, posts: 214, upvotes: 18230, views: 982000, focus: "거시경제", featured: true, weeklyGain: 320 },
  { handle: "chart_haeun", name: "차트읽는 하은", bio: "일봉·주봉 기준 기술적 분석과 시나리오 공유.", followers: 9420, posts: 388, upvotes: 14110, views: 764000, focus: "기술적 분석", featured: true, weeklyGain: 255 },
  { handle: "coin_dori", name: "코인도리", bio: "온체인 지표와 비트코인 사이클을 기록합니다.", followers: 8730, posts: 176, upvotes: 11980, views: 611000, focus: "암호화폐", weeklyGain: 410 },
  { handle: "us_stock_jin", name: "미장러 진", bio: "미국 대형 기술주 실적 시즌 요약 전문.", followers: 7215, posts: 142, upvotes: 9870, views: 502000, focus: "해외 주식", weeklyGain: 140 },
  { handle: "value_sora", name: "가치투자 소라", bio: "재무제표 읽는 법과 장기 투자 노트.", followers: 5980, posts: 98, upvotes: 8420, views: 331000, focus: "가치투자", weeklyGain: 98 },
  { handle: "bond_kim", name: "채권쟁이 김", bio: "국채 금리와 크레딧 스프레드를 쉽게 풀어드려요.", followers: 3340, posts: 67, upvotes: 4210, views: 190000, focus: "채권·금리", weeklyGain: 61 },
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
  hasChart?: boolean;
  pinned?: boolean;
  /** 정렬용 숫자 (낮을수록 최근) */
  ageMin: number;
  // ── Supabase 연동 시에만 채워지는 필드 ──
  live?: boolean;
  authorId?: string;
  authorAvatar?: string | null;
  images?: string[];
  myVote?: 0 | 1 | -1;
  saved?: boolean;
  rawBody?: string;
};

type RawPost = Omit<Post, "type">;
const RAW_POSTS: RawPost[] = [
  { id: "p1", title: "외국인 순매수 3일째, 반도체 사이클 어디까지 갈까?", body: ["외국인 수급이 3거래일 연속 반도체 대형주로 들어오고 있습니다. 과거 사이클과 비교했을 때 이번 구간의 특징을 정리해봤어요.", "1) 메모리 가격 반등 신호\n2) 환율 안정에 따른 외국인 수급 개선\n3) 실적 시즌 기대감", "다만 단기 급등 구간이기 때문에 분할 접근이 유효하다고 생각합니다. 여러분은 어떻게 보시나요?"], category: "kr-stock", author: "chart_haeun", createdAt: "35분 전", upvotes: 248, downvotes: 12, comments: 64, views: 5120, tickers: ["005930", "000660"], hasChart: true, ageMin: 35 },
  { id: "p2", title: "비트코인 사이클 분석: 반감기 이후 평균 상승 기간 비교", body: ["반감기 이후 과거 사이클의 고점까지 평균 소요 기간을 비교한 표입니다.", "이번 사이클은 ETF 자금 유입이라는 새로운 변수가 있어 단순 비교는 위험하지만, 참고 지표로는 의미가 있다고 봅니다.", "*투자 판단은 본인 책임입니다.*"], category: "crypto", author: "coin_dori", createdAt: "1시간 전", upvotes: 312, downvotes: 28, comments: 97, views: 7840, tickers: ["BTC"], hasChart: true, ageMin: 60 },
  { id: "p3", title: "[거시] 연준 발언과 원/달러 환율, 이번 주 체크포인트 5가지", body: ["이번 주 일정 중 시장 변동성에 영향을 줄 수 있는 항목을 정리했습니다.", "- 미국 CPI 발표\n- 연준 인사 연설 3건\n- 국고채 입찰\n- 한국 수출입 지표\n- 주요 기술주 실적", "각 항목별 시나리오는 댓글에 이어서 정리하겠습니다."], category: "macro", author: "macro_minsu", createdAt: "2시간 전", upvotes: 421, downvotes: 9, comments: 112, views: 12300, tickers: ["USDKRW", "SPX"], pinned: true, ageMin: 120 },
  { id: "p4", title: "엔비디아 실적 프리뷰: 시장 기대치 vs 가이던스 포인트", body: ["컨센서스 기준으로 매출과 데이터센터 부문 기대치를 정리했습니다.", "중요한 건 숫자보다 다음 분기 가이던스와 공급 병목에 대한 코멘트일 가능성이 높습니다."], category: "us-stock", author: "us_stock_jin", createdAt: "3시간 전", upvotes: 187, downvotes: 15, comments: 43, views: 4310, tickers: ["NVDA"], ageMin: 180 },
  { id: "p5", title: "초보 질문) PER이 낮으면 무조건 저평가인가요?", body: ["주식 공부를 시작한 지 한 달 된 초보입니다. PER이 낮은 종목을 찾아서 사려고 했는데 선배님들이 조심하라고 하더라고요. 이유가 궁금합니다."], category: "qna", author: "value_sora", createdAt: "4시간 전", upvotes: 96, downvotes: 2, comments: 38, views: 2980, tickers: [], ageMin: 240 },
  { id: "p6", title: "알트코인 순환매 올까? 솔라나·이더리움 상대 강도 점검", body: ["BTC 도미넌스가 정체되는 구간에서 알트코인으로 자금이 이동하는지 확인해봤습니다.", "아직 확정적 신호는 없고, 거래량이 동반되는지 지켜보는 중입니다."], category: "crypto", author: "coin_dori", createdAt: "5시간 전", upvotes: 143, downvotes: 31, comments: 52, views: 3870, tickers: ["SOL", "ETH"], hasChart: true, ageMin: 300 },
  { id: "p7", title: "유가 하락이 인플레이션 기대에 미치는 영향 정리", body: ["유가와 기대인플레이션의 상관관계를 최근 2년 데이터로 살펴봤습니다.", "에너지 가격 하락은 헤드라인 물가에는 긍정적이지만 근원 물가 경로는 별개로 봐야 합니다."], category: "macro", author: "bond_kim", createdAt: "6시간 전", upvotes: 78, downvotes: 4, comments: 21, views: 1920, tickers: ["WTI"], ageMin: 360 },
  { id: "p8", title: "월급쟁이 적립식 투자 전략, 1년 회고", body: ["매월 같은 날 ETF를 분할매수한 1년 기록을 공유합니다. 수익률보다 중요한 건 꾸준함이었다는 결론입니다.", "시행착오와 감정 조절 팁도 적어봤어요."], category: "strategy", author: "value_sora", createdAt: "8시간 전", upvotes: 205, downvotes: 6, comments: 71, views: 6540, tickers: [], ageMin: 480 },
  { id: "p9", title: "오늘 장 어땠나요? 자유롭게 이야기해요", body: ["오늘 시장 분위기 어떠셨나요? 가볍게 한마디씩 남겨주세요 :)"], category: "free", author: "macro_minsu", createdAt: "9시간 전", upvotes: 54, downvotes: 1, comments: 88, views: 2210, tickers: [], ageMin: 540 },
  { id: "p10", title: "테슬라 옵션 시장이 말해주는 것: 내재변동성 읽기", body: ["발표 이벤트 전 내재변동성이 커지는 패턴을 정리했습니다."], category: "us-stock", author: "us_stock_jin", createdAt: "11시간 전", upvotes: 64, downvotes: 8, comments: 19, views: 1530, tickers: ["TSLA"], ageMin: 660 },
  { id: "p11", title: "2차전지 반등, 바닥일까 데드캣일까", body: ["거래량과 수급을 근거로 한 개인 의견입니다. 반대 의견 환영합니다."], category: "kr-stock", author: "chart_haeun", createdAt: "13시간 전", upvotes: 119, downvotes: 22, comments: 57, views: 3340, tickers: ["373220"], hasChart: true, ageMin: 780 },
  { id: "p12", title: "국채 금리와 주식 밸류에이션의 관계 쉽게 이해하기", body: ["금리가 오르면 왜 성장주가 힘들어할까요? 할인율 개념으로 설명해봅니다."], category: "strategy", author: "bond_kim", createdAt: "1일 전", upvotes: 167, downvotes: 3, comments: 29, views: 4020, tickers: [], ageMin: 1440 },
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
  { id: "c1", author: "coin_dori", body: "정리 감사합니다. 저는 환율 쪽이 더 변수라고 봐요.", createdAt: "20분 전", upvotes: 24, replies: [
    { id: "c1-1", author: "chart_haeun", body: "동의합니다. 다만 수급 쪽 데이터는 아직 긍정적이에요.", createdAt: "15분 전", upvotes: 9 },
    { id: "c1-2", author: "value_sora", body: "저는 분할 접근이 마음 편하더라고요.", createdAt: "10분 전", upvotes: 5 },
  ] },
  { id: "c2", author: "us_stock_jin", body: "미국 쪽 실적 일정도 같이 보면 좋을 것 같습니다.", createdAt: "18분 전", upvotes: 12 },
  { id: "c3", author: "bond_kim", body: "금리 경로가 확인되기 전까지는 관망이 낫다는 의견입니다.", createdAt: "9분 전", upvotes: 7, replies: [
    { id: "c3-1", author: "macro_minsu", body: "CPI 이후 다시 정리해서 올리겠습니다!", createdAt: "4분 전", upvotes: 3 },
  ] },
];

// ───────── 광고 ─────────
export const AD_SLOTS = [
  { id: "home-top", label: "홈페이지 상단 배너" },
  { id: "insights-inline", label: "인사이트 목록 중간" },
  { id: "feed-inline", label: "커뮤니티 피드 중간" },
  { id: "post-detail", label: "게시글 상세 페이지" },
  { id: "sidebar", label: "PC 오른쪽 사이드바" },
] as const;

// ───────── 기타 ─────────

export const TRENDING_TICKERS = ["005930", "NVDA", "BTC", "000660", "TSLA", "SOL"];

export const ANNOUNCEMENTS = [
  { id: "a1", title: "핀톡 디자인 프리뷰(Phase 1) 공개 안내", date: "2026-11-05" },
  { id: "a2", title: "커뮤니티 이용 규칙 및 투자 유의사항", date: "2026-11-05" },
];

export const REPORTS = [
  { id: "r1", target: "게시글 · “이 종목 무조건 오릅니다 지금 사세요”", reason: "허위·과장 투자 권유", reporter: "user_0412", status: "대기" },
  { id: "r2", target: "댓글 · “…(욕설 포함)”", reason: "욕설/비방", reporter: "user_8831", status: "대기" },
  { id: "r3", target: "게시글 · “텔레그램 리딩방 홍보”", reason: "스팸/광고", reporter: "user_1190", status: "처리됨" },
];

export const ADMIN_USERS = [
  { id: "u1", nickname: "chart_haeun", email: "ha***@example.com", joined: "2026-08-12", role: "일반", status: "정상" },
  { id: "u2", nickname: "coin_dori", email: "do***@example.com", joined: "2026-08-30", role: "일반", status: "정상" },
  { id: "u3", nickname: "spam_bot_77", email: "sp***@example.com", joined: "2026-11-03", role: "일반", status: "이용 제한" },
  { id: "u4", nickname: "fintalk_admin", email: "ad***@example.com", joined: "2026-07-01", role: "관리자", status: "정상" },
];

export const fmtNum = (n: number) =>
  n >= 10000 ? `${(n / 10000).toFixed(n >= 100000 ? 0 : 1)}만` : n.toLocaleString("ko-KR");

/** 크리에이터 관심 분야 (프로필에서 최대 5개 선택) */
export const INTEREST_OPTIONS = ["국내 주식", "미국 주식", "암호화폐", "거시경제", "기술적 분석", "가치투자", "퀀트", "ETF", "단타·트레이딩", "투자 입문"];
