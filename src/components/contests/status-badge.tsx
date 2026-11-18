import { cn } from "@/lib/utils";
import type { ContestStatus } from "@/lib/contests/types";

const STYLE: Record<ContestStatus, { label: string; cls: string }> = {
  live: { label: "Live", cls: "bg-up/10 text-up" },
  upcoming: { label: "Upcoming", cls: "bg-amber-100 text-amber-800 dark:bg-amber-400/15 dark:text-amber-300" },
  ended: { label: "Ended", cls: "bg-muted text-muted-foreground" },
};

export function StatusBadge({ status, className }: { status: ContestStatus; className?: string }) {
  const s = STYLE[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold", s.cls, className)}>
      {status === "live" && <span className="size-1.5 animate-pulse rounded-full bg-up" />}
      {s.label}
    </span>
  );
}
