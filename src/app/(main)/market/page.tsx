import type { Metadata } from "next";
import Link from "next/link";
import { Info } from "lucide-react";
import { Change, PageTitle, Pills, SampleBadge } from "@/components/common/bits";
import { WatchStar } from "@/components/feed/interactive";
import { Sparkline } from "@/components/market/charts";
import { getWatchState } from "@/lib/data/community";
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
  const list = ASSETS.filter((a) => (q ? true : a.market === m) && (!q || (a.name + a.symbol).toLowerCase().includes(q)));
  const up = ASSETS.filter((a) => a.market === m).sort((a, b) => b.changePct - a.changePct);

  return (
    <div>
      <PageTitle title="마켓" desc="종목을 검색하고 관심 종목을 등록해 보세요." right={<SampleBadge label="샘플 시세 (API 연동 전)" />} />

      <div className="mb-4 flex items-start gap-2 rounded-lg border bg-card p-3 text-xs text-muted-foreground">
        <Info className="mt-0.5 size-4 shrink-0 text-brand" />
        <p>
          표시된 가격은 디자인 확인용 <b>샘플 값</b>입니다. 실제 연동 후에는 데이터 제공처의 범위와 라이선스에 따라 <b>지연 시세</b>일 수 있으며, 이 경우 화면에 명확히 표시됩니다.
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

      {!q && up.length > 1 && (
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
                <p className="text-xs text-muted-foreground">{a.symbol} · {a.unit}</p>
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
    </div>
  );
}
