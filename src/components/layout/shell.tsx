import Link from "next/link";
import { Suspense } from "react";
import { Flame, HelpCircle } from "lucide-react";
import { AdSlot } from "@/components/common/ad-slot";
import { Card, SectionHeader } from "@/components/common/bits";
import { getPopularCreators } from "@/lib/data/creators";
import { PopularCreatorsView } from "./popular-creators";
import { listPosts } from "@/lib/data/community";
import { Header } from "./header";
import { BottomNav, SidebarNav } from "./nav";

/** 인기 작성자 (조회수 → 저장 → 좋아요 우선순위) */
export async function PopularCreators({ limit = 4 }: { limit?: number }) {
  const { items, live } = await getPopularCreators();
  return <PopularCreatorsView items={items} live={live} limit={limit} />;
}

async function RightSidebar() {
  const [{ posts: hot }, { posts: questions }] = await Promise.all([listPosts({ sort: "hot", limit: 5 }), listPosts({ sort: "new", limit: 4, types: ["question"] })]);
  return (
    <aside className="hidden space-y-4 xl:block" aria-label="사이드 정보">
      <Card>
        <SectionHeader title={<span className="inline-flex items-center gap-1.5"><HelpCircle className="size-4 text-brand" />최근 질문</span>} href="/community?type=question" />
        <ul className="mt-3 space-y-2.5">
          {questions.length === 0 && <li className="text-sm text-muted-foreground">아직 질문이 없습니다.</li>}
          {questions.map((p) => (
            <li key={p.id} className="text-sm">
              <Link href={`/community/${p.id}`} className="line-clamp-2 leading-snug hover:text-brand">
                {p.title}
                <span className="ml-1 text-xs text-muted-foreground">[{p.comments}]</span>
              </Link>
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <SectionHeader title={<span className="inline-flex items-center gap-1.5"><Flame className="size-4 text-down" />인기 게시글</span>} href="/community" />
        <ol className="mt-3 space-y-2.5">
          {hot.length === 0 && <li className="text-sm text-muted-foreground">아직 게시글이 없습니다.</li>}
          {hot.map((p, i) => (
            <li key={p.id} className="flex gap-2.5 text-sm">
              <span className="w-4 shrink-0 text-center font-bold text-brand">{i + 1}</span>
              <Link href={`/community/${p.id}`} className="line-clamp-2 leading-snug hover:text-brand">
                {p.title}
                <span className="ml-1 text-xs text-muted-foreground">[{p.comments}]</span>
              </Link>
            </li>
          ))}
        </ol>
      </Card>

      <PopularCreators limit={4} />
      <AdSlot slot="sidebar" className="min-h-[250px]" />
      <p className="px-1 text-[11px] leading-relaxed text-muted-foreground">
        핀톡의 게시글은 이용자의 개인 의견이며 투자 권유가 아닙니다. 투자 판단과 책임은 본인에게 있습니다.
      </p>
    </aside>
  );
}

/** 3열 레이아웃: 왼쪽 메뉴 / 가운데 콘텐츠 / 오른쪽 인기·질문 */
export function MainShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <div className="mx-auto grid w-full max-w-[1320px] flex-1 gap-5 px-3 py-4 pb-24 sm:px-4 lg:grid-cols-[210px_minmax(0,1fr)] lg:pb-8 xl:grid-cols-[210px_minmax(0,1fr)_320px]">
        <aside className="hidden lg:block" aria-label="카테고리">
          <div className="sticky top-[72px] max-h-[calc(100vh-88px)] overflow-y-auto pr-1">
            <Suspense fallback={null}>
              <SidebarNav showMain={false} />
            </Suspense>
          </div>
        </aside>
        <main className="min-w-0">{children}</main>
        <RightSidebar />
      </div>
      <BottomNav />
    </>
  );
}

/** 사이드바 없는 단일 컬럼 (로그인/글쓰기 등) */
export function NarrowShell({ children, width = "max-w-2xl" }: { children: React.ReactNode; width?: string }) {
  return (
    <>
      <Header />
      <main className={`mx-auto w-full flex-1 px-3 py-6 pb-24 sm:px-4 lg:pb-10 ${width}`}>{children}</main>
      <BottomNav />
    </>
  );
}

