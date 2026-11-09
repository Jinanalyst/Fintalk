import { ImageResponse } from "next/og";
import { getShare } from "@/lib/data/share";
import { fmtPrice, fmtUsd } from "@/lib/trade";

export const size = { width: 1200, height: 630 };

/** 카드에 쓰는 글자만 담은 작은 한글 폰트를 받아옵니다. 실패하면 기본 폰트로 그립니다. */
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

const UP = "#22c55e";
const DOWN = "#ef4444";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await getShare(id);

  if (!s) {
    return new ImageResponse(
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#0b1220", color: "#94a3b8", fontSize: 48 }}>FinTalk</div>,
      size,
    );
  }

  const win = s.roe >= 0;
  const accent = win ? UP : DOWN;
  const long = s.side === "long";
  const coin = s.symbol.replace("USDT", "");
  const sign = (n: number) => (n >= 0 ? "+" : "");
  const labels = `${s.nickname}모의투자진행 중종료롱숏진입가현재가청산가수익률손익보유 포인트가상 자금 기록 · 실제 수익 아님`;
  const ascii = Array.from({ length: 95 }, (_, i) => String.fromCharCode(32 + i)).join("");
  const font = await loadFont(labels + ascii);

  const stat = (k: string, v: string) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", fontSize: 24, color: "#94a3b8" }}>{k}</div>
      <div style={{ display: "flex", fontSize: 38, color: "#f1f5f9" }}>{v}</div>
    </div>
  );

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 56,
          background: `linear-gradient(135deg, #0b1220 0%, #111c33 60%, ${win ? "#0d2a1f" : "#2a1216"} 100%)`,
          color: "#f1f5f9",
          fontFamily: font ? "Noto Sans KR" : "sans-serif",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <svg width="48" height="48" viewBox="0 0 64 64">
              <rect width="64" height="64" rx="14" fill="#1F4FD8" />
              <path d="M18 13H46A8 8 0 0 1 54 21V37A8 8 0 0 1 46 45H33L22 54V45H18A8 8 0 0 1 10 37V21A8 8 0 0 1 18 13Z" fill="#FFFFFF" />
              <path d="M19 36L28 27L34 32L45 21M38 21H45V28" fill="none" stroke="#1F4FD8" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <div style={{ display: "flex", fontSize: 34, color: "#e2e8f0" }}>FinTalk</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 20px", borderRadius: 999, border: "2px solid #f0b90b", color: "#f0b90b", fontSize: 26 }}>모의투자</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <div style={{ display: "flex", fontSize: 52, color: "#fff" }}>{coin}USDT</div>
            <div style={{ display: "flex", padding: "4px 18px", borderRadius: 10, fontSize: 30, background: long ? UP : DOWN, color: "#fff" }}>{long ? "롱" : "숏"} {s.leverage}x</div>
            <div style={{ display: "flex", padding: "4px 16px", borderRadius: 10, fontSize: 26, border: "2px solid #475569", color: "#cbd5e1" }}>{s.closed ? "종료" : "진행 중"}</div>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 24 }}>
            <div style={{ display: "flex", fontSize: 128, color: accent, letterSpacing: -2 }}>
              {sign(s.roe)}
              {s.roe.toFixed(2)}%
            </div>
            <div style={{ display: "flex", fontSize: 40, color: accent }}>
              {sign(s.pnl)}
              {fmtUsd(s.pnl)} USDT
            </div>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div style={{ display: "flex", gap: 56 }}>
            {stat("진입가", fmtPrice(s.entry))}
            {stat(s.closed ? "청산가" : "현재가", fmtPrice(s.mark))}
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
            <div style={{ display: "flex", fontSize: 36, color: "#fff" }}>{s.nickname}</div>
            <div style={{ display: "flex", fontSize: 24, color: "#94a3b8" }}>보유 포인트 {s.points.toLocaleString("en-US")}P</div>
          </div>
        </div>
        <div style={{ display: "flex", fontSize: 20, color: "#64748b" }}>가상 자금 기록 · 실제 수익 아님</div>
      </div>
    ),
    { ...size, fonts: font ? [{ name: "Noto Sans KR", data: font, weight: 700, style: "normal" }] : undefined },
  );
}
