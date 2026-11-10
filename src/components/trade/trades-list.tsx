"use client";

import { useEffect, useState } from "react";
import { fmtPrice } from "@/lib/trade";
import { cn } from "@/lib/utils";
import { connectStream } from "./use-price-feed";

type Fill = { id: number; price: number; qty: number; time: number; sell: boolean };
const MAX = 60;

const fmtQty = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(2)}K` : n >= 100 ? n.toFixed(1) : n >= 1 ? n.toFixed(3) : n.toFixed(4));
const fmtTime = (t: number) => new Date(t).toLocaleTimeString("en-GB", { hour12: false });

/** Binance 선물 실시간 체결 내역 (aggTrade). 최신 체결이 위에 쌓입니다. */
export function TradesList({ symbol }: { symbol: string }) {
  const [state, setState] = useState<{ symbol: string; fills: Fill[] }>({ symbol, fills: [] });

  useEffect(() => {
    return connectStream(`${symbol.toLowerCase()}@aggTrade`, (d) => {
      const t = d as { a: number; p: string; q: string; T: number; m: boolean };
      if (!t?.p) return;
      // m = true 이면 매수자가 메이커 → 시장가 매도 체결
      const f: Fill = { id: t.a, price: Number(t.p), qty: Number(t.q), time: t.T, sell: t.m };
      setState((prev) => ({ symbol, fills: [f, ...(prev.symbol === symbol ? prev.fills : [])].slice(0, MAX) }));
    });
  }, [symbol]);

  const fills = state.symbol === symbol ? state.fills : [];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="grid grid-cols-3 gap-2 px-2 py-1.5 text-[11px] text-muted-foreground">
        <span>가격(USDT)</span>
        <span className="text-right">수량</span>
        <span className="text-right">시간</span>
      </div>
      {fills.length === 0 ? (
        <p className="grid flex-1 place-items-center py-16 text-xs text-muted-foreground">체결 불러오는 중…</p>
      ) : (
        <ul className="notranslate min-h-0 flex-1 overflow-y-auto">
          {fills.map((f) => (
            <li key={f.id} className="grid grid-cols-3 gap-2 px-2 py-[3px] text-xs tabular-nums">
              <span className={f.sell ? "text-down" : "text-up"}>{fmtPrice(f.price)}</span>
              <span className={cn("text-right")}>{fmtQty(f.qty)}</span>
              <span className="text-right text-muted-foreground">{fmtTime(f.time)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
