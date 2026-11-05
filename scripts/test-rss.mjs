// RSS 연결 테스트: node scripts/test-rss.mjs [--strict]
// 각 피드의 HTTP 상태, 파싱 성공 여부, 기사 수, 최신 기사 시각, 응답 시간을 점검합니다.
// --strict: 하나라도 실패하면 종료 코드 1 (CI 용). 라이선스가 allowed 가 아닌 피드는 운영에서 비활성입니다.
import Parser from "rss-parser";
import { readFileSync } from "node:fs";

const feeds = JSON.parse(readFileSync(new URL("../src/lib/providers/news/feeds.json", import.meta.url), "utf8"));
const parser = new Parser({ timeout: 8000 });
const strict = process.argv.includes("--strict");
let failed = 0;

for (const f of feeds) {
  const t0 = Date.now();
  try {
    const get = () => fetch(f.url, { headers: { "User-Agent": "FinTalk-RSS/1.0", Accept: "application/rss+xml, text/xml" }, signal: AbortSignal.timeout(8000) });
    let res = await get();
    if (!res.ok) res = await get(); // 일시 오류(CDN 404/5xx)는 한 번 재시도
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const feed = await parser.parseString(await res.text());
    const items = feed.items ?? [];
    const valid = items.filter((i) => i.title && i.link);
    const latest = items.map((i) => Date.parse(i.isoDate ?? i.pubDate ?? "")).filter(Number.isFinite).sort((a, b) => b - a)[0];
    const ageH = latest ? (Date.now() - latest) / 3_600_000 : null;
    const problems = [];
    if (valid.length === 0) problems.push("유효한 기사 없음");
    if (ageH !== null && ageH > (f.staleHours ?? 72)) problems.push(`최신 기사가 ${Math.round(ageH)}시간 전`);
    if (problems.length) failed++;
    console.log(`${problems.length ? "WARN" : " OK "} ${f.id.padEnd(20)} ${valid.length}/${items.length}건  최신 ${ageH === null ? "?" : ageH.toFixed(1) + "h 전"}  ${Date.now() - t0}ms  license=${f.license}${problems.length ? "  ⚠ " + problems.join(", ") : ""}`);
  } catch (e) {
    failed++;
    console.log(`FAIL ${f.id.padEnd(20)} ${e.message}  (${Date.now() - t0}ms)  license=${f.license}`);
  }
}
console.log(`\n${feeds.length - failed}/${feeds.length} 피드 정상`);
if (strict && failed) process.exit(1);
