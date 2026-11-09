"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FEE_RATE, fmtPrice, fmtUsd, unrealizedPnl, type Position } from "@/lib/trade";
import { cn } from "@/lib/utils";

const PCTS = [25, 50, 75, 100];
const num = (v: string) => (v.trim() === "" ? NaN : Number(v));

/**
 * 포지션 청산 패널 (포지션 탭과 차트에서 함께 사용).
 * 비율(%)을 정해 시장가로 바로 청산하거나, 지정가 청산 주문(reduce-only)을 걸 수 있습니다.
 */
export function ClosePanel({
  pos,
  mark,
  busy,
  onMarket,
  onLimit,
  onCancel,
  className,
}: {
  pos: Position;
  mark?: number;
  busy: boolean;
  onMarket: (pct: number) => void;
  onLimit: (pct: number, price: number) => void;
  onCancel?: () => void;
  className?: string;
}) {
  const [mode, setMode] = useState<"market" | "limit">("market");
  const [pct, setPct] = useState("100");
  const [price, setPrice] = useState("");
  const long = pos.side === "long";

  const p = num(pct);
  const limit = num(price);
  const ref = mode === "limit" && limit > 0 ? limit : mark;
  const pctOk = Number.isFinite(p) && p > 0 && p <= 100;
  const qty = pctOk ? (pos.qty * p) / 100 : 0;
  // 수수료 반영 예상 손익: 청산분 가격 손익 − 청산 수수료 − 진입 수수료(비율분)
  const est = ref && qty > 0 ? unrealizedPnl({ ...pos, qty }, ref) - qty * ref * FEE_RATE - qty * pos.entry_price * FEE_RATE : null;

  let error: string | null = null;
  if (!pctOk) error = "청산 비율은 1~100% 로 입력해 주세요.";
  else if (mode === "limit") {
    if (!(limit > 0)) error = "지정가를 입력해 주세요.";
    else if (mark && ((long && limit <= mark) || (!long && limit >= mark))) error = `${long ? "롱은 현재가보다 높게" : "숏은 현재가보다 낮게"} 입력해 주세요. 바로 청산하려면 시장가를 쓰세요.`;
  }

  return (
    <div className={cn("space-y-2.5 text-sm", className)}>
      <div className="grid grid-cols-2 gap-1 rounded-lg border bg-muted/40 p-0.5 text-xs font-medium">
        {(
          [
            ["market", "시장가"],
            ["limit", "지정가"],
          ] as const
        ).map(([k, t]) => (
          <button key={k} type="button" onClick={() => setMode(k)} className={cn("rounded-md py-1.5", mode === k ? "bg-foreground text-background" : "text-muted-foreground")}>
            {t}
          </button>
        ))}
      </div>

      {mode === "limit" && (
        <label className="flex h-9 items-center rounded-lg border bg-background px-3 focus-within:ring-2 focus-within:ring-ring/50">
          <span className="text-xs text-muted-foreground">가격</span>
          <input className="min-w-0 flex-1 bg-transparent px-2 text-right tabular-nums outline-none" inputMode="decimal" value={price} placeholder={mark ? fmtPrice(mark) : ""} onChange={(e) => setPrice(e.target.value)} />
          <button type="button" className="text-[11px] text-brand hover:underline" onClick={() => mark && setPrice(String(Number((mark * (long ? 1.005 : 0.995)).toPrecision(8))))}>
            ±0.5%
          </button>
        </label>
      )}

      <div className="flex items-center gap-1">
        {PCTS.map((v) => (
          <button key={v} type="button" onClick={() => setPct(String(v))} className={cn("flex-1 rounded-md border py-1 text-xs font-medium", num(pct) === v ? "border-brand bg-brand-soft text-brand" : "text-muted-foreground hover:bg-muted")}>
            {v}%
          </button>
        ))}
        <label className="flex h-7 w-16 items-center rounded-md border bg-background px-1.5 focus-within:ring-2 focus-within:ring-ring/50">
          <input className="w-full min-w-0 bg-transparent text-right text-xs tabular-nums outline-none" inputMode="decimal" aria-label="청산 비율" value={pct} onChange={(e) => setPct(e.target.value)} />
          <span className="text-xs text-muted-foreground">%</span>
        </label>
      </div>

      <p className="text-[11px] leading-relaxed text-muted-foreground">
        청산 규모 {fmtUsd(qty * (ref ?? pos.entry_price))} USDT
        {est !== null && (
          <>
            {" "}
            · 수수료 반영 예상 <span className={cn("font-semibold", est >= 0 ? "text-up" : "text-down")}>{est >= 0 ? "+" : ""}{fmtUsd(est)}</span>
          </>
        )}
      </p>
      {error && <p className="text-[11px] font-medium text-down">{error}</p>}

      <div className="flex gap-2">
        <Button className="flex-1" disabled={busy || !!error} onClick={() => (mode === "market" ? onMarket(p) : onLimit(p, limit))}>
          {mode === "market" ? `시장가 ${p || ""}% 청산` : `지정가 ${p || ""}% 청산 등록`}
        </Button>
        {onCancel && (
          <Button variant="outline" onClick={onCancel}>
            닫기
          </Button>
        )}
      </div>
    </div>
  );
}
