"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
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
  type Logical,
  type SeriesType,
  type UTCTimestamp,
} from "lightweight-charts";
import { cn } from "@/lib/utils";
import { DEFAULT_CFG, EMA_COLORS, MA_COLORS, calcAll, heikinAshi, mergeCfg, type Calc, type Candle, type IndCfg } from "@/lib/indicators";
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
  ["ray", "연장선"],
  ["ruler", "자"],
] as const;
type ToolKind = (typeof TOOLS)[number][0];

const PALETTE = ["#f0b90b", "#3b82f6", "#ef4444", "#22c55e", "#a855f7", "#9ca3af"];

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
type Kline = [number, string, string, string, string, string];

/** 그리기 도구로 만든 도형. 위치는 (시각 초, 가격)으로 저장해 주기·스크롤이 바뀌어도 같은 자리에 붙어 있습니다. */
type Anchor = { t: number; p: number };
type Shape = { id: string; kind: ToolKind; a: Anchor; b: Anchor; color: string; width: number };
type Item = { id: string; kind: ToolKind; x1: number; y1: number; x2: number; y2: number; hx1: number; hy1: number; hx2: number; hy2: number; color: string; width: number; label?: string; draft?: boolean };
type Layout = { w: number; h: number; items: Item[] };
type Draft = { kind: ToolKind; a: Anchor; b: Anchor; down: boolean; sx: number; sy: number; moved: boolean };
type Drag = { id: string; mode: "move" | "a" | "b"; sx: number; sy: number; orig: Item };

const EMPTY_LAYOUT: Layout = { w: 0, h: 0, items: [] };
const K_DRAW = "fintalk.trade.drawings.v1";
const K_PREFS = "fintalk.trade.chartprefs.v1";

const alpha = (hex: string, a: number) => (/^#[0-9a-f]{6}$/i.test(hex) ? hex + Math.round(a * 255).toString(16).padStart(2, "0") : hex);
const parseKlines = (rows: Kline[]): Candle[] =>
  rows.map((k) => ({ time: Math.floor(k[0] / 1000), open: Number(k[1]), high: Number(k[2]), low: Number(k[3]), close: Number(k[4]), volume: Number(k[5]) }));
const r1 = (n: number) => Math.round(n * 10) / 10;
const uid = () => Math.random().toString(36).slice(2, 10);

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function loadDrawings(): Record<string, Shape[]> {
  const raw = readJson<Record<string, unknown>>(K_DRAW, {});
  const out: Record<string, Shape[]> = {};
  const ok = (a: unknown): a is Anchor => !!a && typeof (a as Anchor).t === "number" && typeof (a as Anchor).p === "number";
  for (const [sym, list] of Object.entries(raw)) {
    if (!Array.isArray(list)) continue;
    out[sym] = list.filter((s): s is Shape => !!s && typeof s.id === "string" && TOOLS.some(([k]) => k === s.kind) && ok(s.a) && ok(s.b));
  }
  return out;
}

function specs(cfg: IndCfg): Spec[] {
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
  const out: Spec[] = [
    {
      key: "vol",
      ind: "vol",
      pane: "main",
      type: "hist",
      options: { priceFormat: { type: "volume" }, priceScaleId: "vol", priceLineVisible: false, lastValueVisible: false },
      point: (i, c, _k, col) => ({ time: c[i].time as UTCTimestamp, value: c[i].volume, color: alpha(c[i].close >= c[i].open ? col.up : col.down, 0.45) }),
    },
  ];
  cfg.ma.forEach((m, i) => m.on && out.push(line(`ma${i}`, "ma", "main", (k) => k.ma[i], MA_COLORS[i])));
  cfg.ema.forEach((m, i) => m.on && out.push(line(`ema${i}`, "ema", "main", (k) => k.ema[i], EMA_COLORS[i])));
  out.push(
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
  );
  return out;
}

type DragLine = { line: IPriceLine; pos: Position; kind: "tp" | "sl" };

/**
 * 캔들 차트. 과거 봉은 Binance REST(스크롤하면 더 과거를 이어서 불러옴), 마지막 봉은 실시간 시세로 갱신합니다.
 * - 보조지표(거래량·MA·EMA·볼린저·RSI·MACD): 기간 등을 설정 창에서 바꿀 수 있고 브라우저에 저장됩니다.
 * - 포지션 진입가·청산가·익절·손절·미체결 주문을 가격선으로 표시 (익절·손절 선은 끌어서 수정)
 * - 그리기 도구(수평선·추세선·연장선·자): 선택·이동·끝점 조절·색/굵기 변경·삭제(Delete 키)
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
  const svgRef = useRef<SVGSVGElement>(null);
  const clipId = "clip" + useId().replace(/[^a-zA-Z0-9]/g, "");
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

  const [interval, setIntervalKey] = useState<(typeof INTERVALS)[number]>(() => {
    const v = readJson<{ interval?: string }>(K_PREFS, {}).interval;
    return (INTERVALS as readonly string[]).includes(v ?? "") ? (v as (typeof INTERVALS)[number]) : "15m";
  });
  const intervalRef = useRef(interval);
  const [kind, setKind] = useState<Kind>(() => {
    const v = readJson<{ kind?: string }>(K_PREFS, {}).kind;
    return KINDS.some(([k]) => k === v) ? (v as Kind) : "candle";
  });
  const [inds, setInds] = useState<Ind[]>(() => {
    const v = readJson<{ inds?: unknown }>(K_PREFS, {}).inds;
    return Array.isArray(v) ? v.filter((x): x is Ind => INDS.some(([k]) => k === x)) : ["vol", "ma"];
  });
  const [cfg, setCfg] = useState<IndCfg>(() => mergeCfg(readJson<{ cfg?: unknown }>(K_PREFS, {}).cfg));
  const cfgRef = useRef(cfg);
  const [version, setVersion] = useState(0); // 캔들 데이터가 바뀔 때마다 증가
  const [error, setError] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // 그리기 상태
  const [store, setStore] = useState<Record<string, Shape[]>>(loadDrawings);
  const shapes = store[symbol] ?? [];
  const shapesRef = useRef<Shape[]>(shapes);
  const [selected, setSelected] = useState<string | null>(null);
  const selectedRef = useRef<string | null>(null);
  const [tool, setTool] = useState<ToolKind | null>(null);
  const toolRef = useRef<ToolKind | null>(null);
  const [draft, setDraftState] = useState<Draft | null>(null);
  const draftRef = useRef<Draft | null>(null);
  const [layout, setLayout] = useState<Layout>(EMPTY_LAYOUT);
  const layoutRef = useRef<Layout>(EMPTY_LAYOUT);
  const dragRef = useRef<Drag | null>(null);

  const setDraft = useCallback((d: Draft | null) => {
    draftRef.current = d;
    setDraftState(d);
  }, []);

  useEffect(() => {
    symRef.current = symbol;
    intervalRef.current = interval;
    onTpSlRef.current = onTpSl;
    toolRef.current = tool;
    selectedRef.current = selected;
    shapesRef.current = shapes;
    layoutRef.current = layout;
    cfgRef.current = cfg;
  });

  // 설정·그림 저장
  useEffect(() => {
    try {
      localStorage.setItem(K_PREFS, JSON.stringify({ interval, kind, inds, cfg }));
    } catch {
      /* 저장 불가 환경 */
    }
  }, [interval, kind, inds, cfg]);
  useEffect(() => {
    try {
      localStorage.setItem(K_DRAW, JSON.stringify(store));
    } catch {
      /* 저장 불가 환경 */
    }
  }, [store]);

  const updateShapes = useCallback((fn: (list: Shape[]) => Shape[]) => {
    const sym = symRef.current;
    setStore((s) => ({ ...s, [sym]: fn(s[sym] ?? []) }));
  }, []);

  // ───────── 좌표 변환 (시각 ↔ 논리 인덱스 ↔ 픽셀) ─────────
  const toLogical = useCallback((t: number) => {
    const c = candles.current;
    const n = c.length;
    const step = SECONDS[intervalRef.current];
    if (!n) return 0;
    if (t <= c[0].time) return (t - c[0].time) / step;
    if (t >= c[n - 1].time) return n - 1 + (t - c[n - 1].time) / step;
    let lo = 0;
    let hi = n - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (c[mid].time <= t) lo = mid;
      else hi = mid;
    }
    return lo + (t - c[lo].time) / (c[lo + 1].time - c[lo].time);
  }, []);
  const toTime = useCallback((l: number) => {
    const c = candles.current;
    const n = c.length;
    const step = SECONDS[intervalRef.current];
    if (!n) return 0;
    if (l <= 0) return c[0].time + l * step;
    if (l >= n - 1) return c[n - 1].time + (l - (n - 1)) * step;
    const i = Math.floor(l);
    return c[i].time + (l - i) * (c[i + 1].time - c[i].time);
  }, []);
  const toPx = useCallback(
    (a: Anchor) => {
      const c = chart.current;
      const s = main.current;
      if (!c || !s) return null;
      const x = c.timeScale().logicalToCoordinate(toLogical(a.t) as Logical);
      const y = s.priceToCoordinate(a.p);
      return x === null || y === null ? null : { x: x as number, y: y as number };
    },
    [toLogical],
  );
  const toAnchor = useCallback(
    (x: number, y: number): Anchor | null => {
      const c = chart.current;
      const s = main.current;
      if (!c || !s) return null;
      const l = c.timeScale().coordinateToLogical(x);
      const p = s.coordinateToPrice(y);
      return l === null || p === null ? null : { t: toTime(l as number), p: p as number };
    },
    [toTime],
  );

  /** 현재 화면 기준 도형 픽셀 좌표 계산 (매 프레임 확인하고, 바뀌었을 때만 다시 그림) */
  const computeLayout = useCallback((): Layout => {
    const c = chart.current;
    const s = main.current;
    if (!c || !s) return EMPTY_LAYOUT;
    const list: (Shape & { draft?: boolean })[] = [...shapesRef.current];
    const d = draftRef.current;
    if (d) list.push({ id: "draft", kind: d.kind, a: d.a, b: d.b, color: "#f0b90b", width: 2, draft: true });
    const w = r1(c.timeScale().width());
    const h = r1(c.panes()[0]?.getHeight() ?? 0);
    if (!list.length) return { w, h, items: [] }; // 도형이 없어도 그리기 도구가 클릭을 받을 영역 크기는 필요
    const step = SECONDS[intervalRef.current];
    const items: Item[] = [];
    for (const sh of list) {
      if (sh.kind === "hline") {
        const y = s.priceToCoordinate(sh.a.p);
        if (y === null) continue;
        const yy = r1(y as number);
        items.push({ id: sh.id, kind: sh.kind, x1: 0, y1: yy, x2: w, y2: yy, hx1: 0, hy1: yy, hx2: 0, hy2: yy, color: sh.color, width: sh.width, draft: sh.draft });
        continue;
      }
      const pa = toPx(sh.a);
      const pb = toPx(sh.b);
      if (!pa || !pb) continue;
      let { x: x2, y: y2 } = pb;
      let color = sh.color;
      let label: string | undefined;
      if (sh.kind === "ray") {
        const dx = pb.x - pa.x;
        const dy = pb.y - pa.y;
        if (Math.abs(dx) > 0.01) {
          const tx = dx > 0 ? w + 60 : -60;
          y2 = pa.y + (dy / dx) * (tx - pa.x);
          x2 = tx;
        } else {
          y2 = pa.y + (dy >= 0 ? 1 : -1) * 100000;
          x2 = pa.x;
        }
      }
      if (sh.kind === "ruler") {
        const diff = sh.b.p - sh.a.p;
        const bars = Math.round((sh.b.t - sh.a.t) / step);
        color = diff >= 0 ? colors.current.up : colors.current.down;
        label = `${diff >= 0 ? "+" : ""}${fmtPrice(diff)} (${diff >= 0 ? "+" : ""}${((diff / sh.a.p) * 100).toFixed(2)}%) · ${Math.abs(bars)}봉`;
      }
      items.push({ id: sh.id, kind: sh.kind, x1: r1(pa.x), y1: r1(pa.y), x2: r1(x2), y2: r1(y2), hx1: r1(pa.x), hy1: r1(pa.y), hx2: r1(pb.x), hy2: r1(pb.y), color, width: sh.width, label, draft: sh.draft });
    }
    return { w, h, items };
  }, [toPx]);

  useEffect(() => {
    let raf = 0;
    let last = "";
    const loop = () => {
      const next = computeLayout();
      const sig = JSON.stringify(next) + "|" + (selectedRef.current ?? "");
      if (sig !== last) {
        last = sig;
        setLayout(next);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [computeLayout]);

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
    c.subscribeClick(() => {
      if (!toolRef.current) setSelected(null);
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
      el.style.cursor = !toolRef.current && onTpSlRef.current && hit(yOf(e)) ? "ns-resize" : "";
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
    };
  }, [drawLines, loadOlder]);

  // 키보드: Delete 로 선택한 그림 삭제, Esc 로 취소
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if ((e.key === "Delete" || e.key === "Backspace") && selectedRef.current) {
        const id = selectedRef.current;
        updateShapes((l) => l.filter((s) => s.id !== id));
        setSelected(null);
      } else if (e.key === "Escape") {
        setDraft(null);
        setTool(null);
        setSelected(null);
        setSettingsOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [updateShapes, setDraft]);

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

  // 시리즈 구성: 차트 형태·지표·설정·데이터가 바뀔 때 전부 새로 만듭니다.
  useEffect(() => {
    const c = chart.current;
    const data = candles.current;
    if (!c || !data.length) return;
    const col = colors.current;

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

    const calc = calcAll(data, cfg);
    const paneIndex = { main: 0, rsi: inds.includes("rsi") ? 1 : -1, macd: inds.includes("macd") ? (inds.includes("rsi") ? 2 : 1) : -1 };
    for (const spec of specs(cfg)) {
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
  }, [kind, inds, cfg, version, drawLines]);

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
      const calc = calcAll(data, cfgRef.current);
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

  // ───────── 그리기 도구 상호작용 ─────────
  const rel = (e: { clientX: number; clientY: number }) => {
    const r = svgRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const commit = useCallback(
    (kind: ToolKind, a: Anchor, b: Anchor) => {
      const sh: Shape = { id: uid(), kind, a, b, color: kind === "hline" ? "#f0b90b" : kind === "ray" ? "#3b82f6" : "#f0b90b", width: 2 };
      updateShapes((l) => [...l, sh]);
      setSelected(sh.id);
      setTool(null);
      setDraft(null);
    },
    [updateShapes, setDraft],
  );

  const placeDown = (e: React.PointerEvent) => {
    if (!tool) return;
    e.stopPropagation();
    const { x, y } = rel(e);
    const pt = toAnchor(x, y);
    if (!pt) return;
    const d = draftRef.current;
    if (tool === "hline") return commit("hline", pt, pt);
    if (d) return commit(d.kind, d.a, pt); // 두 번째 클릭
    setDraft({ kind: tool, a: pt, b: pt, down: true, sx: e.clientX, sy: e.clientY, moved: false });
  };

  const onMove = (e: React.PointerEvent) => {
    const g = dragRef.current;
    if (g) {
      const dx = e.clientX - g.sx;
      const dy = e.clientY - g.sy;
      const o = g.orig;
      const upd = (fn: (s: Shape) => Shape) => updateShapes((l) => l.map((s) => (s.id === g.id ? fn(s) : s)));
      if (o.kind === "hline") {
        const p = toAnchor(0, o.y1 + dy)?.p;
        if (p !== undefined) upd((s) => ({ ...s, a: { ...s.a, p }, b: { ...s.b, p } }));
      } else if (g.mode === "move") {
        const a = toAnchor(o.hx1 + dx, o.hy1 + dy);
        const b = toAnchor(o.hx2 + dx, o.hy2 + dy);
        if (a && b) upd((s) => ({ ...s, a, b }));
      } else if (g.mode === "a") {
        const a = toAnchor(o.hx1 + dx, o.hy1 + dy);
        if (a) upd((s) => ({ ...s, a }));
      } else {
        const b = toAnchor(o.hx2 + dx, o.hy2 + dy);
        if (b) upd((s) => ({ ...s, b }));
      }
      return;
    }
    const d = draftRef.current;
    if (d) {
      const { x, y } = rel(e);
      const pt = toAnchor(x, y);
      if (pt) setDraft({ ...d, b: pt, moved: d.moved || Math.hypot(e.clientX - d.sx, e.clientY - d.sy) > 6 });
    }
  };

  const onUp = (e: React.PointerEvent) => {
    if (dragRef.current) {
      dragRef.current = null;
      return;
    }
    const d = draftRef.current;
    if (!d || !d.down) return;
    if (d.moved || Math.hypot(e.clientX - d.sx, e.clientY - d.sy) > 6) {
      const { x, y } = rel(e);
      commit(d.kind, d.a, toAnchor(x, y) ?? d.b); // 끌어서 그리기
    } else setDraft({ ...d, down: false }); // 클릭 후 두 번째 점 대기
  };

  const startDrag = (e: React.PointerEvent, it: Item, mode: Drag["mode"]) => {
    if (toolRef.current) return;
    e.stopPropagation();
    try {
      (e.target as Element).setPointerCapture(e.pointerId);
    } catch {
      /* 포인터를 잡지 못해도 svg 에서 이동 이벤트를 받으면 계속 동작 */
    }
    setSelected(it.id);
    dragRef.current = { id: it.id, mode, sx: e.clientX, sy: e.clientY, orig: it };
  };

  const toggle = (k: Ind) => setInds((cur) => (cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k]));
  const pickTool = (t: ToolKind) => {
    setDraft(null);
    setSelected(null);
    setTool((cur) => (cur === t ? null : t));
  };
  const clearAll = () => {
    updateShapes(() => []);
    setSelected(null);
    setTool(null);
    setDraft(null);
  };
  const patchSelected = (patch: Partial<Shape>) => selected && updateShapes((l) => l.map((s) => (s.id === selected ? { ...s, ...patch } : s)));
  const removeSelected = () => {
    if (!selected) return;
    updateShapes((l) => l.filter((s) => s.id !== selected));
    setSelected(null);
  };

  const sel = shapes.find((s) => s.id === selected) ?? null;
  const hint = tool ? (tool === "hline" ? "차트를 클릭해 수평선을 놓으세요" : draft ? "두 번째 점을 클릭하세요" : "첫 번째 점을 클릭하세요 (끌어서 그려도 됩니다)") : null;
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
        <div className="flex flex-wrap items-center gap-0.5 border-l pl-3">
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
          <button type="button" aria-expanded={settingsOpen} onClick={() => setSettingsOpen((o) => !o)} className={cn("ml-0.5 rounded-md border px-2 py-0.5 text-[11px] font-medium", settingsOpen ? "border-foreground" : "border-transparent text-muted-foreground hover:bg-muted")}>
            ⚙ 설정
          </button>
        </div>
        <div className="flex gap-0.5 border-l pl-3">
          {TOOLS.map(([k, name]) => (
            <button key={k} type="button" aria-pressed={tool === k} onClick={() => pickTool(k)} className={btn(tool === k)}>
              {name}
            </button>
          ))}
          <button type="button" onClick={clearAll} className="rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted">
            모두 지우기
          </button>
        </div>
      </div>

      <div className="relative min-h-0 flex-1">
        <div ref={box} className="absolute inset-0" />

        {/* 그리기 레이어: 도형 위에서만 마우스를 받고, 나머지는 차트로 통과시킵니다. */}
        <svg ref={svgRef} className="pointer-events-none absolute inset-0 h-full w-full overflow-hidden" onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
          <defs>
            <clipPath id={clipId}>
              <rect x={0} y={0} width={layout.w} height={layout.h} />
            </clipPath>
          </defs>
          {tool && <rect x={0} y={0} width={layout.w || 0} height={layout.h || 0} fill="transparent" style={{ pointerEvents: "all", cursor: "crosshair" }} onPointerDown={placeDown} />}
          <g clipPath={`url(#${clipId})`}>
            {layout.items.map((it) => {
              const isSel = it.id === selected;
              return (
                <g key={it.id}>
                  {!it.draft && (
                    <line x1={it.x1} y1={it.y1} x2={it.x2} y2={it.y2} stroke="rgba(0,0,0,0)" strokeWidth={14} style={{ pointerEvents: "stroke", cursor: tool ? undefined : "move" }} onPointerDown={(e) => startDrag(e, it, "move")} />
                  )}
                  <line x1={it.x1} y1={it.y1} x2={it.x2} y2={it.y2} stroke={it.color} strokeWidth={isSel ? it.width + 1 : it.width} strokeDasharray={it.kind === "ruler" || it.draft ? "6 4" : undefined} strokeLinecap="round" pointerEvents="none" />
                  {it.label && (
                    <text x={(it.hx1 + it.hx2) / 2} y={Math.min(it.hy1, it.hy2) - 8} textAnchor="middle" fontSize={11} fontWeight={600} fill={it.color} pointerEvents="none" style={{ paintOrder: "stroke", stroke: "var(--background)", strokeWidth: 3 }}>
                      {it.label}
                    </text>
                  )}
                </g>
              );
            })}
          </g>
          {layout.items.map((it) =>
            it.id === selected && it.kind !== "hline" ? (
              <g key={"h" + it.id}>
                {([["a", it.hx1, it.hy1], ["b", it.hx2, it.hy2]] as const).map(([m, x, y]) => (
                  <circle key={m} cx={x} cy={y} r={5.5} fill="var(--background)" stroke={it.color} strokeWidth={2} style={{ pointerEvents: "all", cursor: "grab" }} onPointerDown={(e) => startDrag(e, it, m)} />
                ))}
              </g>
            ) : null,
          )}
        </svg>

        {hint && <div className="pointer-events-none absolute left-2 top-2 z-10 rounded-md border bg-card/90 px-2 py-1 text-xs shadow-xs">{hint} · Esc 취소</div>}

        {/* 선택한 그림 편집 바 */}
        {sel && !tool && (
          <div className="absolute left-2 top-2 z-10 flex items-center gap-2 rounded-lg border bg-card px-2 py-1.5 shadow-sm">
            <div className="flex gap-1">
              {PALETTE.map((c) => (
                <button key={c} type="button" aria-label={`색상 ${c}`} onClick={() => patchSelected({ color: c })} className={cn("size-4 rounded-full border", sel.color === c && "ring-2 ring-foreground ring-offset-1 ring-offset-card")} style={{ background: c }} />
              ))}
            </div>
            <div className="flex gap-0.5 border-l pl-2">
              {[1, 2, 3].map((w) => (
                <button key={w} type="button" onClick={() => patchSelected({ width: w })} className={cn("grid h-5 w-6 place-items-center rounded border", sel.width === w ? "border-foreground" : "border-transparent hover:bg-muted")} aria-label={`굵기 ${w}`}>
                  <span className="block w-4 rounded bg-foreground" style={{ height: w }} />
                </button>
              ))}
            </div>
            <button type="button" onClick={removeSelected} className="border-l pl-2 text-xs font-medium text-down hover:underline">
              삭제
            </button>
          </div>
        )}

        {settingsOpen && <IndSettings cfg={cfg} setCfg={setCfg} onClose={() => setSettingsOpen(false)} />}
        {error && <p className="absolute inset-0 grid place-items-center text-sm text-muted-foreground">차트 데이터를 불러오지 못했습니다.</p>}
      </div>
    </div>
  );
}

/** 입력 중에는 자유롭게 지우고 쓸 수 있고, 범위 안의 값일 때만 설정에 반영합니다. */
function NumField({ value, min, max, step = 1, onCommit, label }: { value: number; min: number; max: number; step?: number; onCommit: (n: number) => void; label: string }) {
  const [txt, setTxt] = useState(String(value));
  const [seen, setSeen] = useState(value);
  if (value !== seen) {
    setSeen(value);
    setTxt(String(value));
  }
  return (
    <input
      aria-label={label}
      inputMode="decimal"
      value={txt}
      onChange={(e) => {
        setTxt(e.target.value);
        const n = Number(e.target.value);
        if (e.target.value.trim() !== "" && Number.isFinite(n) && n >= min && n <= max && (step < 1 || Number.isInteger(n))) onCommit(n);
      }}
      onBlur={() => setTxt(String(value))}
      className="h-7 w-16 rounded-md border bg-background px-2 text-right text-xs tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
    />
  );
}

function IndSettings({ cfg, setCfg, onClose }: { cfg: IndCfg; setCfg: (c: IndCfg) => void; onClose: () => void }) {
  const lineGroup = (key: "ma" | "ema", title: string, colorsList: string[]) => (
    <section>
      <h4 className="mb-1 text-xs font-semibold">{title}</h4>
      <div className="space-y-1">
        {cfg[key].map((l, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={l.on} onChange={(e) => setCfg({ ...cfg, [key]: cfg[key].map((x, j) => (j === i ? { ...x, on: e.target.checked } : x)) })} className="size-3.5 accent-foreground" aria-label={`${title} ${i + 1} 사용`} />
            <span className="size-2.5 rounded-full" style={{ background: colorsList[i] }} />
            <span className="w-8 text-muted-foreground">기간</span>
            <NumField label={`${title} ${i + 1} 기간`} value={l.period} min={1} max={500} onCommit={(n) => setCfg({ ...cfg, [key]: cfg[key].map((x, j) => (j === i ? { ...x, period: n } : x)) })} />
          </div>
        ))}
      </div>
    </section>
  );
  const row = (label: string, children: React.ReactNode) => (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-14 text-muted-foreground">{label}</span>
      {children}
    </div>
  );
  return (
    <div className="absolute right-2 top-2 z-20 max-h-[calc(100%-16px)] w-64 space-y-3 overflow-y-auto rounded-xl border bg-card p-3 shadow-lg">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold">지표 설정</h3>
        <button type="button" onClick={onClose} className="text-xs text-muted-foreground hover:text-foreground">
          닫기
        </button>
      </div>
      {lineGroup("ma", "이동평균 (MA)", MA_COLORS)}
      {lineGroup("ema", "지수이동평균 (EMA)", EMA_COLORS)}
      <section className="space-y-1">
        <h4 className="text-xs font-semibold">볼린저 밴드</h4>
        {row("기간", <NumField label="볼린저 기간" value={cfg.boll.period} min={2} max={500} onCommit={(n) => setCfg({ ...cfg, boll: { ...cfg.boll, period: n } })} />)}
        {row("표준편차", <NumField label="볼린저 표준편차 배수" value={cfg.boll.mult} min={0.1} max={10} step={0.1} onCommit={(n) => setCfg({ ...cfg, boll: { ...cfg.boll, mult: n } })} />)}
      </section>
      <section className="space-y-1">
        <h4 className="text-xs font-semibold">RSI</h4>
        {row("기간", <NumField label="RSI 기간" value={cfg.rsi.period} min={2} max={200} onCommit={(n) => setCfg({ ...cfg, rsi: { period: n } })} />)}
      </section>
      <section className="space-y-1">
        <h4 className="text-xs font-semibold">MACD</h4>
        {row("단기", <NumField label="MACD 단기" value={cfg.macd.fast} min={1} max={200} onCommit={(n) => n < cfg.macd.slow && setCfg({ ...cfg, macd: { ...cfg.macd, fast: n } })} />)}
        {row("장기", <NumField label="MACD 장기" value={cfg.macd.slow} min={2} max={400} onCommit={(n) => n > cfg.macd.fast && setCfg({ ...cfg, macd: { ...cfg.macd, slow: n } })} />)}
        {row("시그널", <NumField label="MACD 시그널" value={cfg.macd.signal} min={1} max={200} onCommit={(n) => setCfg({ ...cfg, macd: { ...cfg.macd, signal: n } })} />)}
        <p className="text-[11px] text-muted-foreground">단기는 장기보다 작아야 합니다.</p>
      </section>
      <button type="button" onClick={() => setCfg(DEFAULT_CFG)} className="text-xs text-muted-foreground underline-offset-2 hover:underline">
        기본값으로 되돌리기
      </button>
    </div>
  );
}
