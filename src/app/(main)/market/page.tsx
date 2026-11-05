import type { Metadata } from "next";
import Link from "next/link";
import { Info } from "lucide-react";
import { Change, PageTitle, Pills, SampleBadge } from "@/components/common/bits";
import { WatchStar } from "@/components/feed/interactive";
import { Sparkline } from "@/components/market/charts";
import { TradingViewWidget } from "@/components/market/tv-widget";
import { getWatchState } from "@/lib/data/community";
import { getCryptoQuotes, tvItems } from "@/lib/providers";
import { ASSETS, MARKET_TABS, formatPrice, type MarketType } from "@/lib/sample-data";

export const metadata: Metadata = {
  title: "마켓",
  description: "암호화폐, 국내·미국 주식, 주요 지수, 외환, 원자재 시세를 한눈에 확인하세요.",
};

export default async function MarketPage({ searchParams }: PageProps<"/market">) {
  const sp = await searchParams;
  const watch = await getWatchState();
  const m = (MARKET_TABS.some((t) => t.slug === sp.m) ? sp.m : "crypto") as MarketType;
  const q = typeof sp.q === "string" ? sp.q.trim().toLowerCase() : "";
  // 암호화폐는 Upbit 실시간 시세로 덮어씁니다. 그 외 시장은 TradingView 위젯이 실시간 시세를 직접 표시합니다.
  const crypto = await getCryptoQuotes(ASSETS.filter((a) => a.market === "crypto").map((a) => a.symbol)).catch(() => null);
  const real = (a: (typeof ASSETS)[number]) => (crypto?.[a.symbol] ? { ...a, price: crypto[a.symbol].price, changePct: crypto[a.symbol].changePct } : a);
  const isReal = (a: (typeof ASSETS)[number]) => !!crypto?.[a.symbol];
  const widgetMode = !q && m !== "crypto";
  const widgetItems = tvItems(ASSETS.filter((a) => a.market === m));
  const list = ASSETS.map(real).filter((a) => (q ? true : a.market === m) && (!q || (a.name + a.symbol).toLowerCase().includes(q)));
  const up = ASSETS.filter((a) => a.market === m).map(real).sort((a, b) => b.changePct - a.changePct);

  return (
    <div>
      <PageTitle title="마켓" desc="종목을 검색하고 관심 종목을 등록해 보세요." right={widgetMode ? <span className="text-xs text-muted-foreground">시세 출처: TradingView</span> : !q && crypto ? <span className="text-xs text-muted-foreground">시세 출처: Upbit</span> : <SampleBadge label="샘플 시세" />} />

      <div className="mb-4 flex items-start gap-2 rounded-lg border bg-card p-3 text-xs text-muted-foreground">
        <Info className="mt-0.5 size-4 shrink-0 text-brand" />
        <p>
          암호화폐는 <b>Upbit</b>, 그 외 시장은 <b>TradingView</b> 에서 제공하는 시세이며 제공처 정책에 따라 <b>지연</b>될 수 있습니다. 검색 결과의 일부 값은 샘플일 수 있으며, 투자 권유가 아닙니다.
        </p>
      </div>

      <form action="/market" className="mb-3">
        <input
          name="q" defaultValue={q} placeholder="종목 검색 (이름 또는 코드)"
          className="h-10 w-full rounded-lg border bg-card px-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
        />
      </form>

      {!q && <Pills items={MARKET_TABS} active={m} hrefFor={(s) => `/market?m=${s}`} className="mb-4" />}
      {q && <p className="mb-3 text-sm text-muted-foreground">“{q}” 검색 결과 {list.length}건 · <Link href="/market" className="text-brand">초기화</Link></p>}

      {!widgetMode && !q && up.length > 1 && (
        <div className="mb-4 grid grid-cols-2 gap-2.5">
          <div className="rounded-xl border bg-card p-3">
            <p className="text-xs text-muted-foreground">상승률 1위</p>
            <p className="font-bold">{up[0].name}</p>
            <Change pct={up[0].changePct} />
          </div>
          <div className="rounded-xl border bg-card p-3">
            <p className="text-xs text-muted-foreground">하락률 1위</p>
            <p className="font-bold">{up[up.length - 1].name}</p>
            <Change pct={up[up.length - 1].changePct} />
          </div>
        </div>
      )}

      {widgetMode ? (
        <div className="rounded-xl border bg-card p-3">
          {widgetItems.length > 0 && <TradingViewWidget kind="market-quotes" items={widgetItems} title={MARKET_TABS.find((t) => t.slug === m)?.label} className="h-[560px]" />}
          {widgetItems.length < list.length && (
            <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-400/10 dark:text-amber-200">국내 종목·지수의 실시간 시세는 데이터 라이선스를 확보한 뒤 제공됩니다. 현재는 종목 페이지에서 차트와 커뮤니티를 이용할 수 있습니다.</p>
          )}
          <p className="mt-2 text-xs text-muted-foreground">종목 이름을 눌러 TradingView 에서 상세 시세를 볼 수 있고, 아래 목록에서 핀톡 종목 페이지로 이동할 수 있습니다.</p>
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {list.map((a) => <li key={a.symbol}><Link href={`/market/${a.symbol}`} className="rounded-md bg-muted px-2 py-1 text-xs hover:text-brand">{a.name}</Link></li>)}
          </ul>
        </div>
      ) : (
      <div className="overflow-hidden rounded-xl border bg-card">
        <div className="grid grid-cols-[28px_1fr_auto_auto] items-center gap-3 border-b bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground sm:grid-cols-[28px_1fr_140px_90px_100px]">
          <span />
          <span>종목</span>
          <span className="hidden text-right sm:block">현재가</span>
          <span className="text-right sm:hidden">현재가 / 등락</span>
          <span className="hidden text-right sm:block">등락률</span>
          <span className="hidden sm:block" />
        </div>
        {list.length === 0 && <p className="p-8 text-center text-sm text-muted-foreground">검색 결과가 없습니다.</p>}
        <ul className="divide-y">
          {list.map((a) => (
            <li key={a.symbol} className="grid grid-cols-[28px_1fr_auto] items-center gap-3 px-3 py-2.5 sm:grid-cols-[28px_1fr_140px_90px_100px]">
              <WatchStar symbol={a.symbol} live={watch.live} initial={watch.set.has(a.symbol)} />
              <Link href={`/market/${a.symbol}`} className="min-w-0 hover:text-brand">
                <p className="truncate text-sm font-semibold">{a.name}</p>
                <p className="text-xs text-muted-foreground">{a.symbol} · {a.unit}{isReal(ASSETS.find((x) => x.symbol === a.symbol)!) ? " · Upbit" : " · 샘플"}</p>
              </Link>
              <div className="text-right tabular-nums sm:contents">
                <p className="text-sm font-medium sm:text-right">{formatPrice(a)}</p>
                <p className="sm:text-right"><Change pct={a.changePct} className="text-xs sm:text-sm" /></p>
              </div>
              <div className="hidden justify-end sm:flex">
                <Sparkline values={a.series.slice(-30)} up={a.changePct >= 0} />
              </div>
            </li>
          ))}
        </ul>
      </div>
      )}
    </div>
  );
}
