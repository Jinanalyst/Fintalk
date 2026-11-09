"use client";

import { useEffect, useState } from "react";
import { SYMBOLS } from "@/lib/trade";

/** Binance 선물 공개 WebSocket 으로 실시간 시세(마지막 체결가)를 받습니다. 끊기면 자동 재연결. */
export function usePriceFeed(initial: Record<string, number>) {
  const [prices, setPrices] = useState<Record<string, number>>(initial);
  const [live, setLive] = useState(false);

  useEffect(() => {
    let ws: WebSocket | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;
    let closed = false;
    let attempt = 0;

    const connect = () => {
      const streams = SYMBOLS.map((s) => `${s.symbol.toLowerCase()}@aggTrade`).join("/");
      ws = new WebSocket(`wss://fstream.binance.com/market/stream?streams=${streams}`);
      ws.onopen = () => {
        attempt = 0;
        setLive(true);
      };
      ws.onmessage = (e) => {
        try {
          const d = JSON.parse(e.data as string).data as { s: string; p: string };
          const p = Number(d.p);
          if (d?.s && p > 0) setPrices((prev) => (prev[d.s] === p ? prev : { ...prev, [d.s]: p }));
        } catch {
          /* 무시 */
        }
      };
      ws.onclose = () => {
        setLive(false);
        if (closed) return;
        retry = setTimeout(connect, Math.min(1000 * 2 ** attempt++, 15000));
      };
      ws.onerror = () => ws?.close();
    };
    connect();

    return () => {
      closed = true;
      if (retry) clearTimeout(retry);
      ws?.close();
    };
  }, []);

  return { prices, live };
}
