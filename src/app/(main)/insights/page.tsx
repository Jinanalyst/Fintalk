import type { Metadata } from "next";
import Link from "next/link";
import { PenLine } from "lucide-react";
import { AdSlot } from "@/components/common/ad-slot";
import { PageTitle, Pills, SampleBadge } from "@/components/common/bits";
import { PostCard } from "@/components/feed/cards";
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

export default async function InsightsPage({ searchParams }: PageProps<"/insights">) {
  const sp = await searchParams;
  const cat = typeof sp.cat === "string" && CATS.some((c) => c.slug === sp.cat) ? sp.cat : "all";
  const type = TYPE_PILLS.some((t) => t.slug === sp.type && t.slug !== "all") ? (sp.type as PostType) : "all";
  const { posts: list, live } = await listPosts({ cat, sort: "hot", limit: 20, types: type === "all" ? INSIGHT_TYPES : [type] });
  const typeQ = type === "all" ? "" : `type=${type}`;

  return (
    <div className="min-w-0">
      <div className="min-w-0">
        <PageTitle
          title="인사이트"
          desc="추천과 댓글을 많이 받은 분석 글을 모았습니다."
          right={
            <Link href={`/community/write?type=${type === "all" ? "analysis" : type}`} className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90">
              <PenLine className="size-4" /> 인사이트 쓰기
            </Link>
          }
        />
        {!live && <div className="mb-3"><SampleBadge label="샘플 게시글 (Supabase 미연결)" /></div>}
        <Pills items={CATS} active={cat} hrefFor={(c) => `/insights?${c === "all" ? "" : `cat=${c}&`}${typeQ}`} className="mb-2" />
        <Pills items={TYPE_PILLS} active={type} hrefFor={(t) => `/insights?${cat === "all" ? "" : `cat=${cat}&`}${t === "all" ? "" : `type=${t}`}`} className="mb-4" />

        {list.length === 0 ? (
          <div className="rounded-xl border bg-card p-10 text-center text-sm text-muted-foreground">
            아직 인사이트가 없습니다. <Link href="/community/write?type=analysis" className="text-brand underline">첫 분석을 공유해 보세요.</Link>
          </div>
        ) : (
          <div className="space-y-2.5">
            {list.map((p, i) => (
              <div key={p.id} className="contents">
                <PostCard post={p} />
                {i === 3 && <AdSlot slot="insights-inline" />}
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="mt-4 rounded-lg border border-dashed bg-card p-3 text-xs text-muted-foreground">
        근거와 함께 작성한 글이 추천을 받으면 이곳에 소개되고, <Link href="/rewards" className="text-brand underline">리워드</Link>로 연결됩니다.
      </p>
    </div>
  );
}
