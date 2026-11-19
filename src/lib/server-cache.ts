/**
 * 서버 메모리 캐시 (서버 전용). 같은 요청이 몰려도 거래소에는 TTL 당 한 번만 나가도록,
 * 동시에 들어온 같은 요청은 하나로 합칩니다. 다 실패하면 직전 값(최대 staleMs)을 대신 돌려줍니다.
 */
type Entry<T> = { at: number; value?: T; pending?: Promise<T> };
const MAX_ENTRIES = 500;

export function makeCache<T>() {
  const map = new Map<string, Entry<T>>();
  return async function cached(key: string, ttlMs: number, staleMs: number, load: () => Promise<T>): Promise<T> {
    const now = Date.now();
    const hit = map.get(key);
    if (hit?.value !== undefined && now - hit.at < ttlMs) return hit.value;
    if (hit?.pending) return hit.pending;

    const pending = load()
      .then((value) => {
        map.set(key, { at: Date.now(), value });
        if (map.size > MAX_ENTRIES) for (const k of map.keys()) { map.delete(k); if (map.size <= MAX_ENTRIES * 0.8) break; }
        return value;
      })
      .catch((err) => {
        const old = map.get(key);
        if (old?.value !== undefined && Date.now() - old.at < staleMs) {
          map.set(key, { at: old.at, value: old.value }); // 대기 표시 해제
          return old.value;
        }
        map.delete(key);
        throw err;
      });
    map.set(key, { at: hit?.at ?? 0, value: hit?.value, pending });
    return pending;
  };
}
