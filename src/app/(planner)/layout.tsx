import { NarrowShell } from "@/components/layout/shell";

/** Planner pages: single wide column, no community sidebars. */
export default function PlannerLayout({ children }: LayoutProps<"/">) {
  return <NarrowShell width="max-w-[1200px]">{children}</NarrowShell>;
}
