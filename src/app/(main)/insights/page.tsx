import type { Metadata } from "next";
import Link from "next/link";
import { PenLine } from "lucide-react";
import { AdSlot } from "@/components/common/ad-slot";
import { PageTitle, Pills, SampleBadge } from "@/components/common/bits";
import { InsightCard } from "@/components/feed/cards";
import { listPosts } from "@/lib/data/community";
import { INSIGHT_TYPES, POST_TYPES, type Category, type PostType } from "@/lib/sample-data";

export const metadata: Metadata = {
  title: "인사이트",
  description: "국내 주식, 미국 주식, 암호화폐 투자자들이 쓴 양질의 분석 콘텐츠를 만나보세요.",
};

const CATS: Category[] = [
  { slug: "all", label: "전체" },
  { slug: "kr-stock", label: "국내 주식" },
  { slug: "us-stock", label: "미국 주식" },
  { slug: "crypto", label: "암호화폐" },
  { slug: "macro", label: "거시경제" },
  { slug: "trading", label: "트레이딩" },
];

const TYPE_PILLS = [{ slug: "all", label: "전체 유형" }, ...POST_TYPES.filter((t) => t.insight).map((t) => ({ slug: t.slug as string, label: t.label }))];
const SORTS = [
  { slug: "hot", label: "🔥 인기" },
  { slug: "new", label: "최신" },
  { slug: "comments", label: "댓글순" },
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
        title="근거 있는 분석을, 깊이 있게 읽어요"
        desc="시장 분석, 투자 전략, 매매 복기, 학습 자료. 출처와 데이터가 있는 글을 모았어요."
        right={
          <Link href={`/community/write?type=${type === "all" ? "analysis" : type}`} className="inline-flex h-11 items-center gap-1.5 rounded-xl bg-brand px-5 text-sm font-bold text-primary-foreground hover:opacity-90">
            <PenLine className="size-4" /> 인사이트 쓰기
          </Link>
        }
      />
      {!live && <SampleBadge label="샘플 게시글 (Supabase 미연결)" />}

      {lead && (
        <section aria-label="이번 주 인사이트">
          <p className="mb-2 text-xs font-bold text-amber-700 dark:text-amber-300">이번 주 인사이트</p>
          <InsightCard post={lead} featured />
        </section>
      )}

      <div className="space-y-2">
        <Pills items={CATS} active={cat} hrefFor={(c) => href({ cat: c })} />
        <Pills items={TYPE_PILLS} active={type} hrefFor={(t) => href({ type: t })} />
        <Pills items={SORTS} active={sort} hrefFor={(s) => href({ sort: s })} />
      </div>

      {rest.length === 0 && !lead ? (
        <div className="rounded-2xl border bg-card p-10 text-center text-sm text-muted-foreground">
          아직 인사이트가 없습니다. <Link href="/community/write?type=analysis" className="text-brand underline">첫 분석을 공유해 보세요.</Link>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {rest.map((p, i) => (
            <div key={p.id} className="contents">
              <InsightCard post={p} />
              {i === 3 && <div className="md:col-span-2"><AdSlot slot="insights-inline" /></div>}
            </div>
          ))}
        </div>
      )}

      <section className="rounded-2xl bg-brand-soft p-5 sm:p-6">
        <h2 className="text-lg font-extrabold tracking-tight text-brand">내 분석이 누군가의 판단에 도움이 돼요</h2>
        <ul className="mt-2 space-y-1 text-sm text-foreground/80">
          <li>① 결론을 첫 문단에 먼저 써요</li>
          <li>② 근거 데이터와 출처를 붙여요</li>
          <li>③ 이해관계가 있으면 표시해요</li>
        </ul>
        <Link href="/community/write?type=analysis" className="mt-4 inline-flex h-11 items-center rounded-xl bg-brand px-5 text-sm font-bold text-primary-foreground hover:opacity-90">첫 인사이트 쓰기</Link>
        <p className="mt-3 text-xs text-muted-foreground">인사이트는 기여도에 더 높은 가중치(+5점)로 기록됩니다. 현금 정산은 준비 중이에요.</p>
      </section>
    </div>
  );
}
