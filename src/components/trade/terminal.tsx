"use client";

import dynamic from "next/dynamic";
import { Fragment, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { RotateCcw, Search, Share2, X } from "lucide-react";
import { Card } from "@/components/common/bits";
import { useToast } from "@/components/common/toast";
import { Button } from "@/components/ui/button";
import { createShareAction } from "@/app/actions/share";
import { cancelCloseOrderAction, cancelOrderAction, closePositionAction, placeCloseOrderAction, reduceOnlyAction, placeOrderAction, resetAccountAction, setTpSlAction, syncTradeAction } from "@/app/actions/trade";
import type { TradeData } from "@/lib/data/trade";
import { FEE_RATE, MARGIN_MODE_LABEL, REASON_LABEL, SYMBOLS, crossLiqPrice, fmtPrice, fmtUsd, liqPrice, symbolLabel, unrealizedPnl, type CloseOrder, type MarginMode, type Position, type Side } from "@/lib/trade";
import { cn } from "@/lib/utils";
import { ClosePanel } from "./close-panel";
import { LeverageSlider } from "./leverage-slider";
import { OrderBook } from "./orderbook";
import { SymbolInfo } from "./symbol-info";
import { TradingViewChart } from "./tv-chart";
import { usePriceFeed } from "./use-price-feed";
import { WinPopup, findResult, type TradeResult } from "./win-popup";

// 차트는 브라우저 저장소(지표 설정·그림)를 읽으므로 서버에서는 그리지 않습니다.
const PriceChart = dynamic(() => import("./chart").then((m) => m.PriceChart), {
  ssr: false,
  loading: () => <div className="grid h-full place-items-center text-sm text-muted-foreground">차트 불러오는 중…</div>,
});

const inputCls = "h-9 w-full rounded-lg border bg-background px-3 text-sm tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring/50";
const pnlCls = (n: number) => (n >= 0 ? "text-up" : "text-down");
const signed = (n: number) => `${n >= 0 ? "+" : ""}${fmtUsd(n)}`;
const label = symbolLabel;

const PAGE = 60;

// 드래그로 조절하는 패널 크기(px). 값은 그리드 요소의 CSS 변수로 들고, 브라우저에 저장합니다.
const LAYOUT_KEY = "fintalk-trade-layout";
const LAYOUT_VARS = {
  "--ob": { def: 260, min: 200, max: 520 },
  "--of": { def: 320, min: 260, max: 520 },
  "--ch": { def: 560, min: 360, max: 1000 },
} as const;
type LayoutVar = keyof typeof LAYOUT_VARS;

function readVar(el: HTMLElement, v: LayoutVar) {
  const n = parseFloat(el.style.getPropertyValue(v));
  return Number.isFinite(n) ? n : LAYOUT_VARS[v].def;
}
function saveLayout(el: HTMLElement) {
  try {
    localStorage.setItem(LAYOUT_KEY, JSON.stringify(Object.fromEntries((Object.keys(LAYOUT_VARS) as LayoutVar[]).map((v) => [v, readVar(el, v)]))));
  } catch {
    /* 저장소 사용 불가 */
  }
}

/** 패널 사이 드래그 손잡이. dir=-1 이면 왼쪽(위)으로 끌수록 값이 커집니다. 더블클릭하면 기본 크기로 돌아갑니다. */
function Splitter({ v, axis, dir, label, className }: { v: LayoutVar; axis: "x" | "y"; dir: 1 | -1; label: string; className?: string }) {
  const { min, max, def } = LAYOUT_VARS[v];
  const onDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const grid = e.currentTarget.parentElement as HTMLElement;
    const start = axis === "x" ? e.clientX : e.clientY;
    const base = readVar(grid, v);
    const handle = e.currentTarget;
    handle.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => {
      const d = ((axis === "x" ? ev.clientX : ev.clientY) - start) * dir;
      grid.style.setProperty(v, `${Math.round(Math.min(max, Math.max(min, base + d)))}px`);
    };
    const up = () => {
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", up);
      handle.removeEventListener("pointercancel", up);
      saveLayout(grid);
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", up);
    handle.addEventListener("pointercancel", up);
  };
  return (
    <div
      role="separator"
      aria-orientation={axis === "x" ? "vertical" : "horizontal"}
      aria-label={label}
      title={`${label} (끌어서 조절, 더블클릭: 초기화)`}
      onPointerDown={onDown}
      onDoubleClick={(e) => {
        const grid = e.currentTarget.parentElement as HTMLElement;
        grid.style.setProperty(v, `${def}px`);
        saveLayout(grid);
      }}
      className={cn("group hidden touch-none select-none items-center justify-center xl:flex", axis === "x" ? "cursor-col-resize" : "cursor-row-resize", className)}
    >
      <span className={cn("rounded-full bg-border transition-colors group-hover:bg-brand group-active:bg-brand", axis === "x" ? "h-10 w-1" : "h-1 w-10")} />
    </div>
  );
}

/** 바이낸스 선물 전 종목 검색. 시세가 들어온 종목(prices)이 곧 거래 가능한 종목입니다. */
function SymbolSearch({ symbol, prices, onPick }: { symbol: string; prices: Record<string, number>; onPick: (s: string) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [shown, setShown] = useState(PAGE);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const off = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", off);
    return () => document.removeEventListener("mousedown", off);
  }, [open]);

  const all = useMemo(() => {
    const names = new Map<string, string>(SYMBOLS.map((x) => [x.symbol, x.name]));
    return Object.keys(prices)
      .map((sym) => ({ sym, label: symbolLabel(sym), name: names.get(sym) ?? "" }))
      .sort((a, b) => (names.has(b.sym) ? 1 : 0) - (names.has(a.sym) ? 1 : 0) || a.label.localeCompare(b.label));
  }, [prices]);
  const matches = useMemo(() => {
    const k = q.trim().toLowerCase();
    const list = k ? all.filter((x) => x.label.toLowerCase().includes(k) || x.name.includes(k)) : all;
    // 입력과 코드가 정확히/앞부분이 같은 종목을 위로
    return (k ? [...list].sort((a, b) => Number(b.label.toLowerCase().startsWith(k)) - Number(a.label.toLowerCase().startsWith(k))) : list);
  }, [all, q]);
  // 스크롤이 끝에 가까워질 때마다 더 불러와 전 종목을 볼 수 있게 합니다.
  const results = useMemo(() => matches.slice(0, shown), [matches, shown]);

  const inDefault = SYMBOLS.some((x) => x.symbol === symbol);
  return (
    <div ref={box} className="relative flex items-center gap-2">
      {!inDefault && (
        <span className="rounded-lg border border-brand bg-brand-soft px-2.5 py-1 text-xs font-semibold text-brand">{symbolLabel(symbol)}</span>
      )}
      <label className="flex h-7 w-32 items-center gap-1 rounded-lg border bg-background px-2 text-xs focus-within:ring-2 focus-within:ring-ring/50">
        <Search className="size-3.5 shrink-0 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setShown(PAGE);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
            if (e.key === "Enter" && results[0]) {
              onPick(results[0].sym);
              setQ("");
              setOpen(false);
            }
          }}
          placeholder="코인 검색"
          aria-label="코인 검색"
          className="w-full min-w-0 bg-transparent outline-none placeholder:text-muted-foreground"
        />
      </label>
      {open && (
        <ul
          onScroll={(e) => {
            const el = e.currentTarget;
            if (el.scrollTop + el.clientHeight >= el.scrollHeight - 40) setShown((n) => (n < matches.length ? n + PAGE : n));
          }}
          className="absolute left-0 top-full z-30 mt-1 max-h-72 w-64 overflow-y-auto rounded-lg border bg-popover p-1 text-xs shadow-lg">
          {results.length === 0 && <li className="px-2 py-3 text-center text-muted-foreground">{all.length === 0 ? "시세를 불러오는 중…" : "검색 결과가 없습니다."}</li>}
          {results.map((x) => (
            <li key={x.sym}>
              <button
                type="button"
                onClick={() => {
                  onPick(x.sym);
                  setQ("");
                  setOpen(false);
                }}
                className={cn("flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left hover:bg-muted", x.sym === symbol && "bg-muted")}
              >
                <span className="font-semibold">
                  {x.label} <span className="font-normal text-muted-foreground">{x.name || "USDT"}</span>
                </span>
                <span className="tabular-nums text-muted-foreground">{fmtPrice(prices[x.sym])}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function TradeTerminal({ data }: { data: TradeData }) {
  const [symbol, setSymbol] = useState<string>(SYMBOLS[0].symbol);
  const { prices, live } = usePriceFeed(data.prices, symbol);
  const [tab, setTab] = useState<"positions" | "orders" | "history">("positions");
  const [chartMode, setChartMode] = useState<"lite" | "tv">("lite");
  const [picked, setPicked] = useState<{ price: number; n: number } | null>(null);
  const [pending, start] = useTransition();
  const toast = useToast();
  const mark = prices[symbol];
  // 새로 종료된 거래가 생기면 수익/손실 팝업을 띄웁니다. 처음 불러온 기존 거래는 팝업 대상이 아닙니다.
  const seenTrades = useRef<Set<string> | null>(null);
  const [win, setWin] = useState<TradeResult | null>(null);
  useEffect(() => {
    if (!seenTrades.current) {
      seenTrades.current = new Set(data.trades.map((t) => t.id));
      return;
    }
    const w = findResult(data.trades, seenTrades.current);
    for (const t of data.trades) seenTrades.current.add(t.id);
    if (w) setWin(w);
  }, [data.trades]);
  // 참조가 안정적이어야 차트의 가격선이 시세 틱마다 다시 그려지지 않습니다.
  const router = useRouter();
  // 저장된 패널 크기 복원 (state 없이 CSS 변수로 바로 적용)
  const gridRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    try {
      const saved = JSON.parse(localStorage.getItem(LAYOUT_KEY) ?? "{}") as Record<string, number>;
      for (const [k, { min, max }] of Object.entries(LAYOUT_VARS)) {
        const n = Number(saved[k]);
        if (Number.isFinite(n) && n >= min && n <= max) el.style.setProperty(k, `${n}px`);
      }
    } catch {
      /* 무시 */
    }
  }, []);
  // 실시간 시세가 익절·손절·청산가·지정가에 닿으면 DB 를 바로 점검해 포지션을 종료합니다. (크론 주기를 기다리지 않음)
  const lastSync = useRef(0);
  useEffect(() => {
    if (!data.loggedIn) return;
    const hit = (side: Side, px: number | undefined, level: number | null | undefined, dir: "up" | "down") => {
      if (!px || !level) return false;
      return (dir === "up") === (side === "long") ? px >= level : px <= level;
    };
    let crossed = false;
    for (const p of data.positions) {
      const px = prices[p.symbol];
      if (hit(p.side, px, p.sl, "down") || hit(p.side, px, p.tp, "up") || (p.margin_mode === "isolated" && hit(p.side, px, p.liq_price, "down"))) crossed = true;
    }
    for (const o of data.orders) {
      const px = prices[o.symbol];
      if (px && (o.side === "long" ? px <= o.price : px >= o.price)) crossed = true;
    }
    for (const c of data.closeOrders) {
      const pos = data.positions.find((x) => x.id === c.position_id);
      const px = pos && prices[pos.symbol];
      if (pos && px && (pos.side === "long" ? px >= c.price : px <= c.price)) crossed = true;
    }
    if (!crossed || Date.now() - lastSync.current < 3000) return;
    lastSync.current = Date.now();
    syncTradeAction().then(() => router.refresh());
  }, [prices, data, router]);
  const symCloseOrders = useMemo(() => {
    const ids = new Set(data.positions.filter((p) => p.symbol === symbol).map((p) => p.id));
    return data.closeOrders.filter((c) => ids.has(c.position_id));
  }, [data.closeOrders, data.positions, symbol]);
  const symPositions = useMemo(() => data.positions.filter((p) => p.symbol === symbol), [data.positions, symbol]);
  const symOrders = useMemo(() => data.orders.filter((o) => o.symbol === symbol), [data.orders, symbol]);
  // 마진 모드: 이 종목에 열린 포지션·주문이 있으면 그 모드로 고정 (격리/교차를 섞을 수 없음)
  const [modeInput, setModeInput] = useState<MarginMode>("isolated");
  const lockedMode: MarginMode | null = symPositions[0]?.margin_mode ?? symOrders[0]?.margin_mode ?? null;
  const marginMode = lockedMode ?? modeInput;

  // 표의 종목명을 누르면 해당 종목 차트·포지션 현황으로 전환하고 차트 위치로 스크롤합니다.
  const selectSymbol = (s: string) => {
    setSymbol(s);
    requestAnimationFrame(() => document.getElementById("trade-chart")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, okMsg?: string) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) toast.show(r.error ?? "요청을 처리하지 못했습니다.");
      else if (okMsg) toast.show(okMsg);
    });

  const unreal = data.positions.reduce((s, p) => s + unrealizedPnl(p, prices[p.symbol] ?? p.entry_price), 0);
  const marginUsed = data.positions.reduce((s, p) => s + p.margin, 0) + data.orders.reduce((s, o) => s + o.margin, 0);
  const equity = data.balance + marginUsed + unreal;

  return (
    <div className="space-y-4">
      {win && <WinPopup win={win} onClose={() => setWin(null)} />}
      {/* 계정 요약 */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat title="총 자산" value={`${fmtUsd(equity)} USDT`} />
        <Stat title="주문 가능" value={`${fmtUsd(data.balance)} USDT`} />
        <Stat title="사용 중 증거금" value={`${fmtUsd(marginUsed)} USDT`} />
        <Stat title="미실현 손익" value={`${signed(unreal)} USDT`} tone={pnlCls(unreal)} />
      </div>

      <div ref={gridRef} className="grid gap-3 md:grid-cols-[minmax(0,1fr)_280px] xl:grid-cols-[minmax(0,1fr)_12px_var(--ob,260px)_12px_var(--of,320px)] xl:gap-0 xl:gap-y-0">
        <Card className="flex min-w-0 flex-col p-0 md:col-span-2 xl:col-span-1">
          <div id="trade-chart" className="flex scroll-mt-20 flex-wrap items-center gap-2 border-b px-3 py-2">
            {SYMBOLS.map((s) => (
              <button
                key={s.symbol}
                type="button"
                onClick={() => setSymbol(s.symbol)}
                className={cn(
                  "rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors",
                  s.symbol === symbol ? "border-brand bg-brand-soft text-brand" : "text-muted-foreground hover:bg-muted",
                )}
              >
                {s.label}
              </button>
            ))}
            <SymbolSearch symbol={symbol} prices={prices} onPick={setSymbol} />
            <span className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex rounded-md border p-0.5 text-[11px] font-medium">
                {(
                  [
                    ["lite", "커스텀"],
                    ["tv", "트레이딩뷰"],
                  ] as const
                ).map(([k, t]) => (
                  <button key={k} type="button" onClick={() => setChartMode(k)} className={cn("rounded px-2 py-1", chartMode === k ? "bg-foreground text-background" : "text-muted-foreground")}>
                    {t}
                  </button>
                ))}
              </span>
              <span className="notranslate text-base font-bold tabular-nums text-foreground">{mark ? fmtPrice(mark) : "—"}</span>
              <span className="flex items-center gap-1.5">
                <span className={cn("size-1.5 rounded-full", live ? "bg-up" : "bg-muted-foreground/40")} />
                {live ? "실시간" : "연결 중"}
              </span>
            </span>
          </div>
          <SymbolInfo symbol={symbol} mark={mark} />
          <div className="notranslate h-[380px] sm:h-[420px] xl:h-[var(--ch,560px)]">
            {chartMode === "lite" ? (
              <PriceChart symbol={symbol} price={mark} positions={symPositions} trades={data.trades}
                orders={symOrders}
                onTpSl={async (id, tp, sl) => {
                  const r = await setTpSlAction(id, tp, sl);
                  toast.show(r.ok ? "익절/손절을 수정했습니다." : r.error);
                }}
                closeOrders={symCloseOrders}
                onClosePosition={async (id, pct) => {
                  const r = await closePositionAction(id, pct);
                  toast.show(r.ok ? (pct >= 100 ? "포지션을 청산했습니다." : `${pct}% 청산했습니다.`) : r.error);
                  if (r.ok) router.refresh();
                  return r.ok;
                }}
                onCloseLimit={async (id, pct, price) => {
                  const r = await placeCloseOrderAction(id, pct, price);
                  toast.show(r.ok ? "지정가 청산 주문을 등록했습니다." : r.error);
                  if (r.ok) router.refresh();
                  return r.ok;
                }}
                onCancelClose={async (id) => {
                  const r = await cancelCloseOrderAction(id);
                  toast.show(r.ok ? "청산 주문을 취소했습니다." : r.error);
                  if (r.ok) router.refresh();
                }}
                balance={data.balance}
                loggedIn={data.loggedIn}
                onPlaceOrder={async (o) => {
                  const r = await placeOrderAction({ symbol, side: o.side, sizeUsdt: o.sizeUsdt, leverage: o.leverage, marginMode, limitPrice: o.limitPrice, tp: o.tp, sl: o.sl });
                  toast.show(r.ok ? (r.status === "open" ? "지정가 주문을 등록했습니다." : "주문이 체결되었습니다.") : r.error);
                  return r.ok;
                }}
              />
            ) : (
              <TradingViewChart symbol={symbol} />
            )}
          </div>
        </Card>

        <Splitter v="--ob" axis="x" dir={-1} label="차트와 호가창 너비 조절" />

        <div className="relative order-3 min-h-[360px] md:order-none md:min-h-[420px] xl:min-h-0">
          <div className="h-full xl:absolute xl:inset-0"><OrderBook symbol={symbol} mark={mark} onPick={(price) => setPicked({ price, n: (picked?.n ?? 0) + 1 })} /></div>
        </div>

        <Splitter v="--of" axis="x" dir={-1} label="호가창과 주문창 너비 조절" />

        <div className="order-2 min-w-0 md:order-none">
          <OrderForm symbol={symbol} mark={mark} positions={symPositions} allPositions={data.positions} prices={prices} marginMode={marginMode} lockedMode={lockedMode} onMarginMode={setModeInput} balance={data.balance} loggedIn={data.loggedIn} pending={pending} run={run} picked={picked} />
        </div>

        <Splitter v="--ch" axis="y" dir={1} label="차트 높이 조절" className="xl:col-span-5 h-3" />
      </div>

      {/* 포지션 / 주문 / 내역 */}
      <Card className="p-0">
        <div className="flex items-center gap-1 overflow-x-auto border-b px-3 pt-2">
          {(
            [
              ["positions", `포지션 ${data.positions.length}`],
              ["orders", `미체결 ${data.orders.length + data.closeOrders.length + data.positions.filter((p) => p.tp || p.sl).length}`],
              ["history", "거래 내역"],
            ] as const
          ).map(([k, t]) => (
            <button
              key={k}
              type="button"
              onClick={() => setTab(k)}
              className={cn(
                "-mb-px shrink-0 whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium",
                tab === k ? "border-brand text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {t}
            </button>
          ))}
          {data.loggedIn && (
            <Button
              variant="ghost"
              size="xs"
              className="mb-1 ml-auto"
              disabled={pending}
              onClick={() => confirm("포지션과 미체결 주문을 모두 지우고 잔고를 10,000 USDT 로 되돌립니다. 계속할까요?") && run(resetAccountAction, "계정을 초기화했습니다.")}
            >
              <RotateCcw /> 초기화
            </Button>
          )}
        </div>

        <div className="overflow-x-auto p-3">
          {!data.loggedIn ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              <Link href="/login" className="font-semibold text-brand hover:underline">로그인</Link>하면 10,000 USDT 가상 자금으로 모의투자를 시작할 수 있습니다.
            </p>
          ) : tab === "positions" ? (
            <PositionsTable positions={data.positions} closeOrders={data.closeOrders} prices={prices} pending={pending} run={run} current={symbol} onSelect={selectSymbol} />
          ) : tab === "orders" ? (
            <OrdersTable orders={data.orders} closeOrders={data.closeOrders} positions={data.positions} pending={pending} run={run} current={symbol} onSelect={selectSymbol} />
          ) : (
            <HistoryTable trades={data.trades} current={symbol} onSelect={selectSymbol} />
          )}
        </div>
      </Card>

      <p className="text-xs leading-relaxed text-muted-foreground">
        가상 자금으로 진행하는 모의투자이며 실제 거래가 아닙니다. 체결 가격과 수수료({(FEE_RATE * 100).toFixed(2)}%)는 단순화된 모델이라 실제 거래소와 다를 수 있고, 투자 권유가 아닙니다.
      </p>
    </div>
  );
}

function Stat({ title, value, tone }: { title: string; value: string; tone?: string }) {
  return (
    <div className="rounded-xl border bg-card px-3 py-2.5 shadow-xs">
      <p className="text-[11px] text-muted-foreground">{title}</p>
      <p className={cn("mt-0.5 text-sm font-bold tabular-nums sm:text-base", tone)}>{value}</p>
    </div>
  );
}

type Run = (fn: () => Promise<{ ok: boolean; error?: string }>, okMsg?: string) => void;

function OrderForm({ symbol, mark, positions, allPositions, prices, marginMode, lockedMode, onMarginMode, balance, loggedIn, pending, run, picked }: { symbol: string; mark?: number; positions: Position[]; allPositions: Position[]; prices: Record<string, number>; marginMode: MarginMode; lockedMode: MarginMode | null; onMarginMode: (m: MarginMode) => void; balance: number; loggedIn: boolean; pending: boolean; run: Run; picked: { price: number; n: number } | null }) {
  const [type, setType] = useState<"market" | "limit">("market");
  const [size, setSize] = useState("");
  const [levInput, setLev] = useState(10);
  // 이 종목에 열린 포지션이 있으면 그 레버리지로 고정 (같은 종목은 레버리지를 바꿀 수 없음)
  const lockedLev = positions[0]?.leverage ?? null;
  const lev = lockedLev ?? levInput;
  const [limit, setLimit] = useState("");
  const [tpsl, setTpsl] = useState(false);
  const [reduce, setReduce] = useState(false); // 리듀스 온리: 반대 방향 포지션만 줄임
  const [tp, setTp] = useState("");
  const [sl, setSl] = useState("");
  const [tpMode, setTpMode] = useState<"price" | "usd" | "pct">("price");
  // 호가창에서 가격을 누르면 지정가 입력으로 전환 (렌더 중 상태 동기화)
  const toast = useToast();
  const [seen, setSeen] = useState(0);
  if (picked && picked.n !== seen) {
    setSeen(picked.n);
    setType("limit");
    setLimit(String(picked.price));
  }

  const power = balance * lev; // 거래 가능 규모
  // 리듀스 온리일 때 줄일 수 있는 최대 규모 = 반대 방향 포지션의 현재 가치 (롱 주문→숏, 숏 주문→롱)
  const notional = (side: Side) => positions.filter((p) => p.side === side).reduce((a, p) => a + p.qty * (mark ?? p.entry_price), 0);
  const reduceMax = Math.max(notional("short"), notional("long"));
  const maxSize = reduce ? Math.floor(reduceMax * 100) / 100 : Math.floor((power / (1 + FEE_RATE * lev)) * 100) / 100; // 수수료까지 감안한 최대 주문 규모
  const sizeN = Number(size) || 0;
  const pct = maxSize > 0 ? Math.min(100, (sizeN / maxSize) * 100) : 0;
  const setPct = (p: number) => setSize(p === 0 ? "" : String(Math.floor(((maxSize * p) / 100) * 100) / 100));

  const margin = sizeN / lev;
  const fee = sizeN * FEE_RATE;
  const refPrice = type === "limit" ? Number(limit) || 0 : mark ?? 0;

  /** 입력값(가격 / 손익 금액 / 증거금 대비 %)을 방향에 맞는 익절·손절 가격으로 변환 */
  const calcTpSl = (kind: "tp" | "sl", side: Side): number | null => {
    const raw = Number(kind === "tp" ? tp : sl);
    if (!(raw > 0)) return null;
    if (tpMode === "price") return raw;
    if (!(refPrice > 0 && sizeN > 0)) return null;
    const amount = tpMode === "usd" ? raw : (raw / 100) * margin; // 목표 손익(USDT)
    const frac = amount / sizeN;
    const up = (kind === "tp") === (side === "long"); // 익절(롱)·손절(숏)은 위쪽
    const price = refPrice * (up ? 1 + frac : 1 - frac);
    return price > 0 ? Number(price.toPrecision(8)) : null;
  };

  const submit = (side: Side) => {
    if (reduce) {
      run(
        () => reduceOnlyAction({ symbol, side, sizeUsdt: sizeN, limitPrice: type === "limit" ? Number(limit) : null }),
        type === "limit" ? "리듀스 온리 지정가 청산 주문을 등록했습니다." : "포지션을 줄였습니다.",
      );
      return;
    }
    const tpP = tpsl ? calcTpSl("tp", side) : null;
    const slP = tpsl ? calcTpSl("sl", side) : null;
    if (tpsl && ((tp && tpP === null) || (sl && slP === null))) {
      toast.show("익절/손절 값이 올바르지 않습니다. 금액을 먼저 입력해 주세요.");
      return;
    }
    run(
      () => placeOrderAction({ symbol, side, sizeUsdt: sizeN, leverage: lev, marginMode, limitPrice: type === "limit" ? Number(limit) : null, tp: tpP, sl: slP }),
      type === "limit" ? "지정가 주문을 등록했습니다." : "주문이 체결되었습니다.",
    );
  };

  const disabled = pending || !loggedIn || sizeN < (reduce ? 0.01 : 10) || (type === "limit" && !(Number(limit) > 0));
  // 리듀스 온리: 줄일 포지션이 없는 쪽 버튼은 비활성화
  const noTarget = (side: Side) => reduce && notional(side === "long" ? "short" : "long") <= 0;
  // 예상 청산가: 격리는 진입가·레버리지로, 교차는 잔고와 다른 교차 포지션까지 합쳐서 계산
  const crossPositions = allPositions.filter((p) => p.margin_mode === "cross");
  const estLiq = (side: Side): string => {
    if (!(refPrice > 0 && sizeN > 0)) return "N/A";
    if (marginMode === "isolated") return fmtPrice(liqPrice(side, refPrice, lev));
    const v = crossLiqPrice({ side, entry: refPrice, sizeUsdt: sizeN, leverage: lev, balance, positions: crossPositions, prices });
    return v === null ? "청산 없음" : fmtPrice(v);
  };

  return (
    <Card className="space-y-3">
      {/* 주문 유형 */}
      <div className="grid grid-cols-2 border-b text-sm font-medium">
        {(["market", "limit"] as const).map((t) => (
          <button key={t} type="button" onClick={() => setType(t)} className={cn("-mb-px border-b-2 pb-2", type === t ? "border-foreground text-foreground" : "border-transparent text-muted-foreground")}>
            {t === "market" ? "시장가" : "지정가"}
          </button>
        ))}
      </div>

      {/* 마진 모드 */}
      <div>
        <div className="grid grid-cols-2 gap-1 rounded-lg border bg-muted/40 p-1 text-xs font-medium">
          {(["isolated", "cross"] as const).map((m) => (
            <button
              key={m}
              type="button"
              disabled={lockedMode !== null && lockedMode !== m}
              onClick={() => onMarginMode(m)}
              className={cn("rounded-md py-1.5 disabled:cursor-not-allowed disabled:opacity-40", marginMode === m ? "bg-foreground text-background" : "text-muted-foreground")}
            >
              {MARGIN_MODE_LABEL[m]}
            </button>
          ))}
        </div>
        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
          {lockedMode !== null && <span title="이 종목에 열린 포지션·주문이 있어 마진 모드가 고정됩니다.">🔒 </span>}
          {marginMode === "isolated"
            ? "격리: 이 포지션에 넣은 증거금만 위험합니다. 청산돼도 잔고는 그대로예요."
            : "교차: 주문 가능 잔고와 교차 포지션의 손익 전체가 담보입니다. 청산가가 더 멀지만, 청산되면 교차 포지션이 모두 정리되고 잔고도 0이 됩니다."}
        </p>
      </div>

      {/* 레버리지 */}
      <div>
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">
            <span className="text-muted-foreground">레버리지</span> {lev}x
            {lockedLev !== null && <span className="ml-1.5 text-xs font-normal text-muted-foreground" title="이 종목에 열린 포지션이 있어 레버리지가 고정됩니다. 포지션을 모두 청산하면 바꿀 수 있습니다.">🔒 포지션 고정</span>}
          </span>
          <span className="text-xs text-muted-foreground">
            {reduce ? "줄일 수 있는 규모" : "거래 가능 규모"} <span className="font-semibold tabular-nums text-foreground">${fmtUsd(reduce ? reduceMax : power)}</span>
          </span>
        </div>
        {!reduce && lockedLev === null && <LeverageSlider className="mt-2" value={lev} onChange={setLev} />}
      </div>

      {type === "limit" && (
        <Field label="지정가 (USDT)">
          <input className={inputCls} inputMode="decimal" value={limit} onChange={(e) => setLimit(e.target.value)} placeholder={mark ? fmtPrice(mark) : ""} />
        </Field>
      )}

      {/* 금액 */}
      <label className="flex h-10 items-center rounded-lg border bg-muted/40 px-3 text-sm focus-within:ring-2 focus-within:ring-ring/50">
        <span className="text-muted-foreground underline decoration-dashed underline-offset-4">금액</span>
        <input className="min-w-0 flex-1 bg-transparent px-2 text-right tabular-nums outline-none" inputMode="decimal" value={size} onChange={(e) => setSize(e.target.value)} placeholder="0.00" />
        <span className="font-medium">USDT</span>
      </label>

      {/* 비율 슬라이더 + 퀵 버튼 */}
      <div className="flex items-center gap-3">
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={Math.round(pct)}
          onChange={(e) => setPct(Number(e.target.value))}
          aria-label="주문 비율"
          className="h-1 flex-1 cursor-pointer accent-foreground"
        />
        <span className="flex h-8 w-16 items-center justify-end rounded-lg border bg-muted/40 px-2 text-xs tabular-nums">{Math.round(pct)} %</span>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {[25, 50, 75, 100].map((p) => (
          <button key={p} type="button" className="rounded-lg border py-1.5 text-sm hover:bg-muted" onClick={() => setPct(p)}>
            {p}%
          </button>
        ))}
      </div>

      {/* 리듀스 온리 */}
      <label className="flex cursor-pointer items-center gap-2 text-sm" title="새 포지션을 열지 않고, 반대 방향 포지션을 줄이기만 합니다.">
        <input type="checkbox" checked={reduce} onChange={(e) => { setReduce(e.target.checked); setSize(""); }} className="size-4 accent-foreground" />
        <span className="underline decoration-dashed underline-offset-4">리듀스 온리</span>
      </label>
      {reduce && (
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          새 포지션 없이 기존 포지션만 줄입니다. <b className="text-up">롱(매수)</b>은 숏을, <b className="text-down">숏(매도)</b>은 롱을 줄여요. 시장가는 바로 청산되고, 지정가는 청산 주문으로 걸립니다.
        </p>
      )}

      {/* TP/SL */}
      {!reduce && <label className="flex cursor-pointer items-center gap-2 text-sm">
        <input type="checkbox" checked={tpsl} onChange={(e) => setTpsl(e.target.checked)} className="size-4 accent-foreground" />
        <span className="underline decoration-dashed underline-offset-4">익절 / 손절</span>
      </label>}
      {tpsl && !reduce && (
        <div className="space-y-2">
          <div className="grid grid-cols-3 gap-1 rounded-lg border bg-muted/40 p-1 text-xs font-medium">
            {(
              [
                ["price", "가격 지정"],
                ["usd", "금액 ($)"],
                ["pct", "수익률 (%)"],
              ] as const
            ).map(([k, t]) => (
              <button key={k} type="button" onClick={() => setTpMode(k)} className={cn("rounded-md py-1.5", tpMode === k ? "bg-foreground text-background" : "text-muted-foreground")}>
                {t}
              </button>
            ))}
          </div>
          {(
            [
              ["익절", tp, setTp, "tp"],
              ["손절", sl, setSl, "sl"],
            ] as const
          ).map(([name, val, set, kind]) => (
            <label key={kind} className="flex h-10 items-center rounded-lg border bg-muted/40 px-3 text-sm focus-within:ring-2 focus-within:ring-ring/50">
              <span className="text-muted-foreground">{name}</span>
              <input className="min-w-0 flex-1 bg-transparent px-2 text-right tabular-nums outline-none" inputMode="decimal" value={val} onChange={(e) => set(e.target.value)} placeholder={tpMode === "pct" ? "증거금 대비" : tpMode === "usd" ? "손익 금액" : "가격"} />
              <span className="text-muted-foreground">{tpMode === "pct" ? "%" : "$"}</span>
            </label>
          ))}
          {tpMode !== "price" && (
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              {tpMode === "pct" ? "증거금 대비 수익률(레버리지 반영)로 계산합니다." : "목표 손익 금액으로 계산합니다."}
              {refPrice > 0 && sizeN > 0 && (tp || sl) ? (
                <>
                  <br />
                  롱 → 익절 {calcTpSl("tp", "long") ? fmtPrice(calcTpSl("tp", "long")!) : "—"} / 손절 {calcTpSl("sl", "long") ? fmtPrice(calcTpSl("sl", "long")!) : "—"}
                  <br />
                  숏 → 익절 {calcTpSl("tp", "short") ? fmtPrice(calcTpSl("tp", "short")!) : "—"} / 손절 {calcTpSl("sl", "short") ? fmtPrice(calcTpSl("sl", "short")!) : "—"}
                </>
              ) : (
                " 금액을 입력하면 가격이 표시됩니다."
              )}
            </p>
          )}
        </div>
      )}

      {/* 요약 */}
      {reduce ? (
        <dl className="space-y-1.5 border-t pt-3 text-xs">
          <Row k="줄일 규모" v={`${fmtUsd(Math.min(sizeN, reduceMax))}`} bold />
          <Row k="수수료 (청산)" v={`${fmtUsd(Math.min(sizeN, reduceMax) * FEE_RATE)}`} />
          <Row k="보유 숏 / 롱" v={`${fmtUsd(notional("short"))} / ${fmtUsd(notional("long"))}`} />
        </dl>
      ) : (
      <dl className="space-y-1.5 border-t pt-3 text-xs">
        <Row k="필요 증거금" v={`${fmtUsd(margin)} USDT`} />
        <Row k="수수료" v={`$${fmtUsd(fee)} / ${(FEE_RATE * 100).toFixed(2)}%`} />
        <Row k="주문 규모" v={`$${fmtUsd(sizeN)}`} bold />
        {refPrice > 0 && sizeN > 0 && <Row k="수량" v={`${(sizeN / refPrice).toFixed(5)} ${label(symbol)}`} />}
        <div className="flex justify-between">
          <dt className="text-muted-foreground underline decoration-dashed underline-offset-4">청산가 (예상)</dt>
          <dd className="text-right tabular-nums">
            <span className="text-up">롱</span> {estLiq("long")}
            <br />
            <span className="text-down">숏</span> {estLiq("short")}
          </dd>
        </div>
      </dl>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Button className="h-10 bg-up text-white hover:bg-up/90" disabled={disabled || noTarget("long")} onClick={() => submit("long")}>
          {reduce ? "매수 (숏 줄이기)" : "롱 (매수)"}
        </Button>
        <Button className="h-10 bg-down text-white hover:bg-down/90" disabled={disabled || noTarget("short")} onClick={() => submit("short")}>
          {reduce ? "매도 (롱 줄이기)" : "숏 (매도)"}
        </Button>
      </div>
      {!loggedIn && <p className="text-center text-xs text-muted-foreground">주문하려면 로그인이 필요합니다.</p>}
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function Row({ k, v, bold }: { k: string; v: string; bold?: boolean }) {
  return (
    <div className="flex justify-between">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className={cn("tabular-nums", bold ? "font-semibold" : "text-foreground")}>{v}</dd>
    </div>
  );
}

const th = "px-2 py-1.5 text-left text-xs font-medium text-muted-foreground whitespace-nowrap";
const td = "px-2 py-2 text-sm tabular-nums whitespace-nowrap";
const SideTag = ({ side }: { side: Side }) => <span className={cn("font-semibold", side === "long" ? "text-up" : "text-down")}>{side === "long" ? "롱" : "숏"}</span>;
function SymLink({ sym, current, onSelect }: { sym: string; current: string; onSelect: (s: string) => void }) {
  return (
    <button type="button" title="차트·포지션 보기" onClick={() => onSelect(sym)} className={cn("font-medium hover:text-brand hover:underline", sym === current && "text-brand")}>
      {label(sym)}
    </button>
  );
}
const Empty = ({ text }: { text: string }) => <p className="py-8 text-center text-sm text-muted-foreground">{text}</p>;

/** 포지션·거래의 공유 카드를 만들고 카드 페이지로 이동합니다. 수치는 서버가 기록에서 계산합니다. */
function ShareButton({ kind, id }: { kind: "position" | "trade"; id: string }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="ghost"
      size="xs"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        const r = await createShareAction(kind, id);
        if (r.ok) router.push(`/share/${r.id}`);
        else {
          setBusy(false);
          toast.show(r.error);
        }
      }}
    >
      <Share2 /> 공유
    </Button>
  );
}

type Pick = { current: string; onSelect: (s: string) => void };

function PositionsTable({ positions, closeOrders, prices, pending, run, current, onSelect }: { positions: Position[]; closeOrders: CloseOrder[]; prices: Record<string, number>; pending: boolean; run: Run } & Pick) {
  const [editing, setEditing] = useState<string | null>(null);
  const [closing, setClosing] = useState<string | null>(null);
  const [tp, setTp] = useState("");
  const [sl, setSl] = useState("");
  if (!positions.length) return <Empty text="열린 포지션이 없습니다." />;
  return (
    <table className="w-full min-w-[720px]">
      <thead>
        <tr>
          {["종목", "규모", "진입가", "현재가", "청산가", "익절 / 손절", "미실현 손익", ""].map((h) => (
            <th key={h} className={th}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {positions.map((p) => {
          const m = prices[p.symbol] ?? p.entry_price;
          const pnl = unrealizedPnl(p, m);
          const roe = (pnl / p.margin) * 100;
          const mine = closeOrders.filter((c) => c.position_id === p.id);
          return (
            <Fragment key={p.id}>
            <tr className="border-t align-top">
              <td className={td}>
                <SymLink sym={p.symbol} current={current} onSelect={onSelect} /> <SideTag side={p.side} /> <span className="text-xs text-muted-foreground">{MARGIN_MODE_LABEL[p.margin_mode]} {p.leverage}x</span>
              </td>
              <td className={td}>{fmtUsd(p.qty * p.entry_price)}</td>
              <td className={td}>{fmtPrice(p.entry_price)}</td>
              <td className={cn(td, "notranslate")}>{fmtPrice(m)}</td>
              <td className={cn(td, "text-down")} title={p.margin_mode === "cross" ? "교차: 다른 교차 포지션 가격이 지금 그대로라고 가정한 청산가입니다." : undefined}>
                {p.margin_mode === "cross" && p.side === "long" && p.liq_price <= 0.00000002 ? "—" : fmtPrice(p.liq_price)}
              </td>
              <td className={td}>
                {editing === p.id ? (
                  <span className="flex gap-1">
                    <input className={cn(inputCls, "h-7 w-24")} inputMode="decimal" placeholder="익절" value={tp} onChange={(e) => setTp(e.target.value)} />
                    <input className={cn(inputCls, "h-7 w-24")} inputMode="decimal" placeholder="손절" value={sl} onChange={(e) => setSl(e.target.value)} />
                    <Button size="xs" disabled={pending} onClick={() => { run(() => setTpSlAction(p.id, tp ? Number(tp) : null, sl ? Number(sl) : null), "저장했습니다."); setEditing(null); }}>저장</Button>
                  </span>
                ) : (
                  <button type="button" className="hover:underline" onClick={() => { setEditing(p.id); setTp(p.tp ? String(p.tp) : ""); setSl(p.sl ? String(p.sl) : ""); }}>
                    {p.tp ? fmtPrice(p.tp) : "—"} / {p.sl ? fmtPrice(p.sl) : "—"}
                  </button>
                )}
              </td>
              <td className={cn(td, "notranslate font-semibold", pnlCls(pnl))}>
                {signed(pnl)} <span className="text-xs">({roe >= 0 ? "+" : ""}{roe.toFixed(2)}%)</span>
                <span className="block text-[11px] font-normal text-muted-foreground" title="진입·청산 수수료(0.04%씩)를 모두 뺀 예상 손익">
                  수수료 반영 약 {signed(pnl - (p.qty * p.entry_price + p.qty * m) * FEE_RATE)}
                </span>
              </td>
              <td className={td}>
                <Button variant={closing === p.id ? "secondary" : "outline"} size="xs" onClick={() => setClosing(closing === p.id ? null : p.id)}>
                  청산{mine.length > 0 && ` (${mine.length})`}
                </Button>
                <ShareButton kind="position" id={p.id} />
              </td>
            </tr>
            {closing === p.id && (
              <tr className="bg-muted/30">
                <td colSpan={8} className="px-3 py-3">
                  <div className="flex flex-wrap items-start gap-6">
                    <ClosePanel
                      className="w-72"
                      pos={p}
                      mark={m}
                      busy={pending}
                      onMarket={(pct) => { run(() => closePositionAction(p.id, pct), pct >= 100 ? "포지션을 청산했습니다." : `${pct}% 청산했습니다.`); if (pct >= 100) setClosing(null); }}
                      onLimit={(pct, price) => run(() => placeCloseOrderAction(p.id, pct, price), "지정가 청산 주문을 등록했습니다.")}
                      onCancel={() => setClosing(null)}
                    />
                    {mine.length > 0 && (
                      <ul className="min-w-56 space-y-1 text-xs">
                        <li className="font-semibold text-muted-foreground">대기 중인 지정가 청산</li>
                        {mine.map((c) => (
                          <li key={c.id} className="flex items-center gap-2 tabular-nums">
                            {fmtPrice(c.price)} · {((c.qty / p.qty) * 100).toFixed(0)}%
                            <Button variant="ghost" size="xs" disabled={pending} onClick={() => run(() => cancelCloseOrderAction(c.id), "청산 주문을 취소했습니다.")}><X /> 취소</Button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </td>
              </tr>
            )}
            </Fragment>
          );
        })}
      </tbody>
    </table>
  );
}

/** 미체결 탭의 익절/손절 칸: 눌러서 값을 고치고 저장합니다. (차트에서 선을 끌어 바꿀 수도 있음) */
function TpSlCells({ p, pending, run }: { p: Position; pending: boolean; run: Run }) {
  const [editing, setEditing] = useState(false);
  const [tp, setTp] = useState("");
  const [sl, setSl] = useState("");
  const save = () => {
    const t = tp.trim() ? Number(tp) : null;
    const l = sl.trim() ? Number(sl) : null;
    if ((t !== null && !(t > 0)) || (l !== null && !(l > 0))) return;
    run(() => setTpSlAction(p.id, t, l), "저장했습니다.");
    setEditing(false);
  };
  return (
    <td className={td}>
      {editing ? (
        <span className="flex items-center gap-1">
          <input autoFocus className={cn(inputCls, "h-7 w-24")} inputMode="decimal" placeholder="익절" value={tp} onChange={(e) => setTp(e.target.value)} onKeyDown={(e) => e.key === "Enter" && save()} />
          <input className={cn(inputCls, "h-7 w-24")} inputMode="decimal" placeholder="손절" value={sl} onChange={(e) => setSl(e.target.value)} onKeyDown={(e) => e.key === "Enter" && save()} />
          <Button size="xs" disabled={pending} onClick={save}>저장</Button>
          <Button variant="ghost" size="xs" onClick={() => setEditing(false)}>닫기</Button>
        </span>
      ) : (
        <button type="button" title="눌러서 수정" className="hover:underline" onClick={() => { setTp(p.tp ? String(p.tp) : ""); setSl(p.sl ? String(p.sl) : ""); setEditing(true); }}>
          {p.tp ? fmtPrice(p.tp) : "—"} / {p.sl ? fmtPrice(p.sl) : "—"} <span className="inline-block -scale-x-100 text-[11px] text-muted-foreground">✎</span>
        </button>
      )}
    </td>
  );
}

function OrdersTable({ orders, closeOrders, positions, pending, run, current, onSelect }: { orders: TradeData["orders"]; closeOrders: CloseOrder[]; positions: Position[]; pending: boolean; run: Run } & Pick) {
  const tpslPositions = positions.filter((p) => p.tp || p.sl);
  if (!orders.length && !closeOrders.length && !tpslPositions.length) return <Empty text="미체결 주문이 없습니다." />;
  return (
    <table className="w-full min-w-[560px]">
      <thead>
        <tr>{["종목", "지정가", "규모", "익절 / 손절", "예약 증거금", ""].map((h) => <th key={h} className={th}>{h}</th>)}</tr>
      </thead>
      <tbody>
        {tpslPositions.map((p) => (
          <tr key={`tpsl-${p.id}`} className="border-t">
            <td className={td}><SymLink sym={p.symbol} current={current} onSelect={onSelect} /> <SideTag side={p.side} /> <span className="rounded bg-muted px-1 text-[11px]">익절/손절</span></td>
            <td className={td}>—</td>
            <td className={td}>{fmtUsd(p.qty * p.entry_price)}</td>
            <TpSlCells p={p} pending={pending} run={run} />
            <td className={td}>—</td>
            <td className={td}>
              <Button variant="ghost" size="xs" disabled={pending} onClick={() => run(() => setTpSlAction(p.id, null, null), "익절/손절을 취소했습니다.")}>
                <X /> 취소
              </Button>
            </td>
          </tr>
        ))}
        {closeOrders.map((c) => {
          const pos = positions.find((x) => x.id === c.position_id);
          if (!pos) return null;
          return (
            <tr key={c.id} className="border-t">
              <td className={td}><SymLink sym={pos.symbol} current={current} onSelect={onSelect} /> <SideTag side={pos.side} /> <span className="rounded bg-muted px-1 text-[11px]">청산 {((c.qty / pos.qty) * 100).toFixed(0)}%</span></td>
              <td className={td}>{fmtPrice(c.price)}</td>
              <td className={td}>{fmtUsd(c.qty * c.price)}</td>
              <td className={td}>—</td>
              <td className={td}>—</td>
              <td className={td}>
                <Button variant="ghost" size="xs" disabled={pending} onClick={() => run(() => cancelCloseOrderAction(c.id), "청산 주문을 취소했습니다.")}>
                  <X /> 취소
                </Button>
              </td>
            </tr>
          );
        })}
        {orders.map((o) => (
          <tr key={o.id} className="border-t">
            <td className={td}><SymLink sym={o.symbol} current={current} onSelect={onSelect} /> <SideTag side={o.side} /> <span className="text-xs text-muted-foreground">{MARGIN_MODE_LABEL[o.margin_mode]} {o.leverage}x</span></td>
            <td className={td}>{fmtPrice(o.price)}</td>
            <td className={td}>{fmtUsd(o.qty * o.price)}</td>
            <td className={td}>{o.tp ? fmtPrice(o.tp) : "—"} / {o.sl ? fmtPrice(o.sl) : "—"}</td>
            <td className={td}>{fmtUsd(o.margin)}</td>
            <td className={td}>
              <Button variant="ghost" size="xs" disabled={pending} onClick={() => run(() => cancelOrderAction(o.id), "주문을 취소했습니다.")}>
                <X /> 취소
              </Button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function HistoryTable({ trades, current, onSelect }: { trades: TradeData["trades"] } & Pick) {
  if (!trades.length) return <Empty text="아직 거래 내역이 없습니다." />;
  return (
    <table className="w-full min-w-[820px]">
      <thead>
        <tr>{["종목", "진입가", "청산가", "규모", "수수료", "손익 (수수료 포함)", "수익률", "사유", "시각", ""].map((h) => <th key={h} className={th}>{h}</th>)}</tr>
      </thead>
      <tbody>
        {trades.map((t) => (
          <tr key={t.id} className="border-t">
            <td className={td}><SymLink sym={t.symbol} current={current} onSelect={onSelect} /> <SideTag side={t.side} /> <span className="text-xs text-muted-foreground">{t.leverage}x</span></td>
            <td className={td}>{fmtPrice(t.entry_price)}</td>
            <td className={td}>{fmtPrice(t.exit_price)}</td>
            <td className={td}>{fmtUsd(t.qty * t.entry_price)}</td>
            <td className={cn(td, "text-muted-foreground")}>{fmtUsd(t.fee)}</td>
            <td className={cn(td, "font-semibold", pnlCls(t.pnl))}>{signed(t.pnl)}</td>
            <td className={cn(td, "font-semibold", pnlCls(t.pnl))}>{t.margin > 0 ? `${t.pnl >= 0 ? "+" : ""}${((t.pnl / t.margin) * 100).toFixed(2)}%` : "—"}</td>
            <td className={td}>{REASON_LABEL[t.reason]}</td>
            <td className={cn(td, "text-xs text-muted-foreground")}>{new Date(t.closed_at).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}</td>
            <td className={td}><ShareButton kind="trade" id={t.id} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
