"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AreaSeries,
  CandlestickSeries,
  ColorType,
  HistogramSeries,
  LineSeries,
  LineStyle,
  createChart,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type SeriesType,
  type UTCTimestamp,
} from "lightweight-charts";
import { cn } from "@/lib/utils";
import { calcAll, heikinAshi, type Calc, type Candle } from "@/lib/indicators";
import { fmtPrice, fmtUsd, unrealizedPnl, type Order, type Position } from "@/lib/trade";

const INTERVALS = ["1m", "5m", "15m", "1h", "4h", "1d"] as const;
const SECONDS: Record<string, number> = { "1m": 60, "5m": 300, "15m": 900, "1h": 3600, "4h": 14400, "1d": 86400 };
const FIRST_LOAD = 1500; // Binance klines 1회 최대치
const OLDER_LOAD = 1000;
const MAX_CANDLES = 8000;

const KINDS = [
  ["candle", "캔들"],
  ["ha", "하이킨아시"],
  ["line", "라인"],
  ["area", "면적"],
] as const;
type Kind = (typeof KINDS)[number][0];

const INDS = [
  ["vol", "거래량"],
  ["ma", "MA"],
  ["ema", "EMA"],
  ["boll", "BOLL"],
  ["rsi", "RSI"],
  ["macd", "MACD"],
] as const;
type Ind = (typeof INDS)[number][0];

const TOOLS = [
  ["hline", "수평선"],
  ["trend", "추세선"],
  ["ruler", "자"],
] as const;
type Tool = (typeof TOOLS)[number][0];

type Colors = { up: string; down: string; text: string };
type Pt = { time: UTCTimestamp; value: number; color?: string };
type Spec = {
  key: string;
  ind: Ind;
  type: "line" | "hist";
  pane: "main" | "rsi" | "macd";
  options: Record<string, unknown>;
  point: (i: number, c: Candle[], k: Calc, col: Colors) => Pt | null;
};
type Drawing = { kind: "h"; price: number } | { kind: "t"; a: { time: number; price: number }; b: { time: number; price: number } };
type Kline = [number, string, string, string, string, string];

const alpha = (hex: string, a: number) => (/^#[0-9a-f]{6}$/i.test(hex) ? hex + Math.round(a * 255).toString(16).padStart(2, "0") : hex);
const parseKlines = (rows: Kline[]): Candle[] =>
  rows.map((k) => ({ time: Math.floor(k[0] / 1000), open: Number(k[1]), high: Number(k[2]), low: Number(k[3]), close: Number(k[4]), volume: Number(k[5]) }));

function specs(): Spec[] {
  const line = (key: string, ind: Ind, pane: Spec["pane"], pick: (k: Calc) => (number | null)[], color: string, extra: Record<string, unknown> = {}): Spec => ({
    key,
    ind,
    pane,
    type: "line",
    options: { color, lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false, ...extra },
    point: (i, c, k) => {
      const v = pick(k)[i];
      return v === null || v === undefined ? null : { time: c[i].time as UTCTimestamp, value: v };
    },
  });
  return [
    {
      key: "vol",
      ind: "vol",
      pane: "main",
      type: "hist",
      options: { priceFormat: { type: "volume" }, priceScaleId: "vol", priceLineVisible: false, lastValueVisible: false },
      point: (i, c, _k, col) => ({ time: c[i].time as UTCTimestamp, value: c[i].volume, color: alpha(c[i].close >= c[i].open ? col.up : col.down, 0.45) }),
    },
    line("ma20", "ma", "main", (k) => k.ma20, "#f0b90b"),
    line("ma60", "ma", "main", (k) => k.ma60, "#a855f7"),
    line("ema12", "ema", "main", (k) => k.ema12, "#3b82f6"),
    line("ema26", "ema", "main", (k) => k.ema26, "#f97316"),
    line("bbUp", "boll", "main", (k) => k.bbUp, "#60a5fa", { lineStyle: LineStyle.Dashed }),
    line("bbMid", "boll", "main", (k) => k.bbMid, "#9ca3af"),
    line("bbLow", "boll", "main", (k) => k.bbLow, "#60a5fa", { lineStyle: LineStyle.Dashed }),
    line("rsi", "rsi", "rsi", (k) => k.rsi, "#a855f7", { lastValueVisible: true }),
    {
      key: "macdHist",
      ind: "macd",
      pane: "macd",
      type: "hist",
      options: { priceLineVisible: false, lastValueVisible: false },
      point: (i, c, k, col) => {
        const v = k.macdHist[i];
        return v === null || v === undefined ? null : { time: c[i].time as UTCTimestamp, value: v, color: alpha(v >= 0 ? col.up : col.down, 0.7) };
      },
    },
    line("macd", "macd", "macd", (k) => k.macd, "#3b82f6"),
    line("macdSig", "macd", "macd", (k) => k.macdSignal, "#f97316"),
  ];
}

type DragLine = { line: IPriceLine; pos: Position; kind: "tp" | "sl" };

/**
 * 캔들 차트. 과거 봉은 Binance REST(스크롤하면 더 과거를 이어서 불러옴), 마지막 봉은 실시간 시세로 갱신합니다.
 * - 보조지표(거래량·MA·EMA·볼린저·RSI·MACD)와 차트 형태(캔들·하이킨아시·라인·면적)
 * - 내 포지션의 진입가·청산가·익절·손절과 미체결 주문을 가격선으로 표시 (익절·손절 선은 끌어서 수정)
 * - 그리기 도구: 수평선·추세선·자
 */
export function PriceChart({
  symbol,
  price,
  positions,
  orders,
  onTpSl,
}: {
  symbol: string;
  price?: number;
  positions: Position[];
  orders: Order[];
  onTpSl?: (id: string, tp: number | null, sl: number | null) => Promise<unknown>;
}) {
  const box = useRef<HTMLDivElement>(null);
  const chart = useRef<IChartApi | null>(null);
  const candles = useRef<Candle[]>([]);
  const colors = useRef<Colors>({ up: "#16a34a", down: "#dc2626", text: "#888" });
  const main = useRef<ISeriesApi<SeriesType> | null>(null);
  const aux = useRef<{ series: ISeriesApi<SeriesType>; spec: Spec }[]>([]);
  const lineRefs = useRef<IPriceLine[]>([]);
  const entryLines = useRef<{ line: IPriceLine; pos: Position }[]>([]);
  const dragLines = useRef<DragLine[]>([]);
  const overlay = useRef({ positions, orders });
  const fitNext = useRef(false);
  const keepRange = useRef<{ from: unknown; to: unknown } | null>(null);
  const hasMore = useRef(true);
  const loadingOld = useRef(false);
  const symRef = useRef(symbol);
  const onTpSlRef = useRef(onTpSl);
  const drawings = useRef<Drawing[]>([]);
  const drawn = useRef<{ lines: IPriceLine[]; series: ISeriesApi<SeriesType>[] }>({ lines: [], series: [] });
  const toolRef = useRef<Tool | null>(null);
  const pendingPt = useRef<{ time: number; price: number } | null>(null);
  const ruler = useRef<{ a: { time: number; price: number }; b: { time: number; price: number }; series: ISeriesApi<SeriesType> | null } | null>(null);

  const [interval, setIntervalKey] = useState<(typeof INTERVALS)[number]>("15m");
  const intervalRef = useRef(interval);
  const [kind, setKind] = useState<Kind>("candle");
  const [inds, setInds] = useState<Ind[]>(["vol", "ma"]);
  const [version, setVersion] = useState(0); // 캔들 데이터가 바뀔 때마다 증가
  const [error, setError] = useState(false);
  const [tool, setTool] = useState<Tool | null>(null);
  const [rulerText, setRulerText] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);

  useEffect(() => {
    symRef.current = symbol;
    intervalRef.current = interval;
    onTpSlRef.current = onTpSl;
    toolRef.current = tool;
  });

  /** 포지션·주문 가격선을 현재 메인 시리즈에 다시 그립니다. */
  const drawLines = useCallback(() => {
    const s = main.current;
    for (const l of lineRefs.current) {
      try {
        s?.removePriceLine(l);
      } catch {
        /* 시리즈와 함께 이미 사라진 선 */
      }
    }
    lineRefs.current = [];
    entryLines.current = [];
    dragLines.current = [];
    if (!s) return;
    const { up, down, text } = colors.current;
    const add = (p: number, title: string, color: string, style: number, width: 1 | 2 = 1) => {
      const l = s.createPriceLine({ price: p, color, lineWidth: width, lineStyle: style, axisLabelVisible: true, title });
      lineRefs.current.push(l);
      return l;
    };
    for (const pos of overlay.current.positions) {
      const line = add(pos.entry_price, `${pos.side === "long" ? "롱" : "숏"} ${pos.leverage}x`, pos.side === "long" ? up : down, LineStyle.Solid, 2);
      entryLines.current.push({ line, pos });
      add(pos.liq_price, "청산가", down, LineStyle.Dashed);
      if (pos.tp) dragLines.current.push({ line: add(pos.tp, "익절 ↕", up, LineStyle.Dashed), pos, kind: "tp" });
      if (pos.sl) dragLines.current.push({ line: add(pos.sl, "손절 ↕", down, LineStyle.Dashed), pos, kind: "sl" });
    }
    for (const o of overlay.current.orders) {
      add(o.price, `미체결 ${o.side === "long" ? "롱" : "숏"}`, text, LineStyle.Dotted);
      if (o.tp) add(o.tp, "익절(예약)", up, LineStyle.SparseDotted);
      if (o.sl) add(o.sl, "손절(예약)", down, LineStyle.SparseDotted);
    }
  }, []);

  /** 그리기 도구로 만든 선을 다시 그립니다. (시리즈를 새로 만든 뒤에도 유지) */
  const drawDrawings = useCallback(() => {
    const c = chart.current;
    const s = main.current;
    for (const l of drawn.current.lines) {
      try {
        s?.removePriceLine(l);
      } catch {
        /* 무시 */
      }
    }
    for (const x of drawn.current.series) {
      try {
        c?.removeSeries(x);
      } catch {
        /* 무시 */
      }
    }
    drawn.current = { lines: [], series: [] };
    if (!c || !s) return;
    const segment = (a: { time: number; price: number }, b: { time: number; price: number }, color: string, style: number) => {
      if (a.time === b.time) return null;
      const [p, q] = a.time < b.time ? [a, b] : [b, a];
      const ls = c.addSeries(LineSeries, { color, lineWidth: 2, lineStyle: style, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
      ls.setData([
        { time: p.time as UTCTimestamp, value: p.price },
        { time: q.time as UTCTimestamp, value: q.price },
      ]);
      drawn.current.series.push(ls);
      return ls;
    };
    for (const d of drawings.current) {
      if (d.kind === "h") drawn.current.lines.push(s.createPriceLine({ price: d.price, color: "#f0b90b", lineWidth: 1, lineStyle: LineStyle.Solid, axisLabelVisible: true, title: "" }));
      else segment(d.a, d.b, "#f0b90b", LineStyle.Solid);
    }
    if (ruler.current) {
      const { a, b } = ruler.current;
      ruler.current.series = segment(a, b, b.price >= a.price ? colors.current.up : colors.current.down, LineStyle.Dashed);
    }
  }, []);

  /** 스크롤로 왼쪽 끝에 닿으면 더 과거 봉을 이어서 불러옵니다. */
  const loadOlder = useCallback(async () => {
    const c = chart.current;
    if (loadingOld.current || !hasMore.current || !c || !candles.current.length || candles.current.length >= MAX_CANDLES) return;
    loadingOld.current = true;
    const sym = symRef.current;
    const itv = intervalRef.current;
    try {
      const end = candles.current[0].time * 1000 - 1;
      const res = await fetch(`https://fapi.binance.com/fapi/v1/klines?symbol=${sym}&interval=${itv}&endTime=${end}&limit=${OLDER_LOAD}`);
      if (!res.ok) throw new Error();
      const older = parseKlines((await res.json()) as Kline[]);
      if (sym !== symRef.current || itv !== intervalRef.current) return; // 그 사이 종목·주기가 바뀜
      if (older.length < OLDER_LOAD) hasMore.current = false;
      if (older.length) {
        keepRange.current = c.timeScale().getVisibleRange();
        candles.current = [...older, ...candles.current];
        setVersion((v) => v + 1);
      }
    } catch {
      /* 다음 스크롤 때 다시 시도 */
    } finally {
      loadingOld.current = false;
    }
  }, []);

  // 차트 생성 + 이벤트 연결
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const css = getComputedStyle(document.documentElement);
    colors.current = {
      up: css.getPropertyValue("--up").trim() || "#16a34a",
      down: css.getPropertyValue("--down").trim() || "#dc2626",
      text: css.getPropertyValue("--muted-foreground").trim() || "#888",
    };
    const c = createChart(el, {
      autoSize: true,
      layout: { background: { type: ColorType.Solid, color: "transparent" }, textColor: colors.current.text, attributionLogo: false },
      grid: { vertLines: { color: "rgba(128,128,128,0.08)" }, horzLines: { color: "rgba(128,128,128,0.08)" } },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false, timeVisible: true },
    });
    chart.current = c;

    c.timeScale().subscribeVisibleLogicalRangeChange((r) => {
      if (r && r.from < 30) void loadOlder();
    });

    // 그리기 도구: 차트 클릭
    c.subscribeClick((param) => {
      const t = toolRef.current;
      const s = main.current;
      if (!t || !s || !param.point || param.time === undefined) return;
      const p = s.coordinateToPrice(param.point.y);
      if (p === null) return;
      const pt = { time: param.time as number, price: p as number };
      if (t === "hline") {
        drawings.current.push({ kind: "h", price: pt.price });
        drawDrawings();
        setTool(null);
        setHint(null);
        return;
      }
      if (!pendingPt.current) {
        pendingPt.current = pt;
        setHint("두 번째 점을 클릭하세요");
        return;
      }
      const a = pendingPt.current;
      pendingPt.current = null;
      setHint(null);
      if (t === "trend") drawings.current.push({ kind: "t", a, b: pt });
      else {
        ruler.current = { a, b: pt, series: null };
        const diff = pt.price - a.price;
        const bars = Math.round((pt.time - a.time) / SECONDS[intervalRef.current]);
        setRulerText(`${diff >= 0 ? "+" : ""}${fmtPrice(diff)} (${diff >= 0 ? "+" : ""}${((diff / a.price) * 100).toFixed(2)}%) · ${Math.abs(bars)}봉`);
      }
      drawDrawings();
      setTool(null);
    });

    // 익절·손절 선 끌기
    let drag: DragLine | null = null;
    const yOf = (e: PointerEvent) => e.clientY - el.getBoundingClientRect().top;
    const hit = (y: number) => {
      const s = main.current;
      if (!s) return null;
      for (const d of dragLines.current) {
        const ly = s.priceToCoordinate(d.line.options().price);
        if (ly !== null && Math.abs(ly - y) <= 6) return d;
      }
      return null;
    };
    const down = (e: PointerEvent) => {
      if (toolRef.current || !onTpSlRef.current) return;
      const h = hit(yOf(e));
      if (!h) return;
      drag = h;
      e.stopPropagation();
      e.preventDefault();
      el.setPointerCapture(e.pointerId);
      c.applyOptions({ handleScroll: false, handleScale: false });
    };
    const move = (e: PointerEvent) => {
      const s = main.current;
      if (!s) return;
      if (drag) {
        const p = s.coordinateToPrice(yOf(e));
        if (p !== null && p > 0) drag.line.applyOptions({ price: p as number });
        return;
      }
      el.style.cursor = !toolRef.current && onTpSlRef.current && hit(yOf(e)) ? "ns-resize" : toolRef.current ? "crosshair" : "";
    };
    const up = () => {
      if (!drag) return;
      const d = drag;
      drag = null;
      c.applyOptions({ handleScroll: true, handleScale: true });
      const np = d.line.options().price;
      const changed = np !== (d.kind === "tp" ? d.pos.tp : d.pos.sl);
      const done = changed ? onTpSlRef.current?.(d.pos.id, d.kind === "tp" ? np : d.pos.tp, d.kind === "sl" ? np : d.pos.sl) : null;
      // 서버가 거절하면 원래 위치로 되돌리기 위해 다시 그림
      void Promise.resolve(done).finally(() => drawLines());
    };
    el.addEventListener("pointerdown", down, true);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);

    return () => {
      el.removeEventListener("pointerdown", down, true);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
      c.remove();
      chart.current = null;
      main.current = null;
      aux.current = [];
      lineRefs.current = [];
      entryLines.current = [];
      dragLines.current = [];
      drawn.current = { lines: [], series: [] };
    };
  }, [drawLines, drawDrawings, loadOlder]);

  // 캔들 데이터 받기 (종목·주기가 바뀌면 처음부터)
  useEffect(() => {
    let alive = true;
    hasMore.current = true;
    keepRange.current = null;
    fetch(`https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=${interval}&limit=${FIRST_LOAD}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((rows: Kline[]) => {
        if (!alive) return;
        candles.current = parseKlines(rows);
        fitNext.current = true;
        setError(false);
        setVersion((v) => v + 1);
      })
      .catch(() => alive && setError(true));
    return () => {
      alive = false;
    };
  }, [symbol, interval]);

  // 종목·주기가 바뀌면 그리기 도구 초기화 (가격대가 달라 의미가 없음)
  useEffect(() => {
    drawings.current = [];
    ruler.current = null;
    pendingPt.current = null;
  }, [symbol, interval]);

  // 시리즈 구성: 차트 형태·지표·데이터가 바뀔 때 전부 새로 만듭니다.
  useEffect(() => {
    const c = chart.current;
    const data = candles.current;
    if (!c || !data.length) return;
    const col = colors.current;

    for (const x of drawn.current.series) {
      try {
        c.removeSeries(x);
      } catch {
        /* 무시 */
      }
    }
    drawn.current = { lines: [], series: [] };
    if (main.current) c.removeSeries(main.current);
    for (const a of aux.current) c.removeSeries(a.series);
    aux.current = [];

    const shown = kind === "ha" ? heikinAshi(data) : data;
    let m: ISeriesApi<SeriesType>;
    if (kind === "candle" || kind === "ha") {
      const s = c.addSeries(CandlestickSeries, { upColor: col.up, downColor: col.down, borderVisible: false, wickUpColor: col.up, wickDownColor: col.down });
      s.setData(shown.map((x) => ({ time: x.time as UTCTimestamp, open: x.open, high: x.high, low: x.low, close: x.close })));
      m = s;
    } else if (kind === "line") {
      const s = c.addSeries(LineSeries, { color: "#2563eb", lineWidth: 2 });
      s.setData(data.map((x) => ({ time: x.time as UTCTimestamp, value: x.close })));
      m = s;
    } else {
      const s = c.addSeries(AreaSeries, { lineColor: "#2563eb", topColor: "rgba(37,99,235,0.3)", bottomColor: "rgba(37,99,235,0)", lineWidth: 2 });
      s.setData(data.map((x) => ({ time: x.time as UTCTimestamp, value: x.close })));
      m = s;
    }
    main.current = m;

    const calc = calcAll(data);
    const paneIndex = { main: 0, rsi: inds.includes("rsi") ? 1 : -1, macd: inds.includes("macd") ? (inds.includes("rsi") ? 2 : 1) : -1 };
    for (const spec of specs()) {
      if (!inds.includes(spec.ind)) continue;
      const s = c.addSeries(spec.type === "hist" ? HistogramSeries : LineSeries, spec.options as never, paneIndex[spec.pane]) as ISeriesApi<SeriesType>;
      const pts: Pt[] = [];
      for (let i = 0; i < data.length; i++) {
        const p = spec.point(i, data, calc, col);
        if (p) pts.push(p);
      }
      s.setData(pts as never);
      aux.current.push({ series: s, spec });
      if (spec.ind === "rsi") {
        s.createPriceLine({ price: 70, color: "rgba(128,128,128,0.5)", lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: false, title: "" });
        s.createPriceLine({ price: 30, color: "rgba(128,128,128,0.5)", lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: false, title: "" });
      }
    }
    if (inds.includes("vol")) c.priceScale("vol").applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });

    c.panes().forEach((p, i) => p.setStretchFactor(i === 0 ? 4 : 1.2));
    if (fitNext.current) {
      c.timeScale().fitContent();
      fitNext.current = false;
    } else if (keepRange.current) {
      // 과거 봉이 앞에 붙어도 보던 구간이 그대로 보이게 함
      c.timeScale().setVisibleRange(keepRange.current as never);
      keepRange.current = null;
    }
    drawLines();
    drawDrawings();
  }, [kind, inds, version, drawLines, drawDrawings]);

  // 포지션·주문이 바뀌면 가격선 갱신
  useEffect(() => {
    overlay.current = { positions, orders };
    drawLines();
  }, [positions, orders, symbol, drawLines]);

  // 실시간 시세로 마지막 봉과 지표 갱신 (새 봉 구간이 시작되면 새 봉 생성)
  useEffect(() => {
    const data = candles.current;
    const m = main.current;
    if (!price || !data.length || !m) return;
    const step = SECONDS[interval];
    const bucket = Math.floor(Date.now() / 1000 / step) * step;
    const cur = data[data.length - 1];
    if (bucket > cur.time) data.push({ time: bucket, open: price, high: price, low: price, close: price, volume: 0 });
    else data[data.length - 1] = { ...cur, high: Math.max(cur.high, price), low: Math.min(cur.low, price), close: price };

    const i = data.length - 1;
    const x = (kind === "ha" ? heikinAshi(data) : data)[i];
    if (kind === "candle" || kind === "ha") m.update({ time: x.time as UTCTimestamp, open: x.open, high: x.high, low: x.low, close: x.close } as never);
    else m.update({ time: x.time as UTCTimestamp, value: x.close } as never);

    if (aux.current.length) {
      const calc = calcAll(data);
      for (const a of aux.current) {
        const p = a.spec.point(i, data, calc, colors.current);
        if (p) a.series.update(p as never);
      }
    }
    for (const { line, pos } of entryLines.current) {
      const pnl = unrealizedPnl(pos, price);
      line.applyOptions({ title: `${pos.side === "long" ? "롱" : "숏"} ${pos.leverage}x  ${pnl >= 0 ? "+" : ""}${fmtUsd(pnl)}` });
    }
  }, [price, interval, kind]);

  const toggle = (k: Ind) => setInds((cur) => (cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k]));
  const pickTool = (t: Tool) => {
    pendingPt.current = null;
    if (t === "ruler") {
      ruler.current = null;
      setRulerText(null);
      drawDrawings();
    }
    setTool((cur) => (cur === t ? null : t));
    setHint(tool === t ? null : t === "hline" ? "차트를 클릭해 수평선을 놓으세요" : "첫 번째 점을 클릭하세요");
  };
  const clearAll = () => {
    drawings.current = [];
    ruler.current = null;
    pendingPt.current = null;
    setRulerText(null);
    setTool(null);
    setHint(null);
    drawDrawings();
  };

  const btn = (on: boolean) => cn("rounded-md px-2 py-1 text-xs font-medium transition-colors", on ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted");

  return (
    <div className="flex h-full flex-col p-2">
      <div className="mb-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
        <div className="flex gap-0.5">
          {INTERVALS.map((i) => (
            <button key={i} type="button" onClick={() => setIntervalKey(i)} className={cn("rounded-md px-2 py-1 text-xs font-medium transition-colors", i === interval ? "bg-brand-soft text-brand" : "text-muted-foreground hover:bg-muted")}>
              {i}
            </button>
          ))}
        </div>
        <div className="flex gap-0.5 border-l pl-3">
          {KINDS.map(([k, name]) => (
            <button key={k} type="button" onClick={() => setKind(k)} className={btn(k === kind)}>
              {name}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-0.5 border-l pl-3">
          {INDS.map(([k, name]) => (
            <button
              key={k}
              type="button"
              aria-pressed={inds.includes(k)}
              onClick={() => toggle(k)}
              className={cn("rounded-md border px-2 py-0.5 text-[11px] font-medium transition-colors", inds.includes(k) ? "border-brand bg-brand-soft text-brand" : "border-transparent text-muted-foreground hover:bg-muted")}
            >
              {name}
            </button>
          ))}
        </div>
        <div className="flex gap-0.5 border-l pl-3">
          {TOOLS.map(([k, name]) => (
            <button key={k} type="button" aria-pressed={tool === k} onClick={() => pickTool(k)} className={btn(tool === k)}>
              {name}
            </button>
          ))}
          <button type="button" onClick={clearAll} className="rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted">
            지우기
          </button>
        </div>
      </div>
      <div className="relative min-h-0 flex-1">
        <div ref={box} className="absolute inset-0" />
        {(hint || rulerText) && (
          <div className="pointer-events-none absolute left-2 top-2 z-10 rounded-md border bg-card/90 px-2 py-1 text-xs shadow-xs">
            {hint ?? <>자 <span className="font-semibold tabular-nums">{rulerText}</span></>}
          </div>
        )}
        {error && <p className="absolute inset-0 grid place-items-center text-sm text-muted-foreground">차트 데이터를 불러오지 못했습니다.</p>}
      </div>
    </div>
  );
}
