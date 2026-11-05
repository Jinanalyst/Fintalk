import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
import { Change, PageTitle, SampleBadge, SectionHeader, Tag } from "@/components/common/bits";
import { NewsCard, PostCard } from "@/components/feed/cards";
import { ASSETS, CREATORS, NEWS, POSTS, fmtNum, formatPrice } from "@/lib/sample-data";

export const metadata: Metadata = {
  title: "검색",
  robots: { index: false, follow: true },
};

export default async function SearchPage({ searchParams }: PageProps<"/search">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().replace(/^\$/, "") : "";
  const lq = q.toLowerCase();
  const has = (s: string) => s.toLowerCase().includes(lq);

  const news = q ? NEWS.filter((n) => has(n.title + n.summary + n.tickers.join(" "))) : [];
  const posts = q ? POSTS.filter((p) => has(p.title + p.body.join(" ") + p.tickers.join(" "))) : [];
  const assets = q ? ASSETS.filter((a) => has(a.name + a.symbol)) : [];
  const creators = q ? CREATORS.filter((c) => has(c.name + c.handle + c.bio)) : [];
  const tags = q ? Array.from(new Set([...NEWS.flatMap((n) => n.tickers), ...POSTS.flatMap((p) => p.tickers)])).filter(has) : [];
  const total = news.length + posts.length + assets.length + creators.length;

  return (
    <div className="space-y-5">
      <PageTitle title="통합 검색" desc="뉴스 · 게시글 · 종목 · 작성자 · 태그를 한 번에 검색합니다." right={<SampleBadge label="샘플 데이터 검색" />} />
      <form action="/search" role="search">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input name="q" defaultValue={q} autoFocus={!q} placeholder="예: 비트코인, 삼성전자, NVDA" className="h-11 w-full rounded-lg border bg-card pl-9 pr-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20" />
        </div>
      </form>

      {!q && <p className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">검색어를 입력해 주세요.</p>}
      {q && total === 0 && tags.length === 0 && (
        <p className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">“{q}”에 대한 결과가 없습니다.</p>
      )}

      {assets.length > 0 && (
        <section>
          <SectionHeader title={`종목 ${assets.length}`} className="mb-2" />
          <ul className="divide-y rounded-xl border bg-card">
            {assets.map((a) => (
              <li key={a.symbol}>
                <Link href={`/market/${a.symbol}`} className="flex items-center justify-between px-4 py-3 hover:bg-muted/50">
                  <span><span className="block text-sm font-semibold">{a.name}</span><span className="text-xs text-muted-foreground">{a.symbol}</span></span>
                  <span className="text-right text-sm tabular-nums">{formatPrice(a)} <Change pct={a.changePct} className="ml-1 text-xs" /></span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {news.length > 0 && (
        <section>
          <SectionHeader title={`뉴스 ${news.length}`} className="mb-2" />
          <div className="space-y-2.5">{news.map((n) => <NewsCard key={n.id} item={n} compact />)}</div>
        </section>
      )}

      {posts.length > 0 && (
        <section>
          <SectionHeader title={`게시글 ${posts.length}`} className="mb-2" />
          <div className="space-y-2.5">{posts.map((p) => <PostCard key={p.id} post={p} />)}</div>
        </section>
      )}

      {creators.length > 0 && (
        <section>
          <SectionHeader title={`작성자 ${creators.length}`} className="mb-2" />
          <ul className="divide-y rounded-xl border bg-card">
            {creators.map((c) => (
              <li key={c.handle}>
                <Link href={`/creators/${c.handle}`} className="block px-4 py-3 hover:bg-muted/50">
                  <p className="text-sm font-semibold">{c.name} <span className="font-normal text-muted-foreground">@{c.handle}</span></p>
                  <p className="text-xs text-muted-foreground">팔로워 {fmtNum(c.followers)} · {c.bio}</p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {tags.length > 0 && (
        <section>
          <SectionHeader title={`태그 ${tags.length}`} className="mb-2" />
          <div className="flex flex-wrap gap-1.5">{tags.map((t) => <Tag key={t} href={`/search?q=${t}`}>${t}</Tag>)}</div>
        </section>
      )}
    </div>
  );
}
