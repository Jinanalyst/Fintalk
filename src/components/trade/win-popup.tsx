"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Share2, X } from "lucide-react";
import { createShareAction } from "@/app/actions/share";
import { useToast } from "@/components/common/toast";
import { Button } from "@/components/ui/button";
import { fmtPrice, fmtUsd, type ClosedTrade } from "@/lib/trade";

export type TradeResult = { trade: ClosedTrade; streak: number; kind: "win" | "loss" };

/** 새로 종료된 거래 중 가장 최근의 수익/손실 거래를 찾아, 거기서부터 거슬러 올라가며 같은 결과가 몇 번 연속인지 셉니다. (trades 는 최신순) */
export function findResult(trades: ClosedTrade[], seen: Set<string>): TradeResult | null {
  const idx = trades.findIndex((t) => !seen.has(t.id) && t.pnl !== 0);
  if (idx < 0) return null;
  const win = trades[idx].pnl > 0;
  let streak = 0;
  for (let i = idx; i < trades.length && trades[i].pnl > 0 === win && trades[i].pnl !== 0; i++) streak++;
  return { trade: trades[idx], streak, kind: win ? "win" : "loss" };
}

const LOSS_MOODS = [
  { title: "아쉬운 손실", line: "괜찮아요, 다음에 만회해요 💧" },
  { title: "연속 손실", line: "잠깐 쉬어가도 좋아요 ☕" },
  { title: "연패 중...", line: "무리하지 말고 리스크부터 점검해요 🌧" },
];

const MOODS = [
  { title: "수익 실현!", line: "잘했어요! 깔끔한 청산이에요 👏" },
  { title: "연속 수익!", line: "또 해냈어요! 흐름이 좋아요 ✨" },
  { title: "불꽃 연승!", line: "대단해요! 지금 완전 물올랐어요 🔥" },
];

/** 코인 캐릭터: 연승이 길수록 멋있어집니다. 1회 = 자신만만한 표정, 2회 = 선글라스 + 주먹, 3회 이상 = 왕관 + 망토 */
function Mascot({ streak }: { streak: number }) {
  const tier = streak >= 3 ? 2 : streak >= 2 ? 1 : 0;
  const GOLD = "#f5c211";
  const EDGE = "#b8860b";
  const rightUp = tier >= 1;
  const leftUp = tier === 2;
  const fist = (cx: number, cy: number) => <circle cx={cx} cy={cy} r={10} fill={GOLD} stroke={EDGE} strokeWidth="4" />;
  return (
    <svg viewBox="0 0 160 164" className="win-mascot size-32" role="img" aria-label="멋진 코인 캐릭터">
      {tier === 2 && <path d="M42 72 Q14 126 26 152 L134 152 Q146 126 118 72 Z" fill="#dc2626" stroke="#991b1b" strokeWidth="3" strokeLinejoin="round" />}
      <path d="M64 143 V156 M96 143 V156" stroke={EDGE} strokeWidth="8" strokeLinecap="round" />
      <ellipse cx="60" cy="158" rx="11" ry="5" fill="#1f2937" />
      <ellipse cx="100" cy="158" rx="11" ry="5" fill="#1f2937" />
      <g className="win-arm-l">
        {leftUp ? (
          <><path d="M30 92 Q10 74 18 52" fill="none" stroke={EDGE} strokeWidth="9" strokeLinecap="round" />{fist(18, 46)}</>
        ) : (
          <><path d="M30 100 Q12 112 22 128" fill="none" stroke={EDGE} strokeWidth="9" strokeLinecap="round" />{fist(22, 130)}</>
        )}
      </g>
      <g className="win-arm-r">
        {rightUp ? (
          <><path d="M130 92 Q150 74 142 52" fill="none" stroke={EDGE} strokeWidth="9" strokeLinecap="round" />{fist(142, 46)}</>
        ) : (
          <><path d="M130 100 Q148 112 138 128" fill="none" stroke={EDGE} strokeWidth="9" strokeLinecap="round" />{fist(138, 130)}</>
        )}
      </g>
      <circle cx="80" cy="92" r="52" fill={GOLD} stroke={EDGE} strokeWidth="6" />
      <circle cx="80" cy="92" r="41" fill="none" stroke="#fde68a" strokeWidth="3" />
      <path d="M45 72 Q52 54 70 48" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" opacity="0.6" />
      {tier === 2 && (
        <>
          <path d="M54 50 L56 24 L68 38 L80 18 L92 38 L104 24 L106 50 Z" fill="#a855f7" stroke="#6b21a8" strokeWidth="3.5" strokeLinejoin="round" />
          <circle cx="56" cy="24" r="4" fill="#fde047" /><circle cx="80" cy="18" r="4.5" fill="#fde047" /><circle cx="104" cy="24" r="4" fill="#fde047" />
        </>
      )}
      {tier === 0 ? (
        <>
          <ellipse cx="64" cy="90" rx="8" ry="7" fill="#fff" stroke="#422006" strokeWidth="2.5" />
          <ellipse cx="96" cy="90" rx="8" ry="7" fill="#fff" stroke="#422006" strokeWidth="2.5" />
          <circle cx="66" cy="91" r="3.5" fill="#422006" /><circle cx="98" cy="91" r="3.5" fill="#422006" />
          <path d="M53 77 L74 83 M107 77 L86 83" stroke="#422006" strokeWidth="4.5" strokeLinecap="round" />
          <path d="M66 113 Q84 120 100 104" fill="none" stroke="#422006" strokeWidth="5" strokeLinecap="round" />
        </>
      ) : (
        <>
          <path d="M48 80 H76 V92 Q76 102 66 102 H58 Q48 102 48 92 Z" fill="#111827" />
          <path d="M84 80 H112 V92 Q112 102 102 102 H94 Q84 102 84 92 Z" fill="#111827" />
          <path d="M76 84 H84" stroke="#111827" strokeWidth="4" />
          <path d="M54 85 L62 85 M90 85 L98 85" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" opacity="0.8" />
          <path d="M62 109 Q82 128 102 106 Z" fill="#fff" stroke="#422006" strokeWidth="4" strokeLinejoin="round" />
        </>
      )}
      {tier >= 1 && (
        <g fill="#fff" className="win-spark">
          <path d="M18 28 l3 8 8 3 -8 3 -3 8 -3 -8 -8 -3 8 -3z" />
          <path d="M136 22 l2.5 6 6 2.5 -6 2.5 -2.5 6 -2.5 -6 -6 -2.5 6 -2.5z" />
        </g>
      )}
    </svg>
  );
}

/** 슬픈 코인 캐릭터: 연패가 길수록 더 울상이 됩니다. 1회 = 시무룩, 2회 = 눈물, 3회 이상 = 비구름 + 반창고 + 엉엉 */
function SadMascot({ streak }: { streak: number }) {
  const tier = streak >= 3 ? 2 : streak >= 2 ? 1 : 0;
  const GOLD = "#dcae1c";
  const EDGE = "#9a7209";
  const arm = (d: string, fx: number, fy: number) => (
    <>
      <path d={d} fill="none" stroke={EDGE} strokeWidth="9" strokeLinecap="round" />
      <circle cx={fx} cy={fy} r="9" fill={GOLD} stroke={EDGE} strokeWidth="4" />
    </>
  );
  return (
    <svg viewBox="0 0 160 164" className="lose-mascot size-32" role="img" aria-label="슬퍼하는 코인 캐릭터">
      {tier === 2 && (
        <>
          <g fill="#94a3b8" stroke="#64748b" strokeWidth="2.5">
            <circle cx="58" cy="20" r="14" /><circle cx="80" cy="13" r="17" /><circle cx="102" cy="21" r="13" />
            <rect x="46" y="22" width="68" height="12" rx="6" />
          </g>
          <g stroke="#60a5fa" strokeWidth="3" strokeLinecap="round">
            <path className="lose-rain" d="M60 38 v8" /><path className="lose-rain" style={{ animationDelay: ".25s" }} d="M80 38 v8" /><path className="lose-rain" style={{ animationDelay: ".5s" }} d="M100 38 v8" />
          </g>
        </>
      )}
      <path d="M64 143 V156 M96 143 V156" stroke={EDGE} strokeWidth="8" strokeLinecap="round" />
      <ellipse cx="60" cy="158" rx="11" ry="5" fill="#1f2937" />
      <ellipse cx="100" cy="158" rx="11" ry="5" fill="#1f2937" />
      {arm("M30 102 Q18 120 26 138", 26, 140)}
      {arm("M130 102 Q142 120 134 138", 134, 140)}
      <circle cx="80" cy="94" r="52" fill={GOLD} stroke={EDGE} strokeWidth="6" />
      <circle cx="80" cy="94" r="41" fill="none" stroke="#f1d57a" strokeWidth="3" />
      <path d="M45 74 Q52 56 70 50" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" opacity="0.4" />
      {tier === 2 && (
        <g transform="rotate(-18 104 56)">
          <rect x="88" y="50" width="34" height="12" rx="3" fill="#fde7c4" stroke="#d6a76a" strokeWidth="2" />
          <path d="M100 50 v12 M110 50 v12" stroke="#d6a76a" strokeWidth="1.5" />
        </g>
      )}
      {tier === 0 && (
        <>
          <ellipse cx="64" cy="92" rx="8" ry="7.5" fill="#fff" stroke="#422006" strokeWidth="2.5" />
          <ellipse cx="96" cy="92" rx="8" ry="7.5" fill="#fff" stroke="#422006" strokeWidth="2.5" />
          <circle cx="64" cy="95" r="3.8" fill="#422006" /><circle cx="96" cy="95" r="3.8" fill="#422006" />
          <path d="M54 84 L74 76 M106 84 L86 76" stroke="#422006" strokeWidth="4.5" strokeLinecap="round" />
          <path d="M68 118 Q82 106 96 118" fill="none" stroke="#422006" strokeWidth="5" strokeLinecap="round" />
          <path className="lose-tear" d="M99 102 q-4 6 0 9 q4 -3 0 -9z" fill="#60a5fa" />
        </>
      )}
      {tier >= 1 && (
        <>
          <path d="M55 92 Q64 100 73 92 M87 92 Q96 100 105 92" fill="none" stroke="#422006" strokeWidth="5" strokeLinecap="round" />
          <path d="M54 84 L74 76 M106 84 L86 76" stroke="#422006" strokeWidth="4.5" strokeLinecap="round" />
          <path className="lose-tear" d="M62 100 q-5 4 -3 24 h6 q2 -20 -3 -24z" fill="#60a5fa" opacity="0.85" />
          <path className="lose-tear" style={{ animationDelay: ".4s" }} d="M98 100 q-5 4 -3 24 h6 q2 -20 -3 -24z" fill="#60a5fa" opacity="0.85" />
          <path d="M66 124 Q82 106 98 124 Z" fill="#7f1d1d" stroke="#422006" strokeWidth="4" strokeLinejoin="round" />
        </>
      )}
    </svg>
  );
}

const CONFETTI =["#f0b90b", "#22c55e", "#3b82f6", "#ef4444", "#a855f7", "#fff"];

/** 수익으로 청산했을 때 뜨는 팝업. 2번 이상 연속이면 "N WIN" 배지가 붙습니다. */
export function WinPopup({ win, onClose }: { win: TradeResult; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const { trade: t, streak } = win;
  const loss = win.kind === "loss";
  const mood = (loss ? LOSS_MOODS : MOODS)[streak >= 3 ? 2 : streak >= 2 ? 1 : 0];
  const tone = loss ? "#ef4444" : "#22c55e";
  const sign = loss ? "" : "+";
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
        @keyframes lose-sway{0%,100%{transform:rotate(-2deg) translateY(0)}50%{transform:rotate(2deg) translateY(3px)}}
        @keyframes lose-tear{0%{transform:translateY(-4px);opacity:0}30%{opacity:1}100%{transform:translateY(14px);opacity:0}}
        @keyframes lose-rain{0%{transform:translateY(-4px);opacity:0}30%{opacity:1}100%{transform:translateY(6px);opacity:0}}
        .lose-mascot{animation:lose-sway 2.4s ease-in-out infinite;overflow:visible}
        .lose-tear,.lose-rain{animation:lose-tear 1.3s ease-in infinite}
        .lose-rain{animation-name:lose-rain;animation-duration:.9s}
        .win-card{animation:win-pop .45s ease-out both}
        .win-mascot{animation:win-bounce 1s ease-in-out infinite;overflow:visible}
        .win-arm-l{transform-origin:30px 92px;animation:win-wave-l .5s ease-in-out infinite}
        .win-arm-r{transform-origin:130px 92px;animation:win-wave-r .5s ease-in-out infinite}
        .win-spark path{transform-box:fill-box;transform-origin:center;animation:win-twinkle .9s ease-in-out infinite}
        .win-conf{position:absolute;top:0;width:8px;height:14px;border-radius:2px;animation:win-fall 2.4s linear infinite}
        @media (prefers-reduced-motion:reduce){.win-card,.win-mascot,.win-arm-l,.win-arm-r,.win-spark path,.win-conf,.lose-mascot,.lose-tear,.lose-rain{animation:none}}
      `}</style>
      <div
        className="win-card relative w-full max-w-sm overflow-hidden rounded-3xl border border-white/10 p-6 text-center text-white shadow-2xl"
        style={{ background: loss ? "linear-gradient(135deg,#0b1220 0%,#141b2d 60%,#2a1216 100%)" : "linear-gradient(135deg,#0b1220 0%,#111c33 60%,#0d2a1f 100%)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {!loss && streak >= 2 &&
          Array.from({ length: 18 }, (_, i) => (
            <span key={i} className="win-conf" aria-hidden style={{ left: `${(i * 37) % 100}%`, background: CONFETTI[i % CONFETTI.length], animationDelay: `${(i % 6) * 0.35}s`, animationDuration: `${2 + (i % 4) * 0.4}s` }} />
          ))}
        <button type="button" onClick={onClose} aria-label="닫기" className="absolute right-3 top-3 rounded-full p-1.5 text-white/60 hover:bg-white/10 hover:text-white">
          <X className="size-4" />
        </button>

        <div className="flex justify-center">{loss ? <SadMascot streak={streak} /> : <Mascot streak={streak} />}</div>

        {streak >= 2 ? (
          <p className={`mt-1 text-5xl font-black italic tracking-tight ${loss ? "text-[#93c5fd]" : "text-[#f0b90b]"}`}>{streak} {loss ? "LOSE" : "WIN"}</p>
        ) : (
          <p className={`mt-1 text-3xl font-black ${loss ? "text-[#93c5fd]" : "text-[#f0b90b]"}`}>{mood.title}</p>
        )}
        {streak >= 2 && <p className="mt-0.5 text-sm font-bold text-white/90">{streak}번 연속 {loss ? "손실" : "수익"} · {mood.title}</p>}
        <p className="mt-1 text-xs text-white/70">{mood.line}</p>

        <div className="mt-4 rounded-2xl bg-white/5 p-4 text-left">
          <div className="flex items-center gap-2 text-sm">
            <span className="font-bold">{coin}USDT</span>
            <span className={`rounded px-1.5 py-0.5 text-xs font-bold ${long ? "bg-[#22c55e]" : "bg-[#ef4444]"}`}>
              {long ? "롱" : "숏"} {t.leverage}x
            </span>
          </div>
          <p className="mt-1 text-4xl font-black tabular-nums" style={{ color: tone }}>{sign}{roe.toFixed(2)}%</p>
          <p className="text-sm font-semibold tabular-nums" style={{ color: tone }}>{sign}{fmtUsd(t.pnl)} USDT</p>
          <div className="mt-2 flex justify-between text-xs text-white/60 tabular-nums">
            <span>진입 {fmtPrice(t.entry_price)}</span>
            <span>청산 {fmtPrice(t.exit_price)}</span>
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          {!loss && <Button
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
          </Button>}
          <Button variant="outline" className="flex-1 border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white" onClick={onClose}>
            계속 거래
          </Button>
        </div>
        <p className="mt-3 text-[10px] text-white/40">가상 자금 모의투자 기록이며 실제 {loss ? "손실" : "수익"}이 아닙니다.</p>
      </div>
    </div>
  );
}
