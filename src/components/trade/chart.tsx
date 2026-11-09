"use client";

import { useEffect, useRef, useState } from "react";
import {
  CandlestickSeries,
  ColorType,
  LineStyle,
  createChart,
  type CandlestickData,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";
import { cn } from "@/lib/utils";
import { fmtUsd, unrealizedPnl, type Order, type Position } from "@/lib/trade";

const INTERVALS = ["1m", "5m", "15m", "1h", "4h", "1d"] as const;
const SECONDS: Record<string, number> = { "1m": 60, "5m": 300, "15m": 900, "1h": 3600, "4h": 14400, "1d": 86400 };

type Colors = { up: string; down: string; text: string };

/**
 * 캔들 차트. 과거 봉은 Binance REST, 마지막 봉은 실시간 시세로 갱신하고,
 * 내 포지션의 진입가·청산가·익절·손절과 미체결 주문을 가격선으로 표시합니다.
 */
export function PriceChart({ symbol, price, positions, orders }: { symbol: string; price?: number; positions: Position[]; orders: Order[] }) {
  const box = useRef<HTMLDivElement>(null);
  const chart = useRef<IChartApi | null>(null);
  const series = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const last = useRef<CandlestickData | null>(null);
  const colors = useRef<Colors>({ up: "#16a34a", down: "#dc2626", text: "#888" });
  const entryLines = useRef<{ line: IPriceLine; pos: Position }[]>([]);
  const lines = useRef<IPriceLine[]>([]);
  const [interval, setIntervalKey] = useState<(typeof INTERVALS)[number]>("15m");
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!box.current) return;
    const css = getComputedStyle(document.documentElement);
    colors.current = {
      up: css.getPropertyValue("--up").trim() || "#16a34a",
      down: css.getPropertyValue("--down").trim() || "#dc2626",
      text: css.getPropertyValue("--muted-foreground").trim() || "#888",
    };
    const { up, down, text } = colors.current;
    const c = createChart(box.current, {
      autoSize: true,
      layout: { background: { type: ColorType.Solid, color: "transparent" }, textColor: text, attributionLogo: false },
      grid: { vertLines: { color: "rgba(128,128,128,0.08)" }, horzLines: { color: "rgba(128,128,128,0.08)" } },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false, timeVisible: true },
    });
    chart.current = c;
    series.current = c.addSeries(CandlestickSeries, { upColor: up, downColor: down, borderVisible: false, wickUpColor: up, wickDownColor: down });
    return () => {
      c.remove();
      chart.current = null;
      series.current = null;
      lines.current = [];
      entryLines.current = [];
    };
  }, []);

  useEffect(() => {
    let alive = true;
    last.current = null;
    fetch(`https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=${interval}&limit=300`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((rows: [number, string, string, string, string][]) => {
        if (!alive || !series.current) return;
        const data: CandlestickData[] = rows.map((k) => ({
          time: Math.floor(k[0] / 1000) as UTCTimestamp,
          open: Number(k[1]),
          high: Number(k[2]),
          low: Number(k[3]),
          close: Number(k[4]),
        }));
        setError(false);
        series.current.setData(data);
        last.current = data[data.length - 1] ?? null;
        chart.current?.timeScale().fitContent();
      })
      .catch(() => alive && setError(true));
    return () => {
      alive = false;
    };
  }, [symbol, interval]);

  // 실시간 시세로 마지막 봉 갱신 (새 봉 구간이 시작되면 새 봉 생성)
  useEffect(() => {
    const cur = last.current;
    if (!price || !cur || !series.current) return;
    const step = SECONDS[interval];
    const bucket = (Math.floor(Date.now() / 1000 / step) * step) as UTCTimestamp;
    const next: CandlestickData =
      bucket > (cur.time as number)
        ? { time: bucket, open: price, high: price, low: price, close: price }
        : { ...cur, high: Math.max(cur.high, price), low: Math.min(cur.low, price), close: price };
    last.current = next;
    series.current.update(next);
  }, [price, interval]);

  // 포지션·주문 가격선 (목록이 바뀔 때만 다시 그림)
  useEffect(() => {
    const s = series.current;
    if (!s) return;
    const { up, down, text } = colors.current;
    const made: IPriceLine[] = [];
    const entries: { line: IPriceLine; pos: Position }[] = [];
    const add = (p: number, title: string, color: string, style: number, width: 1 | 2 = 1) =>
      s.createPriceLine({ price: p, color, lineWidth: width, lineStyle: style, axisLabelVisible: true, title });

    for (const pos of positions) {
      const c = pos.side === "long" ? up : down;
      const line = add(pos.entry_price, `${pos.side === "long" ? "롱" : "숏"} ${pos.leverage}x`, c, LineStyle.Solid, 2);
      made.push(line);
      entries.push({ line, pos });
      made.push(add(pos.liq_price, "청산가", down, LineStyle.Dashed));
      if (pos.tp) made.push(add(pos.tp, "익절", up, LineStyle.Dashed));
      if (pos.sl) made.push(add(pos.sl, "손절", down, LineStyle.Dashed));
    }
    for (const o of orders) {
      made.push(add(o.price, `미체결 ${o.side === "long" ? "롱" : "숏"}`, text, LineStyle.Dotted));
      if (o.tp) made.push(add(o.tp, "익절(예약)", up, LineStyle.SparseDotted));
      if (o.sl) made.push(add(o.sl, "손절(예약)", down, LineStyle.SparseDotted));
    }
    lines.current = made;
    entryLines.current = entries;
    return () => {
      for (const l of made) s.removePriceLine(l);
      lines.current = [];
      entryLines.current = [];
    };
  }, [positions, orders, symbol]);

  // 진입선 라벨에 실시간 손익 표시
  useEffect(() => {
    if (!price) return;
    for (const { line, pos } of entryLines.current) {
      const pnl = unrealizedPnl(pos, price);
      line.applyOptions({ title: `${pos.side === "long" ? "롱" : "숏"} ${pos.leverage}x  ${pnl >= 0 ? "+" : ""}${fmtUsd(pnl)}` });
    }
  }, [price, positions]);

  return (
    <div className="flex h-full flex-col p-2">
      <div className="mb-2 flex gap-1">
        {INTERVALS.map((i) => (
          <button
            key={i}
            type="button"
            onClick={() => setIntervalKey(i)}
            className={cn(
              "rounded-md px-2 py-1 text-xs font-medium transition-colors",
              i === interval ? "bg-brand-soft text-brand" : "text-muted-foreground hover:bg-muted",
            )}
          >
            {i}
          </button>
        ))}
      </div>
      <div className="relative min-h-0 flex-1">
        <div ref={box} className="absolute inset-0" />
        {error && <p className="absolute inset-0 grid place-items-center text-sm text-muted-foreground">차트 데이터를 불러오지 못했습니다.</p>}
      </div>
    </div>
  );
}
