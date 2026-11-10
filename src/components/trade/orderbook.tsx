"use client";

import { useEffect, useRef, useState } from "react";
import { fmtPrice } from "@/lib/trade";
import { cn } from "@/lib/utils";
import { TradesList } from "./trades-list";

type Level = [number, number]; // [가격, 수량]
const MAX_ROWS = 20;
const ROW_H = 22; // 호가 한 줄 높이(px)
const MID_H = 48; // 가운데 현재가 줄(여백 포함)

/** Binance 선물 호가창 (상위 20호가 스냅샷을 100ms 단위로 수신) */
function useDepth(symbol: string) {
  const [book, setBook] = useState<{ symbol: string; bids: Level[]; asks: Level[] } | null>(null);

  useEffect(() => {
    let ws: WebSocket | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;
    let closed = false;
    let attempt = 0;
    const parse = (rows: [string, string][]): Level[] => rows.map(([p, q]) => [Number(p), Number(q)]);

    const connect = () => {
      ws = new WebSocket(`wss://fstream.binance.com/ws/${symbol.toLowerCase()}@depth20@100ms`);
      ws.onopen = () => (attempt = 0);
      ws.onmessage = (e) => {
        try {
          const d = JSON.parse(e.data as string) as { b: [string, string][]; a: [string, string][] };
          setBook({ symbol, bids: parse(d.b), asks: parse(d.a) });
        } catch {
          /* 무시 */
        }
      };
      ws.onclose = () => {
        if (!closed) retry = setTimeout(connect, Math.min(1000 * 2 ** attempt++, 15000));
      };
      ws.onerror = () => ws?.close();
    };
    connect();
    return () => {
      closed = true;
      if (retry) clearTimeout(retry);
      ws?.close();
    };
  }, [symbol]);

  // 종목을 바꾼 직후에는 이전 종목 데이터를 숨깁니다.
  return book?.symbol === symbol ? book : null;
}

const fmtQty = (n: number) => (n >= 100 ? n.toFixed(1) : n >= 1 ? n.toFixed(3) : n.toFixed(4));

export function OrderBook({ symbol, mark, onPick }: { symbol: string; mark?: number; onPick: (price: number) => void }) {
  const book = useDepth(symbol);
  const [tab, setTab] = useState<"book" | "trades">("book");
  // 칸 높이에 맞춰 보여줄 호가 줄 수를 정해, 아래쪽이 잘리지 않게 합니다.
  const loading = book === null;
  const bodyRef = useRef<HTMLDivElement>(null);
  const [rows, setRows] = useState(MAX_ROWS);
  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    const fit = () => setRows(Math.max(2, Math.min(MAX_ROWS, Math.floor((el.clientHeight - MID_H) / (2 * ROW_H)))));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [loading, tab]);

  const asks = (book?.asks ?? []).slice(0, rows); // 낮은 가격부터
  const bids = (book?.bids ?? []).slice(0, rows); // 높은 가격부터
  const max = Math.max(1, ...asks.map((l) => l[1]), ...bids.map((l) => l[1]));
  const spread = asks[0] && bids[0] ? asks[0][0] - bids[0][0] : null;

  // 현재가 대비 그 호가까지 가격이 움직여야 하는 비율(%)
  const ref = mark ?? (asks[0] && bids[0] ? (asks[0][0] + bids[0][0]) / 2 : 0);
  const pct = (p: number) => {
    if (!ref) return "";
    const v = ((p - ref) / ref) * 100;
    return `${v >= 0 ? "+" : ""}${v.toFixed(Math.abs(v) < 0.1 ? 3 : 2)}%`;
  };

  const row = (l: Level, side: "ask" | "bid") => (
    <button
      key={`${side}${l[0]}`}
      type="button"
      onClick={() => onPick(l[0])}
      className="notranslate relative grid w-full grid-cols-[1fr_auto_1fr] gap-2 px-2 py-[3px] text-xs tabular-nums hover:bg-muted"
    >
      <span
        aria-hidden
        className={cn("absolute inset-y-0 right-0", side === "ask" ? "bg-down/10" : "bg-up/10")}
        style={{ width: `${(l[1] / max) * 100}%` }}
      />
      <span className={cn("relative text-left", side === "ask" ? "text-down" : "text-up")}>{fmtPrice(l[0])}</span>
      <span className={cn("relative text-right text-[11px]", side === "ask" ? "text-down" : "text-up")}>{pct(l[0])}</span>
      <span className="relative text-right">{fmtQty(l[1])}</span>
    </button>
  );

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border bg-card shadow-xs">
      <div role="tablist" className="flex gap-4 border-b px-3">
        {([["book", "호가창"], ["trades", "체결"]] as const).map(([k, t]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
            className={cn("-mb-px border-b-2 py-2 text-sm font-semibold", tab === k ? "border-brand text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>
            {t}
          </button>
        ))}
      </div>
      {tab === "trades" ? (
        <TradesList symbol={symbol} />
      ) : (
      <>
      <div className="grid grid-cols-[1fr_auto_1fr] gap-2 px-2 py-1.5 text-[11px] text-muted-foreground">
        <span>가격(USDT)</span>
        <span className="text-right">현재가 대비</span>
        <span className="text-right">수량</span>
      </div>
      {!book ? (
        <p className="grid flex-1 place-items-center py-16 text-xs text-muted-foreground">호가 불러오는 중…</p>
      ) : (
        <div ref={bodyRef} className="flex min-h-0 flex-1 flex-col justify-center overflow-hidden">
          <div className="flex flex-col-reverse">{asks.map((l) => row(l, "ask"))}</div>
          <div className="notranslate my-1 flex items-baseline justify-between border-y px-2 py-1.5">
            <span className="text-base font-bold tabular-nums">{mark ? fmtPrice(mark) : "—"}</span>
            {spread !== null && <span className="text-[11px] text-muted-foreground tabular-nums">스프레드 {fmtPrice(spread)}</span>}
          </div>
          <div>{bids.map((l) => row(l, "bid"))}</div>
        </div>
      )}
      <p className="px-3 py-1.5 text-[10px] text-muted-foreground">가격을 누르면 지정가로 채워집니다.</p>
      </>
      )}
    </div>
  );
}
