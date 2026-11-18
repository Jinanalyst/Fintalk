import { Suspense } from "react";
import { getPopularCreators } from "@/lib/data/creators";
import { PopularCreatorsView } from "./popular-creators";
import { MyContributionCard, TopHelpersCard, TrendingTickersCard } from "./side-cards";
import { Header } from "./header";
import { Footer } from "./footer";
import { BottomNav, SidebarNav } from "./nav";

/** 인기 작성자 (조회수 → 저장 → 좋아요 우선순위) */
export async function PopularCreators({ limit = 4 }: { limit?: number }) {
  const { items, live } = await getPopularCreators();
  return <PopularCreatorsView items={items} live={live} limit={limit} />;
}

/** 오른쪽 열: 내 기여도 · 도움왕 · 인기 작성자 (홈 하단에서도 같은 카드를 재사용) */
export function SideCards({ trending = true }: { trending?: boolean }) {
  return (
    <>
      <MyContributionCard />
      {trending && <TrendingTickersCard />}
      <TopHelpersCard />
      <PopularCreators limit={4} />
    </>
  );
}

function RightSidebar() {
  return (
    <aside className="hidden space-y-4 xl:block" aria-label="Side information">
      <SideCards />
      <p className="px-1 text-[11px] leading-relaxed text-muted-foreground">
        Posts on Chainlabs are personal opinions of users and are not investment advice. You are solely responsible for your own investment decisions.
      </p>
    </aside>
  );
}

/** 3열 레이아웃: 왼쪽 메뉴 / 가운데 콘텐츠 / 오른쪽 기여도·도움왕·인기 작성자 */
export function MainShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <div className="mx-auto grid w-full max-w-[1320px] flex-1 gap-5 px-3 py-4 pb-24 sm:px-4 lg:grid-cols-[210px_minmax(0,1fr)] lg:pb-8 xl:grid-cols-[210px_minmax(0,1fr)_320px]">
        <aside className="hidden lg:block" aria-label="Categories">
          <div className="sticky top-[72px] max-h-[calc(100vh-88px)] overflow-y-auto pr-1">
            <Suspense fallback={null}>
              <SidebarNav showMain={false} />
            </Suspense>
          </div>
        </aside>
        <main className="min-w-0">{children}</main>
        <RightSidebar />
      </div>
      <Footer />
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
      <Footer />
      <BottomNav />
    </>
  );
}

