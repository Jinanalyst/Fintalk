"use client";

import { MAX_LEVERAGE } from "@/lib/trade";
import { cn } from "@/lib/utils";

const TICKS = [1, 10, 25, 50, 75, 100, 125, 150].filter((t) => t <= MAX_LEVERAGE);
const LAST = TICKS.length - 1;

/** 눈금을 같은 간격으로 놓기 위해, 레버리지 값 ↔ 슬라이더 위치(0~눈금 수)를 구간별로 변환합니다. */
function toPos(v: number) {
  for (let i = 0; i < LAST; i++) {
    if (v <= TICKS[i + 1]) return i + (v - TICKS[i]) / (TICKS[i + 1] - TICKS[i]);
  }
  return LAST;
}
function fromPos(p: number) {
  const i = Math.min(Math.floor(p), LAST - 1);
  return Math.round(TICKS[i] + (p - i) * (TICKS[i + 1] - TICKS[i]));
}

/** 레버리지를 슬라이더로 끌어서 정합니다. 아래 눈금을 누르면 바로 그 값으로 이동합니다. */
export function LeverageSlider({ value, onChange, className }: { value: number; onChange: (n: number) => void; className?: string }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-center gap-3">
        <input
          type="range"
          min={0}
          max={LAST}
          step={0.01}
          value={toPos(value)}
          onChange={(e) => onChange(fromPos(Number(e.target.value)))}
          aria-label="레버리지"
          className="h-1 flex-1 cursor-pointer accent-foreground"
        />
        <label className="flex h-7 w-16 items-center rounded-md border bg-muted/40 px-1.5 focus-within:ring-2 focus-within:ring-ring/50">
          <input
            className="w-full min-w-0 bg-transparent text-right text-xs font-semibold tabular-nums outline-none"
            inputMode="numeric"
            aria-label="레버리지 직접 입력"
            value={value}
            onChange={(e) => {
              const n = Math.trunc(Number(e.target.value));
              if (Number.isFinite(n) && n >= 1 && n <= MAX_LEVERAGE) onChange(n);
            }}
          />
          <span className="text-xs text-muted-foreground">x</span>
        </label>
      </div>
      <div className="relative h-4 text-[10px] text-muted-foreground" style={{ marginRight: 76 }}>
        {TICKS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => onChange(t)}
            className={cn("absolute -translate-x-1/2 tabular-nums hover:text-foreground", t === value && "font-bold text-foreground")}
            style={{ left: `${(toPos(t) / LAST) * 100}%` }}
          >
            {t}x
          </button>
        ))}
      </div>
    </div>
  );
}
