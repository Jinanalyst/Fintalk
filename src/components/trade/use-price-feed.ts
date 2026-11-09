"use client";

import { useEffect, useState } from "react";
import { isSymbol } from "@/lib/trade";

const BASE = "wss://fstream.binance.com/market/stream?streams=";

/** 바이낸스 선물 공개 WebSocket 을 연결합니다. 끊기면 자동 재연결(점점 길어지는 간격). */
function connectStream(streams: string, onData: (d: unknown) => void, onLive?: (v: boolean) => void) {
  let ws: WebSocket | null = null;
  let retry: ReturnType<typeof setTimeout> | null = null;
  let closed = false;
  let attempt = 0;
  const connect = () => {
    ws = new WebSocket(BASE + streams);
    ws.onopen = () => {
      attempt = 0;
      onLive?.(true);
    };
    ws.onmessage = (e) => {
      try {
        onData(JSON.parse(e.data as string).data);
      } catch {
        /* 무시 */
      }
    };
    ws.onclose = () => {
      onLive?.(false);
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
}

/**
 * 실시간 시세. 전 종목은 1초 간격(!miniTicker@arr)으로, 지금 보는 종목은 체결 단위(aggTrade)로 받아 더 빠르게 갱신합니다.
 */
export function usePriceFeed(initial: Record<string, number>, symbol: string) {
  const [prices, setPrices] = useState<Record<string, number>>(initial);
  const [live, setLive] = useState(false);

  useEffect(() => {
    return connectStream(
      "!miniTicker@arr",
      (d) => {
        if (!Array.isArray(d)) return;
        const next: Record<string, number> = {};
        for (const t of d as { s: string; c: string }[]) {
          const p = Number(t.c);
          if (isSymbol(t.s) && p > 0) next[t.s] = p;
        }
        setPrices((prev) => ({ ...prev, ...next }));
      },
      setLive,
    );
  }, []);

  useEffect(() => {
    return connectStream(`${symbol.toLowerCase()}@aggTrade`, (d) => {
      const t = d as { s: string; p: string };
      const p = Number(t?.p);
      if (t?.s && p > 0) setPrices((prev) => (prev[t.s] === p ? prev : { ...prev, [t.s]: p }));
    });
  }, [symbol]);

  return { prices, live };
}
