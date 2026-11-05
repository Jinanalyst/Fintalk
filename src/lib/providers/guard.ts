import type { CallResult, ProviderMeta } from "./types";

/**
 * 공급처 호출 보호막: 라이선스 게이트 → 캐시 → 호출 제한 → 타임아웃 → 서킷 브레이커.
 * 어떤 단계에서 실패하더라도 예외 대신 `{ ok:false }` 를 반환합니다. (최근 성공값이 있으면 stale 로 재사용)
 */

const TIMEOUT_MS = 4000;
const BREAKER_THRESHOLD = 3;
const BREAKER_OPEN_MS = 60_000;
const STALE_MAX_MS = 30 * 60_000;

type State = {
  cache: Map<string, { at: number; data: unknown }>;
  hits: Map<string, number[]>;
  fails: Map<string, { count: number; openUntil: number }>;
  inflight: Map<string, Promise<CallResult<unknown>>>;
};

const g = globalThis as unknown as { __providerState?: State };
const state: State = (g.__providerState ??= { cache: new Map(), hits: new Map(), fails: new Map(), inflight: new Map() });

/**
 * 라이선스 정책.
 * - 운영(production): PROVIDER_LICENSE_VERIFIED 에 ID 가 등록된 공급처만 허용 (무료 API ≠ 상업 이용 허용)
 * - 개발/테스트: 모두 허용 (이용약관 미확인 공급처는 개발·테스트 전용)
 */
export function isLicensed(id: string): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  const verified = (process.env.PROVIDER_LICENSE_VERIFIED ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  return verified.includes(id);
}

function withinRate(meta: ProviderMeta): boolean {
  const now = Date.now();
  const arr = (state.hits.get(meta.id) ?? []).filter((t) => now - t < meta.rateLimit.windowMs);
  if (arr.length >= meta.rateLimit.max) {
    state.hits.set(meta.id, arr);
    return false;
  }
  arr.push(now);
  state.hits.set(meta.id, arr);
  return true;
}

export async function callProvider<T>(
  meta: ProviderMeta,
  cacheKey: string,
  run: (signal: AbortSignal) => Promise<T | null>,
): Promise<CallResult<T>> {
  if (!isLicensed(meta.id)) return { ok: false, reason: "unlicensed" };

  const key = `${meta.id}:${cacheKey}`;
  const cached = state.cache.get(key);
  const now = Date.now();
  if (cached && now - cached.at < meta.ttlMs) return { ok: true, data: cached.data as T, stale: false };

  const staleOr = (reason: Extract<CallResult<T>, { ok: false }>["reason"]): CallResult<T> =>
    cached && Date.now() - cached.at < STALE_MAX_MS ? { ok: true, data: cached.data as T, stale: true } : { ok: false, reason };

  const f = state.fails.get(meta.id);
  if (f && f.openUntil > now) return staleOr("circuit-open");
  if (!withinRate(meta)) return staleOr("rate-limited");

  // 같은 키의 동시 요청은 하나로 합칩니다.
  const pending = state.inflight.get(key);
  if (pending) return (await pending) as CallResult<T>;

  const task = (async (): Promise<CallResult<T>> => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const data = await run(ctrl.signal);
      state.fails.delete(meta.id);
      if (data == null) return staleOr("empty");
      state.cache.set(key, { at: Date.now(), data });
      return { ok: true, data, stale: false };
    } catch (e) {
      const count = (state.fails.get(meta.id)?.count ?? 0) + 1;
      state.fails.set(meta.id, { count, openUntil: count >= BREAKER_THRESHOLD ? Date.now() + BREAKER_OPEN_MS : 0 });
      console.error(`[provider:${meta.id}]`, e instanceof Error ? e.message : e);
      return staleOr(ctrl.signal.aborted ? "timeout" : "error");
    } finally {
      clearTimeout(timer);
      state.inflight.delete(key);
    }
  })();
  state.inflight.set(key, task);
  return task;
}
