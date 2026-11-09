"use client";

import dynamic from "next/dynamic";
import { Fragment, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, RotateCcw, Share2, X } from "lucide-react";
import { Card } from "@/components/common/bits";
import { useToast } from "@/components/common/toast";
import { Button } from "@/components/ui/button";
import { createShareAction } from "@/app/actions/share";
import { cancelCloseOrderAction, cancelOrderAction, closePositionAction, placeCloseOrderAction, placeOrderAction, resetAccountAction, setTpSlAction } from "@/app/actions/trade";
import type { TradeData } from "@/lib/data/trade";
import { FEE_RATE, MAX_LEVERAGE, REASON_LABEL, SYMBOLS, fmtPrice, fmtUsd, liqPrice, unrealizedPnl, type CloseOrder, type Position, type Side } from "@/lib/trade";
import { cn } from "@/lib/utils";
import { ClosePanel } from "./close-panel";
import { OrderBook } from "./orderbook";
import { TradingViewChart } from "./tv-chart";
import { usePriceFeed } from "./use-price-feed";

// 차트는 브라우저 저장소(지표 설정·그림)를 읽으므로 서버에서는 그리지 않습니다.
const PriceChart = dynamic(() => import("./chart").then((m) => m.PriceChart), {
  ssr: false,
  loading: () => <div className="grid h-full place-items-center text-sm text-muted-foreground">차트 불러오는 중…</div>,
});

const LEVERAGES = [1, 2, 3, 5, 10, 20, 50];
const inputCls = "h-9 w-full rounded-lg border bg-background px-3 text-sm tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring/50";
const pnlCls = (n: number) => (n >= 0 ? "text-up" : "text-down");
const signed = (n: number) => `${n >= 0 ? "+" : ""}${fmtUsd(n)}`;
const label = (s: string) => SYMBOLS.find((x) => x.symbol === s)?.label ?? s;

export function TradeTerminal({ data }: { data: TradeData }) {
  const { prices, live } = usePriceFeed(data.prices);
  const [symbol, setSymbol] = useState<string>(SYMBOLS[0].symbol);
  const [tab, setTab] = useState<"positions" | "orders" | "history">("positions");
  const [chartMode, setChartMode] = useState<"lite" | "tv">("lite");
  const [picked, setPicked] = useState<{ price: number; n: number } | null>(null);
  const [pending, start] = useTransition();
  const toast = useToast();
  const mark = prices[symbol];
  // 참조가 안정적이어야 차트의 가격선이 시세 틱마다 다시 그려지지 않습니다.
  const router = useRouter();
  const symCloseOrders = useMemo(() => {
    const ids = new Set(data.positions.filter((p) => p.symbol === symbol).map((p) => p.id));
    return data.closeOrders.filter((c) => ids.has(c.position_id));
  }, [data.closeOrders, data.positions, symbol]);
  const symPositions = useMemo(() => data.positions.filter((p) => p.symbol === symbol), [data.positions, symbol]);
  const symOrders = useMemo(() => data.orders.filter((o) => o.symbol === symbol), [data.orders, symbol]);

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
      {/* 계정 요약 */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat title="총 자산" value={`${fmtUsd(equity)} USDT`} />
        <Stat title="주문 가능" value={`${fmtUsd(data.balance)} USDT`} />
        <Stat title="사용 중 증거금" value={`${fmtUsd(marginUsed)} USDT`} />
        <Stat title="미실현 손익" value={`${signed(unreal)} USDT`} tone={pnlCls(unreal)} />
      </div>

      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_280px] xl:grid-cols-[minmax(0,1fr)_260px_320px]">
        <Card className="flex min-w-0 flex-col p-0 md:col-span-2 xl:col-span-1">
          <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
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
            <span className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex rounded-md border p-0.5 text-[11px] font-medium">
                {(
                  [
                    ["lite", "포지션 표시"],
                    ["tv", "트레이딩뷰"],
                  ] as const
                ).map(([k, t]) => (
                  <button key={k} type="button" onClick={() => setChartMode(k)} className={cn("rounded px-2 py-1", chartMode === k ? "bg-foreground text-background" : "text-muted-foreground")}>
                    {t}
                  </button>
                ))}
              </span>
              <span className="text-base font-bold tabular-nums text-foreground">{mark ? fmtPrice(mark) : "—"}</span>
              <span className="flex items-center gap-1.5">
                <span className={cn("size-1.5 rounded-full", live ? "bg-up" : "bg-muted-foreground/40")} />
                {live ? "실시간" : "연결 중"}
              </span>
            </span>
          </div>
          <div className="h-[420px] xl:h-[560px]">
            {chartMode === "lite" ? (
              <PriceChart symbol={symbol} price={mark} positions={symPositions}
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
                  const r = await placeOrderAction({ symbol, side: o.side, sizeUsdt: o.sizeUsdt, leverage: o.leverage, limitPrice: o.limitPrice, tp: o.tp, sl: o.sl });
                  toast.show(r.ok ? (r.status === "open" ? "지정가 주문을 등록했습니다." : "주문이 체결되었습니다.") : r.error);
                  return r.ok;
                }}
              />
            ) : (
              <TradingViewChart symbol={symbol} />
            )}
          </div>
        </Card>

        <div className="min-h-[420px] xl:h-[618px]">
          <OrderBook symbol={symbol} mark={mark} onPick={(price) => setPicked({ price, n: (picked?.n ?? 0) + 1 })} />
        </div>

        <OrderForm symbol={symbol} mark={mark} balance={data.balance} loggedIn={data.loggedIn} pending={pending} run={run} picked={picked} />
      </div>

      {/* 포지션 / 주문 / 내역 */}
      <Card className="p-0">
        <div className="flex items-center gap-1 border-b px-3 pt-2">
          {(
            [
              ["positions", `포지션 ${data.positions.length}`],
              ["orders", `미체결 ${data.orders.length + data.closeOrders.length}`],
              ["history", "거래 내역"],
            ] as const
          ).map(([k, t]) => (
            <button
              key={k}
              type="button"
              onClick={() => setTab(k)}
              className={cn(
                "-mb-px border-b-2 px-3 py-2 text-sm font-medium",
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
            <PositionsTable positions={data.positions} closeOrders={data.closeOrders} prices={prices} pending={pending} run={run} />
          ) : tab === "orders" ? (
            <OrdersTable orders={data.orders} closeOrders={data.closeOrders} positions={data.positions} pending={pending} run={run} />
          ) : (
            <HistoryTable trades={data.trades} />
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

function OrderForm({ symbol, mark, balance, loggedIn, pending, run, picked }: { symbol: string; mark?: number; balance: number; loggedIn: boolean; pending: boolean; run: Run; picked: { price: number; n: number } | null }) {
  const [type, setType] = useState<"market" | "limit">("market");
  const [size, setSize] = useState("");
  const [lev, setLev] = useState(10);
  const [levOpen, setLevOpen] = useState(false);
  const [limit, setLimit] = useState("");
  const [tpsl, setTpsl] = useState(false);
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
  const maxSize = Math.floor((power / (1 + FEE_RATE * lev)) * 100) / 100; // 수수료까지 감안한 최대 주문 규모
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
    const tpP = tpsl ? calcTpSl("tp", side) : null;
    const slP = tpsl ? calcTpSl("sl", side) : null;
    if (tpsl && ((tp && tpP === null) || (sl && slP === null))) {
      toast.show("익절/손절 값이 올바르지 않습니다. 금액을 먼저 입력해 주세요.");
      return;
    }
    run(
      () => placeOrderAction({ symbol, side, sizeUsdt: sizeN, leverage: lev, limitPrice: type === "limit" ? Number(limit) : null, tp: tpP, sl: slP }),
      type === "limit" ? "지정가 주문을 등록했습니다." : "주문이 체결되었습니다.",
    );
  };

  const disabled = pending || !loggedIn || sizeN < 10 || (type === "limit" && !(Number(limit) > 0));
  const dash = (v: string) => (refPrice > 0 && sizeN > 0 ? v : "N/A");

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

      {/* 레버리지 (맨 위) */}
      <div>
        <div className="flex items-center justify-between text-sm">
          <button type="button" onClick={() => setLevOpen((o) => !o)} className="flex items-center gap-1 font-medium" aria-expanded={levOpen}>
            <span className="text-muted-foreground">레버리지</span> {lev}x <ChevronRight className={cn("size-3.5 transition-transform", levOpen && "rotate-90")} />
          </button>
          <span className="text-xs text-muted-foreground">
            거래 가능 규모 <span className="font-semibold tabular-nums text-foreground">${fmtUsd(power)}</span>
          </span>
        </div>
        {levOpen && (
          <div className="mt-2 flex flex-wrap gap-1">
            {LEVERAGES.filter((l) => l <= MAX_LEVERAGE).map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => { setLev(l); setLevOpen(false); }}
                className={cn("rounded-md border px-2.5 py-1 text-xs font-medium", l === lev ? "border-brand bg-brand-soft text-brand" : "text-muted-foreground hover:bg-muted")}
              >
                {l}x
              </button>
            ))}
          </div>
        )}
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

      {/* TP/SL */}
      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <input type="checkbox" checked={tpsl} onChange={(e) => setTpsl(e.target.checked)} className="size-4 accent-foreground" />
        <span className="underline decoration-dashed underline-offset-4">익절 / 손절</span>
      </label>
      {tpsl && (
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
      <dl className="space-y-1.5 border-t pt-3 text-xs">
        <Row k="필요 증거금" v={`${fmtUsd(margin)} USDT`} />
        <Row k="수수료" v={`$${fmtUsd(fee)} / ${(FEE_RATE * 100).toFixed(2)}%`} />
        <Row k="주문 규모" v={`$${fmtUsd(sizeN)}`} bold />
        {refPrice > 0 && sizeN > 0 && <Row k="수량" v={`${(sizeN / refPrice).toFixed(5)} ${label(symbol)}`} />}
        <div className="flex justify-between">
          <dt className="text-muted-foreground underline decoration-dashed underline-offset-4">청산가 (예상)</dt>
          <dd className="text-right tabular-nums">
            <span className="text-up">롱</span> {dash(fmtPrice(liqPrice("long", refPrice, lev)))}
            <br />
            <span className="text-down">숏</span> {dash(fmtPrice(liqPrice("short", refPrice, lev)))}
          </dd>
        </div>
      </dl>

      <div className="grid grid-cols-2 gap-2">
        <Button className="h-10 bg-up text-white hover:bg-up/90" disabled={disabled} onClick={() => submit("long")}>
          롱 (매수)
        </Button>
        <Button className="h-10 bg-down text-white hover:bg-down/90" disabled={disabled} onClick={() => submit("short")}>
          숏 (매도)
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

function PositionsTable({ positions, closeOrders, prices, pending, run }: { positions: Position[]; closeOrders: CloseOrder[]; prices: Record<string, number>; pending: boolean; run: Run }) {
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
                {label(p.symbol)} <SideTag side={p.side} /> <span className="text-xs text-muted-foreground">{p.leverage}x</span>
              </td>
              <td className={td}>{fmtUsd(p.qty * p.entry_price)}</td>
              <td className={td}>{fmtPrice(p.entry_price)}</td>
              <td className={td}>{fmtPrice(m)}</td>
              <td className={cn(td, "text-down")}>{fmtPrice(p.liq_price)}</td>
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
              <td className={cn(td, "font-semibold", pnlCls(pnl))}>
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

function OrdersTable({ orders, closeOrders, positions, pending, run }: { orders: TradeData["orders"]; closeOrders: CloseOrder[]; positions: Position[]; pending: boolean; run: Run }) {
  if (!orders.length && !closeOrders.length) return <Empty text="미체결 주문이 없습니다." />;
  return (
    <table className="w-full min-w-[560px]">
      <thead>
        <tr>{["종목", "지정가", "규모", "익절 / 손절", "예약 증거금", ""].map((h) => <th key={h} className={th}>{h}</th>)}</tr>
      </thead>
      <tbody>
        {closeOrders.map((c) => {
          const pos = positions.find((x) => x.id === c.position_id);
          if (!pos) return null;
          return (
            <tr key={c.id} className="border-t">
              <td className={td}>{label(pos.symbol)} <SideTag side={pos.side} /> <span className="rounded bg-muted px-1 text-[11px]">청산 {((c.qty / pos.qty) * 100).toFixed(0)}%</span></td>
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
            <td className={td}>{label(o.symbol)} <SideTag side={o.side} /> <span className="text-xs text-muted-foreground">{o.leverage}x</span></td>
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

function HistoryTable({ trades }: { trades: TradeData["trades"] }) {
  if (!trades.length) return <Empty text="아직 거래 내역이 없습니다." />;
  return (
    <table className="w-full min-w-[820px]">
      <thead>
        <tr>{["종목", "진입가", "청산가", "규모", "수수료", "손익 (수수료 포함)", "수익률", "사유", "시각", ""].map((h) => <th key={h} className={th}>{h}</th>)}</tr>
      </thead>
      <tbody>
        {trades.map((t) => (
          <tr key={t.id} className="border-t">
            <td className={td}>{label(t.symbol)} <SideTag side={t.side} /> <span className="text-xs text-muted-foreground">{t.leverage}x</span></td>
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
