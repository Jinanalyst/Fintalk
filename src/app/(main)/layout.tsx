import { MainShell } from "@/components/layout/shell";

export default function MainLayout({ children }: LayoutProps<"/">) {
  return <MainShell>{children}</MainShell>;
}
