"use client";

import { useId, useMemo, useState } from "react";
import { cn } from "@/lib/utils";

function pathFor(values: number[], w: number, h: number, pad = 2) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => [
    (i / (values.length - 1)) * w,
    pad + (1 - (v - min) / span) * (h - pad * 2),
  ]);
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  return { line, area: `${line} L${w},${h} L0,${h} Z` };
}

export function Sparkline({
  values,
  up,
  className,
}: {
  values: number[];
  up: boolean;
  className?: string;
}) {
  const { line } = useMemo(() => pathFor(values, 100, 32), [values]);
  return (
    <svg viewBox="0 0 100 32" preserveAspectRatio="none" className={cn("h-8 w-20", className)} aria-hidden>
      <path
        d={line}
        fill="none"
        strokeWidth="1.6"
        vectorEffect="non-scaling-stroke"
        className={up ? "stroke-up" : "stroke-down"}
      />
    </svg>
  );
}

const RANGES = [
  { k: "1D", n: 20 },
  { k: "1W", n: 35 },
  { k: "1M", n: 48 },
  { k: "3M", n: 60 },
];

/** 샘플 시계열 기반 영역 차트 (실제 차트 라이브러리는 Phase 3에서 검토) */
export function PriceChart({ values, up }: { values: number[]; up: boolean }) {
  const [range, setRange] = useState("3M");
  const id = useId();
  const n = RANGES.find((r) => r.k === range)!.n;
  const data = useMemo(() => values.slice(-n), [values, n]);
  const { line, area } = useMemo(() => pathFor(data, 600, 220, 8), [data]);
  const color = up ? "var(--up)" : "var(--down)";
  return (
    <div>
      <div className="mb-2 flex gap-1">
        {RANGES.map((r) => (
          <button
            key={r.k}
            onClick={() => setRange(r.k)}
            className={cn(
              "rounded-md px-2.5 py-1 text-xs font-medium",
              range === r.k ? "bg-brand-soft text-brand" : "text-muted-foreground hover:bg-muted",
            )}
          >
            {r.k}
          </button>
        ))}
      </div>
      <svg viewBox="0 0 600 220" preserveAspectRatio="none" className="h-56 w-full" role="img" aria-label="가격 차트(샘플)">
        <defs>
          <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.25" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((p) => (
          <line key={p} x1="0" x2="600" y1={220 * p} y2={220 * p} stroke="var(--border)" strokeDasharray="3 4" />
        ))}
        <path d={area} fill={`url(#${id})`} />
        <path d={line} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  );
}

/** 상승/하락 비율 막대 */
export function SplitBar({ up, className }: { up: number; className?: string }) {
  return (
    <div
      className={cn("flex h-2.5 w-full overflow-hidden rounded-full bg-muted", className)}
      role="img"
      aria-label={`상승 ${up}% 하락 ${100 - up}%`}
    >
      <div className="bg-up" style={{ width: `${up}%` }} />
      <div className="bg-down" style={{ width: `${100 - up}%` }} />
    </div>
  );
}
