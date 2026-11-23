"use client";

import { useEffect, useState } from "react";
import { splitDuration } from "@/lib/contests/time";

export function Countdown({ target, label, dark = false }: { target: string; label: string; dark?: boolean }) {
  const cell = dark ? "bg-white/10" : "bg-muted";
  const sub = dark ? "text-slate-300" : "text-muted-foreground";
  // Render nothing until mounted so server and client markup match.
  const [now, setNow] = useState<number | null>(null);
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
