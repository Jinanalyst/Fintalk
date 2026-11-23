"use client";

import { useEffect, useState } from "react";
import { splitDuration } from "@/lib/contests/time";

/**
 * `serverNow`: the time the server rendered the page. Passing it puts real numbers in the HTML, so the
 * countdown never shows dashes — even before (or without) JavaScript. Without it, "--" is shown until mounted.
 */
export function Countdown({ target, label, dark = false, serverNow }: { target: string; label: string; dark?: boolean; serverNow?: number }) {
  const cell = dark ? "bg-white/10" : "bg-muted";
  const sub = dark ? "text-slate-300" : "text-muted-foreground";
  // First render uses the server's clock (same value on server and client → no hydration mismatch).
  const [now, setNow] = useState<number | null>(serverNow ?? null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const t = splitDuration(now === null ? 0 : Date.parse(target) - now);
  const cells: [number, string][] = [[t.d, "d"], [t.h, "h"], [t.m, "m"], [t.s, "s"]];
  return (
    <div>
      <p className={`text-xs ${sub}`}>{label}</p>
      <div className="mt-1 flex gap-1.5" aria-live="off" suppressHydrationWarning>
        {cells.map(([v, u]) => (
          <div key={u} className={`min-w-12 rounded-lg px-2 py-1.5 text-center ${cell}`}>
            <span className="text-lg font-extrabold tabular-nums">{now === null ? "--" : String(v).padStart(2, "0")}</span>
            <span className={`ml-0.5 text-xs ${sub}`}>{u}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
