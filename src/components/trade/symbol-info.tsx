"use client";

import { useEffect, useState } from "react";
import { fmtPrice, symbolLabel } from "@/lib/trade";
import { cn } from "@/lib/utils";
import { connectStream } from "./use-price-feed";

type Info = {
  symbol: string;
  mark?: number;
  index?: number;
  funding?: number; // 비율 (0.0001 = 0.01%)
  nextFunding?: number; // ms
  high?: number;
  low?: number;
  volBase?: number;
  volQuote?: number;
  change?: number; // 24h 변동액
  changePct?: number;
  oi?: number; // 계약 수량(코인)
};

const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};
const compact = (n: number) =>
  n >= 1e6
    ? n.toLocaleString("en-US", { notation: "compact", maximumFractionDigits: 2 })
    : n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const countdown = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  const p = (x: number) => String(x).padStart(2, "0");
  return `${p(Math.floor(s / 3600))}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}`;
};

/** 선택한 종목의 Binance 선물 요약: 마크·지수·펀딩, 24시간 고저·거래량, 미결제약정 */
function useSymbolInfo(symbol: string) {
  const [info, setInfo] = useState<Info>({ symbol });

  useEffect(() => {
    const off = connectStream(`${symbol.toLowerCase()}@markPrice@1s/${symbol.toLowerCase()}@ticker`, (d) => {
      const e = d as Record<string, string> & { e?: string };
      if (e?.e === "markPriceUpdate") {
        setInfo((p) => ({ ...(p.symbol === symbol ? p : { symbol }), mark: num(e.p), index: num(e.i), funding: num(e.r), nextFunding: num(e.T) }));
      } else if (e?.e === "24hrTicker") {
        setInfo((p) => ({
          ...(p.symbol === symbol ? p : { symbol }),
          high: num(e.h), low: num(e.l), volBase: num(e.v), volQuote: num(e.q), change: num(e.p), changePct: num(e.P),
        }));
      }
    });
    return off;
  }, [symbol]);

  useEffect(() => {
    let dead = false;
    const load = () =>
      fetch(`https://fapi.binance.com/fapi/v1/openInterest?symbol=${symbol}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => {
          const oi = num(j?.openInterest);
          if (!dead && oi !== undefined) setInfo((p) => ({ ...(p.symbol === symbol ? p : { symbol }), oi }));
        })
        .catch(() => {});
    load();
    const t = setInterval(load, 15000);
    return () => {
      dead = true;
      clearInterval(t);
    };
  }, [symbol]);

  return info.symbol === symbol ? info : { symbol };
}

function Cell({ label, children, cls }: { label: string; children: React.ReactNode; cls?: string }) {
  return (
    <div className="flex shrink-0 flex-col gap-0.5 whitespace-nowrap">
      <span className="text-[10px] text-muted-foreground">{label}</span>
      <span className={cn("text-[11px] font-semibold tabular-nums", cls)}>{children}</span>
    </div>
  );
}

export function SymbolInfo({ symbol, mark }: { symbol: string; mark?: number }) {
  const i = useSymbolInfo(symbol);
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const base = symbolLabel(symbol);
  const price = mark ?? i.mark;
  const up = (i.changePct ?? 0) >= 0;
  const dash = "—";
  const oiUsdt = i.oi !== undefined && (i.mark ?? price) ? i.oi * (i.mark ?? price!) : undefined;

  return (
    <div className="notranslate flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b px-3 py-2.5 lg:flex-nowrap">
      <div className="flex shrink-0 items-center gap-2">
        <div>
          <p className="flex items-center gap-1 whitespace-nowrap text-sm font-bold leading-tight">
            {base}USDT
            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">Perp</span>
          </p>
        </div>
        <div className="flex flex-col leading-tight">
          <span className={cn("text-lg font-bold tabular-nums", up ? "text-up" : "text-down")}>{price ? fmtPrice(price) : dash}</span>
          {i.change !== undefined && i.changePct !== undefined && (
            <span className={cn("text-xs tabular-nums", up ? "text-up" : "text-down")}>
              {i.change >= 0 ? "+" : ""}{fmtPrice(i.change)} {i.changePct >= 0 ? "+" : ""}{i.changePct.toFixed(2)}%
            </span>
          )}
        </div>
      </div>
      <Cell label="마크">{i.mark ? fmtPrice(i.mark) : dash}</Cell>
      <Cell label="지수">{i.index ? fmtPrice(i.index) : dash}</Cell>
      <Cell label="펀딩비 / 카운트다운">
        {i.funding !== undefined ? (
          <>
            <span className={i.funding >= 0 ? "text-up" : "text-down"}>{(i.funding * 100).toFixed(5)}%</span>
            <span className="text-muted-foreground"> / </span>
            {i.nextFunding && now ? countdown(i.nextFunding - now) : dash}
          </>
        ) : (
          dash
        )}
      </Cell>
      <Cell label="고가(24h)">{i.high ? fmtPrice(i.high) : dash}</Cell>
      <Cell label="저가(24h)">{i.low ? fmtPrice(i.low) : dash}</Cell>
      <Cell label={`거래량(${base})`}>{i.volBase !== undefined ? compact(i.volBase) : dash}</Cell>
      <Cell label="거래대금(USDT)">{i.volQuote !== undefined ? compact(i.volQuote) : dash}</Cell>
      <Cell label="미결제약정">{oiUsdt !== undefined ? compact(oiUsdt) : dash}</Cell>
    </div>
  );
}
