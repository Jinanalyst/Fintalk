/**
 * ⚠️ 샘플 데이터 (SAMPLE DATA)
 * Phase 1 디자인 검증용 가짜 데이터입니다. 실제 시세·뉴스·이용자가 아닙니다.
 * Phase 2~3에서 Supabase / 외부 API 로 교체됩니다.
 */

// ───────── 카테고리 ─────────
export type Category = { slug: string; label: string };

export const NEWS_CATEGORIES: Category[] = [
  { slug: "all", label: "전체" },
  { slug: "kr-stock", label: "국내 주식" },
  { slug: "us-stock", label: "해외 주식" },
  { slug: "crypto", label: "암호화폐" },
  { slug: "macro", label: "거시경제" },
  { slug: "rates", label: "채권 및 금리" },
  { slug: "fx-commodity", label: "외환 및 원자재" },
];

export const BOARD_CATEGORIES: Category[] = [
  { slug: "all", label: "전체 게시글" },
  { slug: "free", label: "자유게시판" },
  { slug: "kr-stock", label: "국내 주식" },
  { slug: "us-stock", label: "해외 주식" },
  { slug: "crypto", label: "암호화폐" },
  { slug: "macro", label: "거시경제" },
  { slug: "strategy", label: "투자 전략" },
  { slug: "qna", label: "질문 및 답변" },
];

export const boardLabel = (slug: string) =>
  BOARD_CATEGORIES.find((c) => c.slug === slug)?.label ?? slug;
export const newsLabel = (slug: string) =>
  NEWS_CATEGORIES.find((c) => c.slug === slug)?.label ?? slug;

// ───────── 마켓 ─────────
export type MarketType = "crypto" | "kr" | "us" | "index" | "fx" | "commodity";

export const MARKET_TABS: { slug: MarketType; label: string }[] = [
  { slug: "crypto", label: "암호화폐" },
  { slug: "kr", label: "국내 주식" },
  { slug: "us", label: "미국 주식" },
  { slug: "index", label: "주요 지수" },
  { slug: "fx", label: "외환" },
  { slug: "commodity", label: "원자재" },
];

export type Asset = {
  symbol: string;
  name: string;
  market: MarketType;
  price: number;
  changePct: number;
  unit: string; // 통화/단위 표기
  decimals: number;
  series: number[];
};

function seeded(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/** 마지막 값이 현재가가 되도록 만든 결정적 랜덤워크 (SSR/CSR 동일 결과) */
function makeSeries(price: number, changePct: number, seed: number, n = 60) {
  const rnd = seeded(seed);
  const start = price / (1 + changePct / 100);
  const vol = Math.abs(changePct) * 0.35 + 0.4;
  const out: number[] = [];
  let v = start;
  for (let i = 0; i < n; i++) {
    const trend = (price - start) / n;
    v = v + trend + (rnd() - 0.5) * (price * vol * 0.012);
    out.push(v);
  }
  out[n - 1] = price;
  return out;
}

type RawAsset = Omit<Asset, "series">;
const RAW_ASSETS: RawAsset[] = [
  { symbol: "BTC", name: "비트코인", market: "crypto", price: 98450000, changePct: 2.34, unit: "KRW", decimals: 0 },
  { symbol: "ETH", name: "이더리움", market: "crypto", price: 4890000, changePct: 1.12, unit: "KRW", decimals: 0 },
  { symbol: "XRP", name: "리플", market: "crypto", price: 3120, changePct: -0.85, unit: "KRW", decimals: 0 },
  { symbol: "SOL", name: "솔라나", market: "crypto", price: 312500, changePct: 4.71, unit: "KRW", decimals: 0 },
  { symbol: "DOGE", name: "도지코인", market: "crypto", price: 412, changePct: -2.15, unit: "KRW", decimals: 0 },
  { symbol: "005930", name: "삼성전자", market: "kr", price: 78400, changePct: 1.29, unit: "KRW", decimals: 0 },
  { symbol: "000660", name: "SK하이닉스", market: "kr", price: 231000, changePct: 2.88, unit: "KRW", decimals: 0 },
  { symbol: "035420", name: "NAVER", market: "kr", price: 214500, changePct: -0.93, unit: "KRW", decimals: 0 },
  { symbol: "373220", name: "LG에너지솔루션", market: "kr", price: 362000, changePct: -1.64, unit: "KRW", decimals: 0 },
  { symbol: "NVDA", name: "엔비디아", market: "us", price: 142.38, changePct: 3.05, unit: "USD", decimals: 2 },
  { symbol: "AAPL", name: "애플", market: "us", price: 228.9, changePct: 0.42, unit: "USD", decimals: 2 },
  { symbol: "TSLA", name: "테슬라", market: "us", price: 341.2, changePct: -2.31, unit: "USD", decimals: 2 },
  { symbol: "MSFT", name: "마이크로소프트", market: "us", price: 431.75, changePct: 0.88, unit: "USD", decimals: 2 },
  { symbol: "KOSPI", name: "코스피", market: "index", price: 2684.12, changePct: 0.76, unit: "pt", decimals: 2 },
  { symbol: "KOSDAQ", name: "코스닥", market: "index", price: 862.4, changePct: -0.34, unit: "pt", decimals: 2 },
  { symbol: "SPX", name: "S&P 500", market: "index", price: 6012.45, changePct: 0.52, unit: "pt", decimals: 2 },
  { symbol: "NDX", name: "나스닥 100", market: "index", price: 21350.7, changePct: 0.91, unit: "pt", decimals: 2 },
  { symbol: "USDKRW", name: "달러/원", market: "fx", price: 1392.5, changePct: -0.21, unit: "KRW", decimals: 2 },
  { symbol: "JPYKRW", name: "엔/원", market: "fx", price: 9.053, changePct: 0.37, unit: "KRW", decimals: 3 },
  { symbol: "EURKRW", name: "유로/원", market: "fx", price: 1468.9, changePct: -0.12, unit: "KRW", decimals: 2 },
  { symbol: "WTI", name: "WTI 원유", market: "commodity", price: 71.84, changePct: -1.08, unit: "USD", decimals: 2 },
  { symbol: "GOLD", name: "금", market: "commodity", price: 2685.3, changePct: 0.64, unit: "USD", decimals: 2 },
  { symbol: "SILVER", name: "은", market: "commodity", price: 31.42, changePct: 1.35, unit: "USD", decimals: 2 },
];

export const ASSETS: Asset[] = RAW_ASSETS.map((a, i) => ({
  ...a,
  series: makeSeries(a.price, a.changePct, 1000 + i * 37),
}));

export const getAsset = (symbol: string) =>
  ASSETS.find((a) => a.symbol.toLowerCase() === symbol.toLowerCase());

/** 헤더 티커 / 홈 요약에 쓰는 주요 시세 */
export const TICKER_SYMBOLS = ["KOSPI", "KOSDAQ", "SPX", "NDX", "USDKRW", "BTC", "GOLD", "WTI"];

export function formatPrice(a: Pick<Asset, "price" | "decimals">) {
  return a.price.toLocaleString("ko-KR", {
    minimumFractionDigits: a.decimals,
    maximumFractionDigits: a.decimals,
  });
}

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

// ───────── 뉴스 ─────────
export type NewsItem = {
  id: string;
  title: string;
  summary: string;
  source: string;
  category: string;
  publishedAt: string; // 표시용 상대 시각 (샘플)
  tickers: string[];
  relatedPostIds: string[];
  breaking?: boolean;
};

export const NEWS: NewsItem[] = [
  { id: "n1", title: "코스피, 외국인 순매수에 반도체 강세…2,680선 회복", summary: "외국인이 반도체 대형주를 중심으로 순매수에 나서며 코스피가 상승 마감했다. 시장은 다음 주 발표될 미국 물가 지표를 주시하고 있다.", source: "샘플뉴스 경제부", category: "kr-stock", publishedAt: "12분 전", tickers: ["KOSPI", "005930", "000660"], relatedPostIds: ["p1", "p5"], breaking: true },
  { id: "n2", title: "비트코인 9,800만원 돌파 시도…현물 ETF 자금 유입 지속", summary: "미국 현물 ETF로의 순유입이 이어지면서 비트코인이 전고점 부근에서 등락하고 있다. 파생시장 미결제약정도 증가세다.", source: "샘플코인데일리", category: "crypto", publishedAt: "28분 전", tickers: ["BTC", "ETH"], relatedPostIds: ["p2", "p6"], breaking: true },
  { id: "n3", title: "미 연준 인사 “금리 인하 속도 신중해야”…달러 강세 전환", summary: "연준 고위 인사가 물가 둔화세가 더디다고 언급하면서 금리 인하 기대가 후퇴했다. 달러 인덱스는 소폭 상승했다.", source: "샘플글로벌", category: "macro", publishedAt: "45분 전", tickers: ["USDKRW", "SPX"], relatedPostIds: ["p3"] },
  { id: "n4", title: "엔비디아, 차세대 칩 출하 앞당긴다…AI 반도체 랠리 재점화", summary: "엔비디아가 차세대 AI 가속기 출하 일정을 앞당긴다고 밝히며 관련 공급망 종목이 동반 상승했다.", source: "샘플테크", category: "us-stock", publishedAt: "1시간 전", tickers: ["NVDA", "000660"], relatedPostIds: ["p4"] },
  { id: "n5", title: "국고채 10년물 금리 소폭 하락…채권시장 관망세", summary: "미국 금리 경로를 확인하려는 심리가 커지며 국고채 금리가 좁은 범위에서 움직였다.", source: "샘플채권뉴스", category: "rates", publishedAt: "1시간 전", tickers: [], relatedPostIds: [] },
  { id: "n6", title: "국제 유가 하락, 산유국 증산 우려…WTI 71달러대", summary: "OPEC+의 증산 가능성이 거론되며 국제 유가가 약세를 보였다. 금은 안전자산 선호로 소폭 올랐다.", source: "샘플에너지", category: "fx-commodity", publishedAt: "2시간 전", tickers: ["WTI", "GOLD"], relatedPostIds: ["p7"] },
  { id: "n7", title: "원/달러 환율 1,390원대 안착 시도…수출주 영향은?", summary: "환율이 1,390원 선에서 등락하며 수출 업종의 실적 전망에 대한 엇갈린 해석이 나온다.", source: "샘플금융", category: "fx-commodity", publishedAt: "2시간 전", tickers: ["USDKRW", "005930"], relatedPostIds: ["p3"] },
  { id: "n8", title: "이더리움 업그레이드 일정 공개…스테이킹 수익률 변화 전망", summary: "이더리움 개발진이 차기 업그레이드 로드맵을 공개했다. 시장은 스테이킹 수익률에 미칠 영향을 분석 중이다.", source: "샘플코인데일리", category: "crypto", publishedAt: "3시간 전", tickers: ["ETH"], relatedPostIds: [] },
  { id: "n9", title: "테슬라, 신규 모델 발표 앞두고 변동성 확대", summary: "발표를 앞두고 옵션 시장에서 변동성 지표가 상승했다. 단기 주가 방향성에 대한 의견이 갈린다.", source: "샘플글로벌", category: "us-stock", publishedAt: "4시간 전", tickers: ["TSLA"], relatedPostIds: [] },
  { id: "n10", title: "한국은행 총재 “물가 안정 확인 후 정책 판단”", summary: "한국은행 총재가 통화정책 방향과 관련해 데이터에 의존한 판단을 강조했다.", source: "샘플경제", category: "macro", publishedAt: "5시간 전", tickers: ["KOSPI"], relatedPostIds: ["p3"] },
  { id: "n11", title: "2차전지 업종 반등 시도…LG에너지솔루션 거래량 증가", summary: "낙폭 과대 인식이 확산되며 2차전지 대형주에 매수세가 유입됐다.", source: "샘플뉴스 경제부", category: "kr-stock", publishedAt: "6시간 전", tickers: ["373220"], relatedPostIds: [] },
  { id: "n12", title: "솔라나 생태계 거래량 급증…알트코인 순환매 관심", summary: "솔라나 기반 탈중앙 거래소 거래량이 늘어나며 알트코인 순환매 기대가 커지고 있다.", source: "샘플코인데일리", category: "crypto", publishedAt: "7시간 전", tickers: ["SOL"], relatedPostIds: ["p6"] },
];

export const getNews = (id: string) => NEWS.find((n) => n.id === id);

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
  hasChart?: boolean;
  pinned?: boolean;
  /** 정렬용 숫자 (낮을수록 최근) */
  ageMin: number;
  // ── Supabase 연동 시에만 채워지는 필드 ──
  live?: boolean;
  authorId?: string;
  images?: string[];
  myVote?: 0 | 1 | -1;
  saved?: boolean;
  rawBody?: string;
};

export const POSTS: Post[] = [
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

// ───────── 챌린지 ─────────
export type Challenge = {
  id: string;
  question: string;
  asset: string;
  basePrice: string;
  baseTime: string;
  endTime: string;
  source: string;
  upPct: number;
  participants: number;
  comments: number;
  status: "open" | "closed";
  result?: "up" | "down";
  resultNote?: string;
};

export const CHALLENGES: Challenge[] = [
  { id: "ch1", question: "이번 주 비트코인은 상승할까요?", asset: "BTC", basePrice: "98,450,000원", baseTime: "11/04 09:00 KST", endTime: "11/10 09:00 KST", source: "샘플거래소 BTC/KRW 종가", upPct: 64, participants: 1842, comments: 126, status: "open" },
  { id: "ch2", question: "이번 주 코스피는 상승 마감할까요?", asset: "KOSPI", basePrice: "2,684.12pt", baseTime: "11/04 15:30 KST", endTime: "11/08 15:30 KST", source: "한국거래소 종가 (샘플)", upPct: 58, participants: 1260, comments: 84, status: "open" },
  { id: "ch3", question: "엔비디아는 이번 실적 발표 후 상승 마감할까요?", asset: "NVDA", basePrice: "$142.38", baseTime: "11/05 06:00 KST", endTime: "11/07 06:00 KST", source: "나스닥 종가 (샘플)", upPct: 71, participants: 934, comments: 61, status: "open" },
  { id: "ch4", question: "이번 주 원/달러 환율은 1,400원을 넘을까요?", asset: "USDKRW", basePrice: "1,392.50원", baseTime: "11/04 09:00 KST", endTime: "11/08 15:30 KST", source: "서울외국환중개 종가 (샘플)", upPct: 37, participants: 702, comments: 40, status: "open" },
  { id: "ch5", question: "지난주 이더리움은 상승 마감했을까요?", asset: "ETH", basePrice: "4,830,000원", baseTime: "10/28 09:00 KST", endTime: "11/03 09:00 KST", source: "샘플거래소 ETH/KRW 종가", upPct: 55, participants: 1488, comments: 92, status: "closed", result: "up", resultNote: "종료가 4,880,000원 (+1.0%)" },
  { id: "ch6", question: "지난주 코스닥은 상승 마감했을까요?", asset: "KOSDAQ", basePrice: "866.1pt", baseTime: "10/28 15:30 KST", endTime: "11/01 15:30 KST", source: "한국거래소 종가 (샘플)", upPct: 49, participants: 880, comments: 47, status: "closed", result: "down", resultNote: "종료가 862.4pt (-0.4%)" },
];

// ───────── 광고 ─────────
export const AD_SLOTS = [
  { id: "home-top", label: "홈페이지 상단 배너" },
  { id: "news-inline", label: "뉴스 목록 중간" },
  { id: "feed-inline", label: "커뮤니티 피드 중간" },
  { id: "post-detail", label: "게시글 상세 페이지" },
  { id: "sidebar", label: "PC 오른쪽 사이드바" },
] as const;

// ───────── 기타 ─────────
export const MARKET_MOOD = { greed: 62, label: "약간 낙관", bullish: 58, neutral: 24, bearish: 18 }; // 샘플

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
