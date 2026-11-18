import Link from "next/link";
import { Card, SampleBadge, SectionHeader } from "@/components/common/bits";
import { LiveRefresh } from "@/components/common/live-refresh";
import { fmtUsd, REASON_LABEL, START_BALANCE, symbolLabel, type ClosedTrade } from "@/lib/trade";
import type { TradeStats } from "@/lib/trade-stats";
import { cn } from "@/lib/utils";

const signed = (n: number) => `${n >= 0 ? "+" : ""}${fmtUsd(n)}`;
const tone = (n: number) => (n > 0 ? "text-up" : n < 0 ? "text-down" : "");
const pct = (n: number | null, d = 1) => (n === null ? "—" : `${n.toFixed(d)}%`);

function Tile({ label, value, sub, valueClass, hint }: { label: string; value: React.ReactNode; sub?: React.ReactNode; valueClass?: string; hint?: string }) {
  return (
    <div className="rounded-xl border bg-card px-3 py-2.5 shadow-xs" title={hint}>
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className={cn("mt-0.5 text-lg font-bold tabular-nums sm:text-xl", valueClass)}>{value}</p>
      {sub && <p className="mt-0.5 text-[11px] tabular-nums text-muted-foreground">{sub}</p>}
    </div>
  );
}

/** 누적 실현 손익 곡선 (SVG, 클라이언트 JS 없음) */
function Curve({ points }: { points: { t: number; v: number }[] }) {
  const W = 600;
  const H = 170;
  const padX = 4;
  const padY = 14;
  const vs = points.map((p) => p.v);
  const min = Math.min(0, ...vs);
  const max = Math.max(0, ...vs);
  const span = max - min || 1;
  const x = (i: number) => padX + (i / Math.max(1, points.length - 1)) * (W - padX * 2);
  const y = (v: number) => padY + (1 - (v - min) / span) * (H - padY * 2);
  const line = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");
  const last = points[points.length - 1].v;
  const area = `${line} L${x(points.length - 1).toFixed(1)},${y(0).toFixed(1)} L${x(0).toFixed(1)},${y(0).toFixed(1)} Z`;
  const up = last >= 0;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-44 w-full" role="img" aria-label={`Cumulative realized PnL ${signed(last)} USDT`} preserveAspectRatio="none">
      <line x1={0} x2={W} y1={y(0)} y2={y(0)} className="stroke-border" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
      <path d={area} className={up ? "fill-up/10" : "fill-down/10"} />
      <path d={line} fill="none" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" className={up ? "stroke-up" : "stroke-down"} />
    </svg>
  );
}

/** 비율 막대: 항목 수에 비례해 칸을 나눕니다. */
function SplitRow({ items }: { items: { label: string; n: number; cls: string }[] }) {
  const total = items.reduce((a, i) => a + i.n, 0);
  if (!total) return <p className="text-xs text-muted-foreground">No data.</p>;
  return (
    <div className="space-y-2">
      <div className="flex h-2.5 overflow-hidden rounded-full bg-muted">
        {items.filter((i) => i.n > 0).map((i) => (
          <span key={i.label} className={i.cls} style={{ width: `${(i.n / total) * 100}%` }} />
        ))}
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {items.map((i) => (
          <li key={i.label} className="inline-flex items-center gap-1.5">
            <span className={cn("size-2 rounded-full", i.cls)} />
            {i.label} <span className="font-semibold tabular-nums text-foreground">{i.n}</span>
            <span className="tabular-nums">({((i.n / total) * 100).toFixed(0)}%)</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function PaperDashboard({ stats: s, trades, sample = false }: { stats: TradeStats; trades: ClosedTrade[]; sample?: boolean }) {
  const recent = [...trades].sort((a, b) => new Date(b.closed_at).getTime() - new Date(a.closed_at).getTime()).slice(0, 10);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-bold">Paper trading dashboard</h2>
          {sample && <SampleBadge label="Sample data (Supabase not connected)" />}
        </div>
        <div className="flex items-center gap-3">
          {s.openCount > 0 && !sample && <LiveRefresh seconds={30} />}
          <Link href="/trade" className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-brand/90">Go paper trading</Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <Tile
          label="Account return"
          value={`${s.returnPct >= 0 ? "+" : ""}${s.returnPct.toFixed(2)}%`}
          valueClass={tone(s.returnPct)}
          sub={`Equity ${fmtUsd(s.equity)} USDT`}
          hint={`Versus the ${fmtUsd(START_BALANCE)} USDT starting balance. Equity = balance + open position margin + unrealized PnL`}
        />
        <Tile label="Realized PnL" value={signed(s.realized)} valueClass={tone(s.realized)} sub={`After ${fmtUsd(s.fees)} fees`} hint="Net PnL of closed trades, including fees. Keeps accumulating after account resets." />
        <Tile label="Trades" value={`${s.count}`} sub={`${s.week.count} in the last 7 days`} hint="Each close counts as one trade, including partial closes." />
        <Tile label="Win rate" value={pct(s.winRate)} sub={`${s.wins}W / ${s.losses}L`} />
        <Tile label="Payoff ratio" value={s.payoff === null ? "—" : s.payoff.toFixed(2)} sub={`Avg win ${s.avgWin === null ? "—" : signed(s.avgWin)}`} hint="Average win ÷ average loss. Above 1 means your wins are larger than your losses." />
        <Tile label="Max drawdown" value={s.mdd ? `-${s.mdd.toFixed(1)}%` : "0%"} valueClass={s.mdd ? "text-down" : ""} sub={s.mddAmount ? `-${fmtUsd(s.mddAmount)} USDT` : "—"} hint="Largest drop from a peak on the cumulative PnL curve" />
      </div>

      <Card>
        <SectionHeader
          title="Cumulative realized PnL"
          right={s.count > 0 && <span className={cn("text-sm font-bold tabular-nums", tone(s.realized))}>{signed(s.realized)} USDT</span>}
        />
        <div className="mt-2">
          {s.curve.length >= 2 ? <Curve points={s.curve} /> : <p className="py-10 text-center text-sm text-muted-foreground">The PnL curve appears once you close a trade.</p>}
        </div>
        {s.unrealized !== 0 && (
          <p className="mt-1 text-xs text-muted-foreground">
            Unrealized PnL of {s.openCount} open positions<span className={cn("font-semibold tabular-nums", tone(s.unrealized))}>{signed(s.unrealized)} USDT</span> (not included in the curve)
          </p>
        )}
      </Card>

      {s.count > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="space-y-4">
            <SectionHeader title="Trading habits" />
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">Long / Short</p>
              <SplitRow items={[{ label: "Long", n: s.bySide.long.count, cls: "bg-up" }, { label: "Short", n: s.bySide.short.count, cls: "bg-down" }]} />
              <p className="text-[11px] text-muted-foreground">
                Long win rate{s.bySide.long.count ? pct((s.bySide.long.wins / s.bySide.long.count) * 100, 0) : "—"} · Short win rate{s.bySide.short.count ? pct((s.bySide.short.wins / s.bySide.short.count) * 100, 0) : "—"}
                {s.avgLeverage !== null && ` · Avg leverage ${s.avgLeverage.toFixed(1)}x`}
              </p>
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">Close type</p>
              <SplitRow
                items={[
                  { label: REASON_LABEL.manual, n: s.byReason.manual, cls: "bg-brand" },
                  { label: REASON_LABEL.tp, n: s.byReason.tp, cls: "bg-up" },
                  { label: REASON_LABEL.sl, n: s.byReason.sl, cls: "bg-amber-500" },
                  { label: REASON_LABEL.limit, n: s.byReason.limit, cls: "bg-sky-500" },
                  { label: REASON_LABEL.liquidation, n: s.byReason.liquidation, cls: "bg-down" },
                ]}
              />
              {s.byReason.liquidation > 0 && <p className="text-[11px] text-down">{s.byReason.liquidation} liquidations — try lower leverage or set a stop loss.</p>}
            </div>
          </Card>

          <Card className="p-0">
            <div className="p-4 pb-2"><SectionHeader title="Performance by symbol" /></div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[320px] text-sm">
                <thead>
                  <tr className="text-left text-[11px] text-muted-foreground">
                    <th className="px-4 py-1.5 font-medium">Symbol</th>
                    <th className="px-2 py-1.5 text-right font-medium">Trades</th>
                    <th className="px-2 py-1.5 text-right font-medium">Win rate</th>
                    <th className="px-4 py-1.5 text-right font-medium">PnL (USDT)</th>
                  </tr>
                </thead>
                <tbody>
                  {s.bySymbol.slice(0, 8).map((y) => (
                    <tr key={y.symbol} className="border-t">
                      <td className="px-4 py-2 font-semibold">{symbolLabel(y.symbol)}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{y.count}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{pct((y.wins / y.count) * 100, 0)}</td>
                      <td className={cn("px-4 py-2 text-right font-semibold tabular-nums", tone(y.pnl))}>{signed(y.pnl)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      <Card className="p-0">
        <div className="flex items-center justify-between p-4 pb-2">
          <SectionHeader title="Recent trades" />
          {s.best && s.worst && (
            <span className="text-[11px] text-muted-foreground tabular-nums">
              Best <span className="font-semibold text-up">{signed(s.best.pnl)}</span> · Worst <span className="font-semibold text-down">{signed(s.worst.pnl)}</span>
            </span>
          )}
        </div>
        {recent.length === 0 ? (
          <p className="px-4 pb-8 pt-4 text-center text-sm text-muted-foreground">No closed trades yet. Open and close a position in paper trading to see it here.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="text-left text-[11px] text-muted-foreground">
                  <th className="px-4 py-1.5 font-medium">Symbol</th>
                  <th className="px-2 py-1.5 font-medium">Side</th>
                  <th className="px-2 py-1.5 font-medium">Close type</th>
                  <th className="px-2 py-1.5 font-medium">Closed at</th>
                  <th className="px-4 py-1.5 text-right font-medium">PnL (USDT)</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((t) => (
                  <tr key={t.id} className="border-t">
                    <td className="px-4 py-2 font-semibold">{symbolLabel(t.symbol)} <span className="text-xs font-normal text-muted-foreground">{t.leverage}x</span></td>
                    <td className={cn("px-2 py-2", t.side === "long" ? "text-up" : "text-down")}>{t.side === "long" ? "Long" : "Short"}</td>
                    <td className="px-2 py-2 text-muted-foreground">{REASON_LABEL[t.reason] ?? t.reason}</td>
                    <td className="px-2 py-2 tabular-nums text-muted-foreground">{new Date(t.closed_at).toLocaleString("en-US", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}</td>
                    <td className={cn("px-4 py-2 text-right font-semibold tabular-nums", tone(t.pnl))}>{signed(t.pnl)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <p className="text-xs leading-relaxed text-muted-foreground">
        Practice record using virtual funds; not real profit. Only you can see this page. Each close counts as one trade, including partial closes. The latest 1,000 trades are counted.
      </p>
    </div>
  );
}
