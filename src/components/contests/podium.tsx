import { Change } from "@/components/common/bits";
import { usd } from "@/lib/contests/time";
import type { PublicRow } from "@/lib/contests/types";
import { cn } from "@/lib/utils";

const SLOT = [
  { place: "1st", h: "h-28", cls: "border-yellow-400/60 bg-yellow-400/10", emoji: "🥇" },
  { place: "2nd", h: "h-20", cls: "border-slate-400/60 bg-slate-400/10", emoji: "🥈" },
  { place: "3rd", h: "h-14", cls: "border-orange-500/60 bg-orange-500/10", emoji: "🥉" },
];

/** Final top 3 (qualified traders only), shown as a podium: 2nd · 1st · 3rd. */
export function Podium({ winners, prizes }: { winners: PublicRow[]; prizes: [number, number, number] }) {
  if (winners.length === 0) return null;
  const order = [1, 0, 2].filter((i) => winners[i]);
  return (
    <div className="rounded-xl border bg-card p-4">
      <h2 className="mb-3 text-center text-sm font-bold uppercase tracking-wide text-muted-foreground">Final results</h2>
      <div className="mx-auto grid max-w-lg grid-cols-3 items-end gap-2">
        {order.map((i) => {
          const w = winners[i];
          const s = SLOT[i];
          return (
            <div key={w.nickname} className="text-center">
              <p className="text-2xl" aria-hidden>{s.emoji}</p>
              <p className="truncate text-sm font-bold">{w.nickname}</p>
              <Change pct={w.returnPct} className="text-xs" />
              <div className={cn("mt-2 flex flex-col items-center justify-center rounded-t-lg border", s.h, s.cls)}>
                <span className="text-lg font-extrabold">{s.place}</span>
                <span className="text-xs font-semibold text-muted-foreground">{usd(prizes[i])}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
