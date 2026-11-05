import { NarrowShell } from "@/components/layout/shell";

export default function NarrowLayout({ children }: LayoutProps<"/">) {
  return <NarrowShell>{children}</NarrowShell>;
}
