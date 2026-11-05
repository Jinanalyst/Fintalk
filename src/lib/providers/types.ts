/**
 * 데이터 공급처 공통 계약.
 * 화면/페이지는 이 타입과 `@/lib/providers` 의 함수만 알고, 개별 공급처(Upbit, CoinGecko, RSS …)는 모릅니다.
 * 공급처를 바꿀 때는 이 인터페이스를 구현한 파일을 추가하고 registry 에 등록하면 됩니다.
 */

export type ProviderKind = "quote" | "news" | "widget";

export type ProviderMeta = {
  /** 고유 ID. 라이선스 확인 목록(PROVIDER_LICENSE_VERIFIED)에서 이 값으로 식별합니다. */
  id: string;
  name: string;
  kind: ProviderKind;
  /** 확인한 이용약관 URL (라이선스 검토 기록용) */
  termsUrl: string;
  /** 화면에 반드시 표기해야 하는 출처 문구 */
  attribution: string;
  /** 공급처별 호출 제한 (windowMs 동안 최대 max 회) */
  rateLimit: { max: number; windowMs: number };
  /** 정상 응답 캐시 유지 시간 */
  ttlMs: number;
  /** 라이선스를 코드/문서로 이미 확인해 운영 기본 허용인지 (그 외는 PROVIDER_LICENSE_VERIFIED 필요) */
  licensedByDefault?: boolean;
};

export type QuoteTarget = { symbol: string; market: string };

export type Quote = {
  symbol: string;
  price: number;
  /** 전일(24h) 대비 등락률, % 단위 */
  changePct: number;
  currency: string;
  asOf: number;
  provider: string;
  /** 출처 표기 문구 */
  attribution: string;
};

export interface QuoteProvider {
  meta: ProviderMeta;
  supports(t: QuoteTarget): boolean;
  fetchQuote(t: QuoteTarget, signal: AbortSignal): Promise<Omit<Quote, "provider" | "attribution"> | null>;
}

export type NewsArticle = {
  id: string;
  title: string;
  summary: string;
  url: string;
  source: string;
  publishedAt: number;
  category: string;
  tickers: string[];
  provider: string;
  attribution: string;
};

export interface NewsProvider {
  meta: ProviderMeta;
  /** 피드의 기본 카테고리 (sample-data 의 NEWS_CATEGORIES slug) */
  category: string;
  /** true 면 제목/요약 키워드로 카테고리를 다시 분류 */
  classify?: boolean;
  fetchLatest(signal: AbortSignal): Promise<Omit<NewsArticle, "provider" | "attribution" | "category" | "tickers">[]>;
}

/** 호출 결과. 실패해도 예외를 던지지 않고 사유를 돌려줘서 페이지가 계속 렌더링되게 합니다. */
export type CallResult<T> =
  | { ok: true; data: T; stale: boolean }
  | { ok: false; reason: "unlicensed" | "rate-limited" | "circuit-open" | "timeout" | "error" | "empty" };
