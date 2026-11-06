/**
 * 본문 마크다운 안의 미디어 문법 (서버/클라이언트 공용, React 의존 없음)
 *   이미지: `![이미지](https://…)`   동영상: `@[video](https://…)`  — 각각 한 줄을 통째로 차지합니다.
 */
export const IMAGE_LINE = /^!\[([^\]\n]*)\]\((https?:\/\/[^\s)]+)\)$/;
export const VIDEO_LINE = /^@\[video\]\((https?:\/\/[^\s)]+)\)$/;

export const MAX_MEDIA = 20;

/**
 * 유튜브 링크: 한 줄에 주소만 붙여 넣으면 본문에서 영상 플레이어로 바뀝니다.
 * youtube.com/watch?v=ID · youtu.be/ID · youtube.com/shorts/ID · /embed/ID · /live/ID
 */
const unwrapYt = (line: string) => line.trim().replace(/^@\[youtube\]\((.+)\)$/, "$1");

export function youtubeIdOf(line: string): string | null {
  let u: URL;
  try { u = new URL(unwrapYt(line)); } catch { return null; }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  const host = u.hostname.replace(/^(www|m)\./, "");
  let id: string | null = null;
  if (host === "youtu.be") id = u.pathname.slice(1).split("/")[0];
  else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    if (u.pathname === "/watch") id = u.searchParams.get("v");
    else id = /^\/(?:shorts|embed|live)\/([\w-]{11})/.exec(u.pathname)?.[1] ?? null;
  }
  return id && /^[\w-]{11}$/.test(id) ? id : null;
}

/** 재생 시작 위치(초): ?t=90, ?t=1m30s, ?start=90 */
export function youtubeStartOf(line: string): number {
  try {
    const u = new URL(unwrapYt(line));
    const m = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$/.exec(u.searchParams.get("t") ?? u.searchParams.get("start") ?? "");
    return m ? Math.min(Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0), 86400) : 0;
  } catch { return 0; }
}

/** 대표(썸네일) 이미지는 대체 텍스트를 "대표"로 표시합니다: `![대표](https://…)` */
export const COVER_ALT = "대표";

export const imageLine = (url: string, cover = false) => `![${cover ? COVER_ALT : "이미지"}](${url})`;
export const videoLine = (url: string) => `@[video](${url})`;

export function mediaOf(line: string): { kind: "image" | "video"; url: string; cover?: boolean } | null {
  const t = line.trim();
  const i = IMAGE_LINE.exec(t);
  if (i) return { kind: "image", url: i[2], cover: i[1] === COVER_ALT };
  const v = VIDEO_LINE.exec(t);
  if (v) return { kind: "video", url: v[1] };
  return null;
}

/** 본문에서 이미지 URL 목록 (게시글 썸네일/차트 표시용) */
export function imageUrlsOf(body: string) {
  const out: string[] = [];
  for (const l of body.split("\n")) {
    const m = mediaOf(l);
    if (m?.kind === "image") out.push(m.url);
  }
  return out;
}

/** 목록 카드 썸네일: 대표로 지정한 이미지, 없으면 본문 첫 이미지, 없으면 이전 방식 첨부 이미지 */
export function thumbnailOf(body: string, legacy: string[] = []): string | null {
  let first: string | null = null;
  for (const l of body.split("\n")) {
    const m = mediaOf(l);
    if (m?.kind !== "image") continue;
    if (m.cover) return m.url;
    first ??= m.url;
  }
  if (first ?? legacy[0]) return first ?? legacy[0];
  for (const l of body.split("\n")) {
    const y = youtubeIdOf(l);
    if (y) return `https://i.ytimg.com/vi/${y}/hqdefault.jpg`;
  }
  return null;
}

/** 목록 카드 요약용: 미디어 줄과 마크다운 기호를 제거한 문단 목록 */
export function plainParagraphs(body: string): string[] {
  const text = body
    .split("\n")
    .filter((l) => !mediaOf(l) && !youtubeIdOf(l))
    .map((l) => l.replace(/^(#{2,3} |> |[-*] |\d+\. )/, "").replace(/^---+$/, "").replace(/\*\*([^*\n]+)\*\*/g, "$1"))
    .join("\n");
  const paras = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  return paras.length ? paras : [""];
}

/** 허용된 저장소 주소(내 폴더)만 남기고 나머지 미디어 줄은 제거, 개수 제한 */
export function sanitizeMedia(body: string, allowedPrefix: string) {
  let n = 0;
  return body
    .replace(/\r\n/g, "\n")
    .split("\n")
    .filter((l) => {
      const m = mediaOf(l);
      if (!m) return true;
      if (!m.url.startsWith(allowedPrefix) || n >= MAX_MEDIA) return false;
      n++;
      return true;
    })
    .join("\n");
}
