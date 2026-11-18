import { NarrowShell } from "@/components/layout/shell";

export default function ContestsLayout({ children }: LayoutProps<"/">) {
  return <NarrowShell width="max-w-5xl">{children}</NarrowShell>;
}
