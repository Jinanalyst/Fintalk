import type { Metadata } from "next";
import Link from "next/link";
import { PenLine } from "lucide-react";
import { AdSlot } from "@/components/common/ad-slot";
import { PageTitle, Pills, SampleBadge } from "@/components/common/bits";
import { PostCard } from "@/components/feed/cards";
import { BOARD_CATEGORIES, POSTS, boardLabel, sortPosts, type SortKey } from "@/lib/sample-data";

export const metadata: Metadata = {
  title: "커뮤니티",
  description: "주식, 암호화폐, 거시경제, 투자 전략까지. 투자자들의 생각과 질문을 자유롭게 나눠보세요.",
};

const SORTS: { slug: SortKey; label: string }[] = [
  { slug: "hot", label: "🔥 인기순" },
  { slug: "new", label: "최신순" },
  { slug: "comments", label: "댓글순" },
];

export default async function CommunityPage({ searchParams }: PageProps<"/community">) {
  const sp = await searchParams;
  const cat = typeof sp.cat === "string" && BOARD_CATEGORIES.some((c) => c.slug === sp.cat) ? sp.cat : "all";
  const sort: SortKey = sp.sort === "new" || sp.sort === "comments" ? sp.sort : "hot";
  const filtered = POSTS.filter((p) => cat === "all" || p.category === cat);
  const list = sortPosts(filtered, sort);
  const catQ = cat === "all" ? "" : `cat=${cat}&`;

  return (
    <div>
      <PageTitle
        title={cat === "all" ? "커뮤니티" : boardLabel(cat)}
        desc="인기순은 추천·댓글·게시 시각을 함께 반영합니다."
        right={
          <Link
            href="/community/write"
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            <PenLine className="size-4" /> 글쓰기
          </Link>
        }
      />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <SampleBadge label="샘플 게시글" />
      </div>
      <Pills items={BOARD_CATEGORIES} active={cat} hrefFor={(c) => (c === "all" ? `/community?sort=${sort}` : `/community?cat=${c}&sort=${sort}`)} className="mb-3 lg:hidden" />
      <Pills items={SORTS} active={sort} hrefFor={(s) => `/community?${catQ}sort=${s}`} className="mb-4" />

      {list.length === 0 ? (
        <div className="rounded-xl border bg-card p-10 text-center text-sm text-muted-foreground">
          아직 게시글이 없습니다. 첫 글을 작성해보세요.
        </div>
      ) : (
        <div className="space-y-2.5">
          {list.map((p, i) => (
            <div key={p.id} className="contents">
              <PostCard post={p} />
              {i === 4 && <AdSlot slot="feed-inline" />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
