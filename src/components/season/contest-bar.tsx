import Link from "next/link";
import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { daysUntil } from "@/lib/season";
import type { MyContest, Season } from "@/lib/contests/season-data";
import type { SeasonPhase } from "@/lib/season";
import { InviteButton } from "./invite-button";
import { JoinSeasonButton } from "./join-button";
import { TimeLeft } from "./time-left";

export type AccountKind = "contest" | "practice";

const pct = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;

/** Sticky bar on /trade: Contest / Practice switch + my contest standing. */
export function ContestBar({
  season,
  phase,
  me,
  active,
  contestUsable,
  regOpen,
  inviteCode,
}: {
  season: Season;
  phase: SeasonPhase;
  me: MyContest | null;
  active: AccountKind;
  /** The Contest tab can be selected (round live or ended, and the user is in it). */
  contestUsable: boolean;
  regOpen: boolean;
  inviteCode: string | null;
}) {
  const days = daysUntil(season.startsAt);
  const tab = "flex h-9 items-center gap-1.5 rounded-md px-3 text-sm font-bold transition-colors";

  return (
    <div className="sticky top-14 z-30 -mx-3 mb-3 border-b bg-background/95 px-3 py-2 backdrop-blur sm:-mx-4 sm:px-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {/* Account switch */}
        <div className="flex rounded-lg border bg-muted/50 p-0.5" role="tablist" aria-label="Account">
          {contestUsable ? (
            <Link href="/trade?account=contest" role="tab" aria-selected={active === "contest"} className={cn(tab, active === "contest" ? "bg-card shadow-xs" : "text-muted-foreground hover:text-foreground")}>
              Contest
            </Link>
          ) : (
            <span role="tab" aria-disabled="true" aria-selected={false} className={cn(tab, "cursor-not-allowed text-muted-foreground/60")} title={phase === "registration" ? `Contest starts in ${days}d` : "You are not in this season"}>
              <Lock className="size-3.5" /> Contest
            </span>
          )}
          <Link href="/trade?account=practice" role="tab" aria-selected={active === "practice"} className={cn(tab, active === "practice" ? "bg-card shadow-xs" : "text-muted-foreground hover:text-foreground")}>
            Practice
          </Link>
        </div>

        {/* Status */}
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          {phase === "registration" ? (
            <>
              <span className="font-bold">
                Contest starts in <TimeLeft target={season.startsAt} className="tabular-nums text-brand" />
              </span>
              {me?.joined ? (
                <span className="text-muted-foreground">
                  You&apos;re in · start balance <b className="text-foreground tabular-nums">${me.startBalance.toLocaleString("en-US")}</b>
                </span>
              ) : (
                <span className="text-muted-foreground">Practice is open now.</span>
              )}
            </>
          ) : active === "contest" && me?.funded ? (
            <>
              <Stat label="Rank" value={me.rank ? `#${me.rank}` : "—"} />
              <Stat label="Return" value={me.returnPct === null ? "—" : pct(me.returnPct)} tone={me.returnPct === null ? undefined : me.returnPct >= 0 ? "text-up" : "text-down"} />
              <Stat label={phase === "live" ? "Ends in" : "Ended"} value={phase === "live" ? <TimeLeft target={season.endsAt} /> : "Final"} />
            </>
          ) : phase === "live" ? (
            <span className="text-muted-foreground">
              {me?.joined ? "Switch to Contest to trade your contest account." : "Practice account · not on the leaderboard."} Contest ends in <TimeLeft target={season.endsAt} className="font-semibold text-foreground" />
            </span>
          ) : (
            <span className="text-muted-foreground">{season.label} has ended. Practice stays open.</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {me && !me.joined && regOpen && <JoinSeasonButton label={`Join ${season.label}`} />}
          {inviteCode && phase !== "ended" && <InviteButton code={inviteCode} bonusPct={season.referralBonusPct} compact />}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: React.ReactNode; tone?: string }) {
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={cn("font-extrabold tabular-nums", tone)}>{value}</span>
    </span>
  );
}
