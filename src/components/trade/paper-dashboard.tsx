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
    <svg viewBox={`0 0 ${W} ${H}`} className="h-44 w-full" role="img" aria-label={`누적 실현 손익 ${signed(last)} USDT`} preserveAspectRatio="none">
      <line x1={0} x2={W} y1={y(0)} y2={y(0)} className="stroke-border" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
      <path d={area} className={up ? "fill-up/10" : "fill-down/10"} />
      <path d={line} fill="none" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" className={up ? "stroke-up" : "stroke-down"} />
    </svg>
  );
}

/** 비율 막대: 항목 수에 비례해 칸을 나눕니다. */
function SplitRow({ items }: { items: { label: string; n: number; cls: string }[] }) {
  const total = items.reduce((a, i) => a + i.n, 0);
  if (!total) return <p className="text-xs text-muted-foreground">데이터가 없습니다.</p>;
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
          <h2 className="text-base font-bold">모의투자 연습 대시보드</h2>
          {sample && <SampleBadge label="샘플 데이터 (Supabase 미연결)" />}
        </div>
        <div className="flex items-center gap-3">
          {s.openCount > 0 && !sample && <LiveRefresh seconds={30} />}
          <Link href="/trade" className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-brand/90">모의투자 하러 가기</Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <Tile
          label="계좌 수익률"
          value={`${s.returnPct >= 0 ? "+" : ""}${s.returnPct.toFixed(2)}%`}
          valueClass={tone(s.returnPct)}
          sub={`총자산 ${fmtUsd(s.equity)} USDT`}
          hint={`시작 자금 ${fmtUsd(START_BALANCE)} USDT 대비. 총자산 = 잔고 + 열린 포지션 증거금 + 미실현 손익`}
        />
        <Tile label="실현 손익" value={signed(s.realized)} valueClass={tone(s.realized)} sub={`수수료 ${fmtUsd(s.fees)} 반영`} hint="청산된 거래의 순손익 합계(수수료 포함). 계정 초기화 후에도 누적됩니다." />
        <Tile label="거래 횟수" value={`${s.count}회`} sub={`최근 7일 ${s.week.count}회`} hint="청산 1건 = 1회. 부분 청산도 각각 1회로 셉니다." />
        <Tile label="승률" value={pct(s.winRate)} sub={`${s.wins}승 ${s.losses}패`} />
        <Tile label="손익비" value={s.payoff === null ? "—" : s.payoff.toFixed(2)} sub={`평균 이익 ${s.avgWin === null ? "—" : signed(s.avgWin)}`} hint="평균 이익 ÷ 평균 손실. 1보다 크면 이길 때 더 크게 이긴다는 뜻입니다." />
        <Tile label="최대 낙폭" value={s.mdd ? `-${s.mdd.toFixed(1)}%` : "0%"} valueClass={s.mdd ? "text-down" : ""} sub={s.mddAmount ? `-${fmtUsd(s.mddAmount)} USDT` : "—"} hint="누적 손익 곡선에서 고점 대비 가장 크게 내려간 폭" />
      </div>

      <Card>
        <SectionHeader
          title="누적 실현 손익"
          right={s.count > 0 && <span className={cn("text-sm font-bold tabular-nums", tone(s.realized))}>{signed(s.realized)} USDT</span>}
        />
        <div className="mt-2">
          {s.curve.length >= 2 ? <Curve points={s.curve} /> : <p className="py-10 text-center text-sm text-muted-foreground">거래를 청산하면 손익 곡선이 그려집니다.</p>}
        </div>
        {s.unrealized !== 0 && (
          <p className="mt-1 text-xs text-muted-foreground">
            열린 포지션 {s.openCount}개의 미실현 손익 <span className={cn("font-semibold tabular-nums", tone(s.unrealized))}>{signed(s.unrealized)} USDT</span> (곡선에는 포함되지 않음)
          </p>
        )}
      </Card>

      {s.count > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="space-y-4">
            <SectionHeader title="거래 습관" />
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">롱 / 숏</p>
              <SplitRow items={[{ label: "롱", n: s.bySide.long.count, cls: "bg-up" }, { label: "숏", n: s.bySide.short.count, cls: "bg-down" }]} />
              <p className="text-[11px] text-muted-foreground">
                롱 승률 {s.bySide.long.count ? pct((s.bySide.long.wins / s.bySide.long.count) * 100, 0) : "—"} · 숏 승률 {s.bySide.short.count ? pct((s.bySide.short.wins / s.bySide.short.count) * 100, 0) : "—"}
                {s.avgLeverage !== null && ` · 평균 레버리지 ${s.avgLeverage.toFixed(1)}x`}
              </p>
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">청산 방식</p>
              <SplitRow
                items={[
                  { label: REASON_LABEL.manual, n: s.byReason.manual, cls: "bg-brand" },
                  { label: REASON_LABEL.tp, n: s.byReason.tp, cls: "bg-up" },
                  { label: REASON_LABEL.sl, n: s.byReason.sl, cls: "bg-amber-500" },
                  { label: REASON_LABEL.limit, n: s.byReason.limit, cls: "bg-sky-500" },
                  { label: REASON_LABEL.liquidation, n: s.byReason.liquidation, cls: "bg-down" },
                ]}
              />
              {s.byReason.liquidation > 0 && <p className="text-[11px] text-down">강제청산 {s.byReason.liquidation}회 — 레버리지를 낮추거나 손절을 설정해 보세요.</p>}
            </div>
          </Card>

          <Card className="p-0">
            <div className="p-4 pb-2"><SectionHeader title="종목별 성과" /></div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[320px] text-sm">
                <thead>
                  <tr className="text-left text-[11px] text-muted-foreground">
                    <th className="px-4 py-1.5 font-medium">종목</th>
                    <th className="px-2 py-1.5 text-right font-medium">거래</th>
                    <th className="px-2 py-1.5 text-right font-medium">승률</th>
                    <th className="px-4 py-1.5 text-right font-medium">손익 (USDT)</th>
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
          <SectionHeader title="최근 거래" />
          {s.best && s.worst && (
            <span className="text-[11px] text-muted-foreground tabular-nums">
              최고 <span className="font-semibold text-up">{signed(s.best.pnl)}</span> · 최악 <span className="font-semibold text-down">{signed(s.worst.pnl)}</span>
            </span>
          )}
        </div>
        {recent.length === 0 ? (
          <p className="px-4 pb-8 pt-4 text-center text-sm text-muted-foreground">아직 청산한 거래가 없습니다. 모의투자에서 포지션을 열고 청산하면 여기에 기록됩니다.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="text-left text-[11px] text-muted-foreground">
                  <th className="px-4 py-1.5 font-medium">종목</th>
                  <th className="px-2 py-1.5 font-medium">방향</th>
                  <th className="px-2 py-1.5 font-medium">청산 방식</th>
                  <th className="px-2 py-1.5 font-medium">청산 시각</th>
                  <th className="px-4 py-1.5 text-right font-medium">손익 (USDT)</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((t) => (
                  <tr key={t.id} className="border-t">
                    <td className="px-4 py-2 font-semibold">{symbolLabel(t.symbol)} <span className="text-xs font-normal text-muted-foreground">{t.leverage}x</span></td>
                    <td className={cn("px-2 py-2", t.side === "long" ? "text-up" : "text-down")}>{t.side === "long" ? "롱" : "숏"}</td>
                    <td className="px-2 py-2 text-muted-foreground">{REASON_LABEL[t.reason] ?? t.reason}</td>
                    <td className="px-2 py-2 tabular-nums text-muted-foreground">{new Date(t.closed_at).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}</td>
                    <td className={cn("px-4 py-2 text-right font-semibold tabular-nums", tone(t.pnl))}>{signed(t.pnl)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <p className="text-xs leading-relaxed text-muted-foreground">
        가상 자금으로 진행하는 연습 기록이며 실제 수익이 아닙니다. 이 화면은 본인에게만 보입니다. 거래 횟수는 청산 1건당 1회이고 부분 청산도 각각 셉니다. 최근 1,000건까지 집계합니다.
      </p>
    </div>
  );
}
