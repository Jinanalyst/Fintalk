import { headers } from "next/headers";
import { ArrowUpRight } from "lucide-react";
import { bannerAllowedIn, placementOn, type Placement } from "@/lib/affiliate";
import { visitorCountry } from "@/lib/geo";
import { cn } from "@/lib/utils";

/**
 * One-line OKX partner banner (server component).
 * Renders nothing — not even in the HTML — when the banner or this placement is off, no partner URL
 * is set, or the visitor's country is blocked or unknown (fail closed).
 * Optional promotion only: never tied to contest entry, referral bonus or prizes.
 */
export async function AffiliateBanner({ placement, text, className }: { placement: Placement; text: string; className?: string }) {
  if (!placementOn(placement)) return null;
  if (!bannerAllowedIn(visitorCountry(await headers()))) return null;
  return (
    <a
      href={`/go/okx?p=${placement}`}
      target="_blank"
      rel="sponsored noopener noreferrer"
      className={cn(
        "flex items-center gap-3 rounded-xl border bg-card px-4 py-2.5 text-sm text-muted-foreground transition-colors hover:border-foreground/20 hover:text-foreground",
        className,
      )}
    >
      <span className="min-w-0 flex-1 truncate">{text}</span>
      <ArrowUpRight className="size-4 shrink-0" aria-hidden />
      <span className="shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Partner</span>
    </a>
  );
}
