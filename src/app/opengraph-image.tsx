import { ImageResponse } from "next/og";

export const alt = "핀톡(FinTalk) – 투자 분석을 나누고 가치를 만드는 금융 커뮤니티";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const TITLE = "핀톡";
const TAGLINE = "투자 분석을 나누고 가치를 만드는 금융 커뮤니티";

async function loadFont(text: string): Promise<ArrayBuffer | null> {
  try {
    const css = await (
      await fetch(`https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@700&text=${encodeURIComponent(text)}`, {
        headers: { "User-Agent": "Mozilla/5.0 (Macintosh; U; Intel Mac OS X 10_6_8; de-at) AppleWebKit/533.21.1 (KHTML, like Gecko) Version/5.0.5 Safari/533.21.1" },
      })
    ).text();
    const url = css.match(/src: url\((.+?)\) format\('(?:opentype|truetype)'\)/)?.[1];
    if (!url) return null;
    return await (await fetch(url)).arrayBuffer();
  } catch {
    return null;
  }
}

/** 사이트 기본 공유 이미지 (페이지별 og:image가 없을 때 사용) */
export default async function OpengraphImage() {
  const font = await loadFont(TITLE + TAGLINE + "FinTalk");
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 28,
          background: "#1F4FD8",
          color: "#FFFFFF",
          fontFamily: font ? "Noto Sans KR" : "sans-serif",
        }}
      >
        <svg width="160" height="160" viewBox="0 0 64 64">
          <path d="M18 13H46A8 8 0 0 1 54 21V37A8 8 0 0 1 46 45H33L22 54V45H18A8 8 0 0 1 10 37V21A8 8 0 0 1 18 13Z" fill="#FFFFFF" />
          <path d="M19 36L28 27L34 32L45 21M38 21H45V28" fill="none" stroke="#1F4FD8" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <div style={{ display: "flex", fontSize: 96, fontWeight: 700 }}>{font ? TITLE : "FinTalk"}</div>
        {font && <div style={{ display: "flex", fontSize: 36, opacity: 0.9 }}>{TAGLINE}</div>}
        {font && <div style={{ display: "flex", fontSize: 28, opacity: 0.7 }}>FinTalk</div>}
      </div>
    ),
    { ...size, fonts: font ? [{ name: "Noto Sans KR", data: font, weight: 700, style: "normal" }] : undefined },
  );
}
