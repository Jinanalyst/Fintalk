"use client";

import { useEffect, useState } from "react";
import { splitDuration } from "@/lib/contests/time";

/**
 * Compact live countdown: "12d 4h", "3h 12m", "4m 09s".
 * Pass `serverNow` (Date.now() on the server) so the HTML already has the value; otherwise "—" until mounted.
 */
export function TimeLeft({ target, className, serverNow }: { target: string; className?: string; serverNow?: number }) {
  const [now, setNow] = useState<number | null>(serverNow ?? null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  if (now === null) return <span className={className}>—</span>;
  const t = splitDuration(Date.parse(target) - now);
  const text = t.d > 0 ? `${t.d}d ${t.h}h` : t.h > 0 ? `${t.h}h ${t.m}m` : `${t.m}m ${String(t.s).padStart(2, "0")}s`;
  return <span className={className} suppressHydrationWarning>{text}</span>;
}
