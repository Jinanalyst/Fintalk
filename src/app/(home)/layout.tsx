import { MainShell, NarrowShell } from "@/components/layout/shell";
import { isOn } from "@/lib/features";

/**
 * "/" is the contest landing page (full width, no side columns).
 * With the communityHome flag on it goes back to the old community home with its own right column.
 */
export default function HomeLayout({ children }: LayoutProps<"/">) {
  if (isOn("communityHome")) return <MainShell sidebar="home">{children}</MainShell>;
  return <NarrowShell width="max-w-5xl">{children}</NarrowShell>;
}
