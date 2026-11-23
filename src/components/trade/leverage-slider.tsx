"use client";

import { MAX_LEVERAGE } from "@/lib/trade";
import { cn } from "@/lib/utils";

const BASE_TICKS = [1, 5, 10, 25, 50, 75, 100, 125, 150];

/** 상한(max)에 맞춘 눈금. 큰 상한에서는 5x 를 빼서 기존 눈금(1·10·25…)을 유지합니다. */
function ticksFor(max: number) {
  const t = BASE_TICKS.filter((x) => x < max && (max <= 50 || x !== 5));
  return [...t, max];
}

/** 눈금을 같은 간격으로 놓기 위해, 레버리지 값 ↔ 슬라이더 위치(0~눈금 수)를 구간별로 변환합니다. */
function toPos(ticks: number[], v: number) {
  const last = ticks.length - 1;
  for (let i = 0; i < last; i++) {
    if (v <= ticks[i + 1]) return i + (v - ticks[i]) / (ticks[i + 1] - ticks[i]);
  }
  return last;
}
function fromPos(ticks: number[], p: number) {
  const last = ticks.length - 1;
  const i = Math.min(Math.floor(p), last - 1);
  return Math.round(ticks[i] + (p - i) * (ticks[i + 1] - ticks[i]));
}

/** 레버리지를 슬라이더로 끌어서 정합니다. 아래 눈금을 누르면 바로 그 값으로 이동합니다. */
export function LeverageSlider({ value, onChange, className, max = MAX_LEVERAGE }: { value: number; onChange: (n: number) => void; className?: string; max?: number }) {
  const TICKS = ticksFor(Math.max(2, Math.min(max, MAX_LEVERAGE)));
  const LAST = TICKS.length - 1;
  const top = TICKS[LAST];
  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-center gap-3">
        <input
          type="range"
          min={0}
          max={LAST}
          step={0.01}
          value={toPos(TICKS, Math.min(value, top))}
          onChange={(e) => onChange(fromPos(TICKS, Number(e.target.value)))}
          aria-label="Leverage"
          className="h-1 flex-1 cursor-pointer accent-foreground"
        />
        <label className="flex h-7 w-16 items-center rounded-md border bg-muted/40 px-1.5 focus-within:ring-2 focus-within:ring-ring/50">
          <input
            className="w-full min-w-0 bg-transparent text-right text-xs font-semibold tabular-nums outline-none"
            inputMode="numeric"
            aria-label="Enter leverage"
            value={value}
            onChange={(e) => {
              const n = Math.trunc(Number(e.target.value));
              if (Number.isFinite(n) && n >= 1 && n <= top) onChange(n);
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
            style={{ left: `${(toPos(TICKS, t) / LAST) * 100}%` }}
          >
            {t}x
          </button>
        ))}
      </div>
    </div>
  );
}
