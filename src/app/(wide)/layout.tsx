import { NarrowShell } from "@/components/layout/shell";

/** 사이드바 없이 화면을 넓게 쓰는 페이지 (모의투자 등) */
export default function WideLayout({ children }: LayoutProps<"/">) {
  return <NarrowShell width="max-w-[1760px]">{children}</NarrowShell>;
}
