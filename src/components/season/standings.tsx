import { UserAvatar } from "@/components/common/user-avatar";
import type { LeaderboardRow } from "@/lib/contests/types";
import type { RecentTrader } from "@/lib/contests/season-data";
import { timeAgo } from "@/lib/time";
import { cn } from "@/lib/utils";

const MEDAL = ["bg-yellow-400/20 text-yellow-700 dark:text-yellow-300", "bg-slate-400/20 text-slate-600 dark:text-slate-300", "bg-orange-500/20 text-orange-700 dark:text-orange-300"];
const pct = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;

/** Contest standings: Rank · Trader · Return · Max drawdown. */
export function StandingsTable({ rows, meId, className }: { rows: LeaderboardRow[]; meId?: string | null; className?: string }) {
  return (
    <div className={cn("overflow-hidden rounded-2xl border bg-card shadow-xs", className)}>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/40 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <th scope="col" className="w-14 px-3 py-2.5 sm:w-16 sm:px-4">Rank</th>
            <th scope="col" className="px-3 py-2.5 sm:px-4">Trader</th>
            <th scope="col" className="px-3 py-2.5 text-right sm:px-4">Return</th>
            <th scope="col" className="px-3 py-2.5 text-right sm:px-4">Max DD</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const mine = !!meId && r.userId === meId;
            return (
              <tr key={r.userId} className={cn("border-b last:border-0", r.disqualified && "text-muted-foreground opacity-70", mine && "bg-brand-soft")}>
                <td className="px-3 py-3 sm:px-4">
                  {r.rank === null ? (
                    <span className="text-muted-foreground">—</span>
                  ) : (
                    <span className={cn("inline-flex size-7 items-center justify-center rounded-full text-sm font-bold tabular-nums", r.rank <= 3 && MEDAL[r.rank - 1])}>{r.rank}</span>
                  )}
                </td>
                <td className="max-w-0 px-3 py-3 sm:px-4">
                  <span className={cn("block truncate font-semibold", r.disqualified && "line-through")} title={r.dqReason}>{r.nickname}</span>
                  {mine && <span className="mt-0.5 inline-block rounded bg-brand px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">YOU</span>}
                </td>
                <td className={cn("px-3 py-3 text-right font-bold tabular-nums sm:px-4", r.returnPct > 0 ? "text-up" : r.returnPct < 0 ? "text-down" : "")}>{pct(r.returnPct)}</td>
                <td className="px-3 py-3 text-right tabular-nums text-muted-foreground sm:px-4">{r.mddPct.toFixed(1)}%</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Before the round starts: who signed up most recently. */
export function RecentTraders({ traders, className }: { traders: RecentTrader[]; className?: string }) {
  return (
    <ul className={cn("divide-y overflow-hidden rounded-2xl border bg-card shadow-xs", className)}>
      {traders.map((t) => (
        <li key={t.nickname + t.joinedAt} className="flex items-center gap-3 px-4 py-3">
          <UserAvatar name={t.nickname} url={t.avatar} className="size-8 text-sm" />
          <span className="min-w-0 flex-1 truncate text-sm font-semibold">{t.nickname}</span>
          <span className="shrink-0 text-xs text-muted-foreground">joined {timeAgo(t.joinedAt)}</span>
        </li>
      ))}
    </ul>
  );
}
