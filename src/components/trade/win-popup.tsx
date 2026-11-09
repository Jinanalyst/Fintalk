"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Share2, X } from "lucide-react";
import { createShareAction } from "@/app/actions/share";
import { useToast } from "@/components/common/toast";
import { Button } from "@/components/ui/button";
import { fmtPrice, fmtUsd, type ClosedTrade } from "@/lib/trade";

export type WinInfo = { trade: ClosedTrade; streak: number };

/** 새로 종료된 거래 중 수익이 난 것을 찾아, 그 거래부터 거슬러 올라가며 연속 수익 횟수를 셉니다. (trades 는 최신순) */
export function findWin(trades: ClosedTrade[], seen: Set<string>): WinInfo | null {
  const idx = trades.findIndex((t) => !seen.has(t.id) && t.pnl > 0);
  if (idx < 0) return null;
  let streak = 0;
  for (let i = idx; i < trades.length && trades[i].pnl > 0; i++) streak++;
  return { trade: trades[idx], streak };
}

const MOODS = [
  { title: "수익 실현!", line: "잘했어요! 깔끔한 청산이에요 👏" },
  { title: "연속 수익!", line: "또 해냈어요! 흐름이 좋아요 ✨" },
  { title: "불꽃 연승!", line: "대단해요! 지금 완전 물올랐어요 🔥" },
];

/** 코인 캐릭터: 연승이 길수록 표정이 커집니다. 1회 = 미소, 2회 = 웃는 눈, 3회 이상 = 별 눈 + 파티 모자 */
function Mascot({ streak }: { streak: number }) {
  const tier = streak >= 3 ? 2 : streak >= 2 ? 1 : 0;
  return (
    <svg viewBox="0 0 160 160" className="win-mascot size-32" role="img" aria-label="기뻐하는 코인 캐릭터">
      {tier === 2 && <path d="M80 6 L62 44 H98 Z" fill="#ef4444" stroke="#fff" strokeWidth="3" strokeLinejoin="round" />}
      {tier === 2 && <circle cx="80" cy="6" r="6" fill="#f0b90b" />}
      <g className="win-arm-l"><path d="M30 92 Q10 70 22 52" fill="none" stroke="#d99a06" strokeWidth="10" strokeLinecap="round" /></g>
      <g className="win-arm-r"><path d="M130 92 Q150 70 138 52" fill="none" stroke="#d99a06" strokeWidth="10" strokeLinecap="round" /></g>
      <circle cx="80" cy="92" r="52" fill="#f0b90b" stroke="#d99a06" strokeWidth="6" />
      <circle cx="80" cy="92" r="40" fill="none" stroke="#fcd34d" strokeWidth="3" strokeDasharray="4 6" />
      {/* 볼 */}
      <circle cx="52" cy="102" r="7" fill="#fb7185" opacity="0.55" />
      <circle cx="108" cy="102" r="7" fill="#fb7185" opacity="0.55" />
      {/* 눈 */}
      {tier === 0 && (
        <>
          <circle cx="62" cy="88" r="6" fill="#422006" />
          <circle cx="98" cy="88" r="6" fill="#422006" />
          <circle cx="64" cy="86" r="2" fill="#fff" />
          <circle cx="100" cy="86" r="2" fill="#fff" />
        </>
      )}
      {tier === 1 && (
        <>
          <path d="M53 92 Q62 80 71 92" fill="none" stroke="#422006" strokeWidth="5" strokeLinecap="round" />
          <path d="M89 92 Q98 80 107 92" fill="none" stroke="#422006" strokeWidth="5" strokeLinecap="round" />
        </>
      )}
      {tier === 2 && (
        <>
          <path d="M62 78 l3.5 7 7.5 1 -5.5 5 1.5 7.5 -7 -3.8 -7 3.8 1.5 -7.5 -5.5 -5 7.5 -1z" fill="#fff" stroke="#422006" strokeWidth="2.5" strokeLinejoin="round" />
          <path d="M98 78 l3.5 7 7.5 1 -5.5 5 1.5 7.5 -7 -3.8 -7 3.8 1.5 -7.5 -5.5 -5 7.5 -1z" fill="#fff" stroke="#422006" strokeWidth="2.5" strokeLinejoin="round" />
        </>
      )}
      {/* 입 */}
      {tier === 0 ? (
        <path d="M66 108 Q80 120 94 108" fill="none" stroke="#422006" strokeWidth="5" strokeLinecap="round" />
      ) : (
        <path d="M62 106 Q80 132 98 106 Z" fill="#7f1d1d" stroke="#422006" strokeWidth="4" strokeLinejoin="round" />
      )}
      {/* 반짝이 */}
      {tier >= 1 && (
        <g fill="#fff" className="win-spark">
          <path d="M20 30 l3 8 8 3 -8 3 -3 8 -3 -8 -8 -3 8 -3z" />
          <path d="M140 24 l2.5 6 6 2.5 -6 2.5 -2.5 6 -2.5 -6 -6 -2.5 6 -2.5z" />
        </g>
      )}
    </svg>
  );
}

const CONFETTI = ["#f0b90b", "#22c55e", "#3b82f6", "#ef4444", "#a855f7", "#fff"];

/** 수익으로 청산했을 때 뜨는 팝업. 2번 이상 연속이면 "N WIN" 배지가 붙습니다. */
export function WinPopup({ win, onClose }: { win: WinInfo; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const { trade: t, streak } = win;
  const mood = MOODS[streak >= 3 ? 2 : streak >= 2 ? 1 : 0];
  const long = t.side === "long";
  const roe = t.margin > 0 ? (t.pnl / t.margin) * 100 : 0;
  const coin = t.symbol.replace("USDT", "");

  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-black/60 p-4" onClick={onClose} role="dialog" aria-modal="true" aria-label={mood.title}>
      <style>{`
        @keyframes win-pop{0%{transform:scale(.7);opacity:0}60%{transform:scale(1.04);opacity:1}100%{transform:scale(1)}}
        @keyframes win-bounce{0%,100%{transform:translateY(0) rotate(-3deg)}50%{transform:translateY(-12px) rotate(3deg)}}
        @keyframes win-wave-l{0%,100%{transform:rotate(0)}50%{transform:rotate(-14deg)}}
        @keyframes win-wave-r{0%,100%{transform:rotate(0)}50%{transform:rotate(14deg)}}
        @keyframes win-fall{0%{transform:translateY(-20px) rotate(0);opacity:1}100%{transform:translateY(340px) rotate(540deg);opacity:0}}
        @keyframes win-twinkle{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.3;transform:scale(.7)}}
        .win-card{animation:win-pop .45s ease-out both}
        .win-mascot{animation:win-bounce 1s ease-in-out infinite;overflow:visible}
        .win-arm-l{transform-origin:30px 92px;animation:win-wave-l .5s ease-in-out infinite}
        .win-arm-r{transform-origin:130px 92px;animation:win-wave-r .5s ease-in-out infinite}
        .win-spark path{transform-box:fill-box;transform-origin:center;animation:win-twinkle .9s ease-in-out infinite}
        .win-conf{position:absolute;top:0;width:8px;height:14px;border-radius:2px;animation:win-fall 2.4s linear infinite}
        @media (prefers-reduced-motion:reduce){.win-card,.win-mascot,.win-arm-l,.win-arm-r,.win-spark path,.win-conf{animation:none}}
      `}</style>
      <div
        className="win-card relative w-full max-w-sm overflow-hidden rounded-3xl border border-white/10 p-6 text-center text-white shadow-2xl"
        style={{ background: "linear-gradient(135deg,#0b1220 0%,#111c33 60%,#0d2a1f 100%)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {streak >= 2 &&
          Array.from({ length: 18 }, (_, i) => (
            <span key={i} className="win-conf" aria-hidden style={{ left: `${(i * 37) % 100}%`, background: CONFETTI[i % CONFETTI.length], animationDelay: `${(i % 6) * 0.35}s`, animationDuration: `${2 + (i % 4) * 0.4}s` }} />
          ))}
        <button type="button" onClick={onClose} aria-label="닫기" className="absolute right-3 top-3 rounded-full p-1.5 text-white/60 hover:bg-white/10 hover:text-white">
          <X className="size-4" />
        </button>

        <div className="flex justify-center"><Mascot streak={streak} /></div>

        {streak >= 2 ? (
          <p className="mt-1 text-5xl font-black italic tracking-tight text-[#f0b90b]">{streak} WIN</p>
        ) : (
          <p className="mt-1 text-3xl font-black text-[#f0b90b]">{mood.title}</p>
        )}
        {streak >= 2 && <p className="mt-0.5 text-sm font-bold text-white/90">{streak}번 연속 수익 · {mood.title}</p>}
        <p className="mt-1 text-xs text-white/70">{mood.line}</p>

        <div className="mt-4 rounded-2xl bg-white/5 p-4 text-left">
          <div className="flex items-center gap-2 text-sm">
            <span className="font-bold">{coin}USDT</span>
            <span className={`rounded px-1.5 py-0.5 text-xs font-bold ${long ? "bg-[#22c55e]" : "bg-[#ef4444]"}`}>
              {long ? "롱" : "숏"} {t.leverage}x
            </span>
          </div>
          <p className="mt-1 text-4xl font-black tabular-nums text-[#22c55e]">+{roe.toFixed(2)}%</p>
          <p className="text-sm font-semibold tabular-nums text-[#22c55e]">+{fmtUsd(t.pnl)} USDT</p>
          <div className="mt-2 flex justify-between text-xs text-white/60 tabular-nums">
            <span>진입 {fmtPrice(t.entry_price)}</span>
            <span>청산 {fmtPrice(t.exit_price)}</span>
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <Button
            className="flex-1"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              const r = await createShareAction("trade", t.id);
              if (r.ok) router.push(`/share/${r.id}`);
              else {
                setBusy(false);
                toast.show(r.error);
              }
            }}
          >
            <Share2 /> 인증 카드 공유
          </Button>
          <Button variant="outline" className="flex-1 border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white" onClick={onClose}>
            계속 거래
          </Button>
        </div>
        <p className="mt-3 text-[10px] text-white/40">가상 자금 모의투자 기록이며 실제 수익이 아닙니다.</p>
      </div>
    </div>
  );
}
