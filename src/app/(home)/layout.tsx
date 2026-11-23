import { MainShell } from "@/components/layout/shell";

/** 홈 전용 레이아웃: 오른쪽 열에서 본문과 겹치는 카드(인기 종목·도움왕·인기 작성자)를 뺍니다. */
export default function HomeLayout({ children }: LayoutProps<"/">) {
  return <MainShell sidebar="home">{children}</MainShell>;
}
