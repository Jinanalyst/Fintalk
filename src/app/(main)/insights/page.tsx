import type { Metadata } from "next";
import Link from "next/link";
import { ChevronDown, PenLine } from "lucide-react";
import { PageTitle, Pills, SampleBadge } from "@/components/common/bits";
import { InsightCard } from "@/components/feed/cards";
import { listPosts } from "@/lib/data/community";
import { INSIGHT_TYPES, POST_TYPES, type Category, type PostType } from "@/lib/sample-data";

export const metadata: Metadata = {
  title: "Insights",
  description: "Read quality analysis written by stock and crypto investors.",
  alternates: { canonical: "/insights" },
};

const CATS: Category[] = [
  { slug: "all", label: "All" },
  { slug: "us-stock", label: "US stocks" },
  { slug: "crypto", label: "Crypto" },
  { slug: "macro", label: "Macro" },
  { slug: "trading", label: "Trading" },
];

const TYPE_PILLS = [{ slug: "all", label: "All types" }, ...POST_TYPES.filter((t) => t.insight).map((t) => ({ slug: t.slug as string, label: t.label }))];
const SORTS = [
  { slug: "hot", label: "Hot" },
  { slug: "new", label: "Newest" },
  { slug: "comments", label: "Most comments" },
];
type Sort = "hot" | "new" | "comments";

export default async function InsightsPage({ searchParams }: PageProps<"/insights">) {
  const sp = await searchParams;
  const cat = typeof sp.cat === "string" && CATS.some((c) => c.slug === sp.cat) ? sp.cat : "all";
  const type = TYPE_PILLS.some((t) => t.slug === sp.type && t.slug !== "all") ? (sp.type as PostType) : "all";
  const sort: Sort = sp.sort === "new" || sp.sort === "comments" ? sp.sort : "hot";
  const { posts, live } = await listPosts({ cat, sort, limit: 21, types: type === "all" ? INSIGHT_TYPES : [type] });

  const href = (o: { cat?: string; type?: string; sort?: string }) => {
    const p = new URLSearchParams();
    const c = o.cat ?? cat;
    const t = o.type ?? type;
    const s = o.sort ?? sort;
    if (c !== "all") p.set("cat", c);
    if (t !== "all") p.set("type", t);
    if (s !== "hot") p.set("sort", s);
    const qs = p.toString();
    return qs ? `/insights?${qs}` : "/insights";
  };

  // 인기 정렬의 첫 글을 대표 인사이트로 크게 노출 (필터 없이 첫 화면일 때)
  const lead = sort === "hot" && cat === "all" && type === "all" ? posts[0] : undefined;
  const rest = lead ? posts.slice(1) : posts;

  return (
    <div className="min-w-0 space-y-5">
      <PageTitle
        title="Read evidence-based analysis in depth"
        desc="Market analysis, strategies, trade reviews and learning resources, with sources and data."
        right={
          <Link href={`/community/write?type=${type === "all" ? "analysis" : type}`} className="inline-flex h-11 items-center gap-1.5 rounded-xl bg-brand px-5 text-sm font-bold text-primary-foreground hover:opacity-90">
            <PenLine className="size-4" /> Write an insight
          </Link>
        }
      />
      {!live && <SampleBadge label="Sample posts (Supabase not connected)" />}

      {lead && (
        <section aria-label="Insights this week">
          <p className="mb-2 text-xs font-bold text-amber-700 dark:text-amber-300">Insights this week</p>
          <InsightCard post={lead} featured />
        </section>
      )}

      <div className="space-y-3">
        <Pills items={CATS} active={cat} hrefFor={(c) => href({ cat: c })} />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <details className="group relative">
            <summary className="inline-flex h-9 cursor-pointer list-none items-center gap-1.5 rounded-lg border bg-card px-3 text-sm font-medium hover:bg-muted [&::-webkit-details-marker]:hidden">
              {TYPE_PILLS.find((t) => t.slug === type)?.label}
              <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
            </summary>
            <ul className="absolute left-0 z-10 mt-1 min-w-48 overflow-hidden rounded-xl border bg-card p-1 shadow-lg">
              {TYPE_PILLS.map((t) => (
                <li key={t.slug}>
                  <Link href={href({ type: t.slug })} className={`block rounded-lg px-3 py-2 text-sm hover:bg-muted ${t.slug === type ? "font-bold text-brand" : ""}`}>{t.label}</Link>
                </li>
              ))}
            </ul>
          </details>
          <nav aria-label="Sort" className="flex items-center gap-1 text-sm">
            {SORTS.map((o) => (
              <Link key={o.slug} href={href({ sort: o.slug })} className={`rounded-md px-2.5 py-1.5 ${o.slug === sort ? "bg-muted font-bold text-foreground" : "text-muted-foreground hover:text-foreground"}`}>{o.label}</Link>
            ))}
          </nav>
        </div>
      </div>

      {rest.length === 0 && !lead ? (
        <div className="rounded-2xl border bg-card p-10 text-center text-sm text-muted-foreground">
          No insights yet. <Link href="/community/write?type=analysis" className="text-brand underline">Share the first analysis.</Link>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {rest.map((p) => (
            <div key={p.id} className="contents">
              <InsightCard post={p} />
            </div>
          ))}
        </div>
      )}

      <section className="rounded-2xl bg-brand-soft p-5 sm:p-6">
        <h2 className="text-lg font-extrabold tracking-tight text-brand">Your analysis can help someone decide</h2>
        <ul className="mt-2 space-y-1 text-sm text-foreground/80">
          <li>1. Put the conclusion in the first paragraph</li>
          <li>2. Attach supporting data and sources</li>
          <li>3. Disclose any conflicts of interest</li>
        </ul>
        <Link href="/community/write?type=analysis" className="mt-4 inline-flex h-11 items-center rounded-xl bg-brand px-5 text-sm font-bold text-primary-foreground hover:opacity-90">Write your first insight</Link>
        <p className="mt-3 text-xs text-muted-foreground">Insights earn extra contribution points (+5). Cash payouts are not available yet.</p>
      </section>
    </div>
  );
}
