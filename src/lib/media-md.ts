/**
 * 본문 마크다운 안의 미디어 문법 (서버/클라이언트 공용, React 의존 없음)
 *   이미지: `![이미지](https://…)`   동영상: `@[video](https://…)`  — 각각 한 줄을 통째로 차지합니다.
 */
export const IMAGE_LINE = /^!\[([^\]\n]*)\]\((https?:\/\/[^\s)]+)\)$/;
export const VIDEO_LINE = /^@\[video\]\((https?:\/\/[^\s)]+)\)$/;

export const MAX_MEDIA = 20;

export const imageLine = (url: string) => `![이미지](${url})`;
export const videoLine = (url: string) => `@[video](${url})`;

export function mediaOf(line: string): { kind: "image" | "video"; url: string } | null {
  const t = line.trim();
  const i = IMAGE_LINE.exec(t);
  if (i) return { kind: "image", url: i[2] };
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

/** 목록 카드 요약용: 미디어 줄과 마크다운 기호를 제거한 문단 목록 */
export function plainParagraphs(body: string): string[] {
  const text = body
    .split("\n")
    .filter((l) => !mediaOf(l))
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
