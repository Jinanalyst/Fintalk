"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

const TABS = [
  { key: "leaderboard", label: "Leaderboard" },
  { key: "rules", label: "Rules" },
  { key: "prizes", label: "Prizes & Schedule" },
] as const;

export function DetailTabs({ leaderboard, rules, prizes }: { leaderboard: React.ReactNode; rules: React.ReactNode; prizes: React.ReactNode }) {
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("leaderboard");
  const panel = { leaderboard, rules, prizes }[tab];
  return (
    <div className="space-y-4">
      <div role="tablist" className="flex gap-1 overflow-x-auto border-b">
        {TABS.map((t) => (
          <button
            key={t.key} role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)}
            className={cn(
              "-mb-px shrink-0 border-b-2 px-4 py-2 text-sm font-semibold transition-colors",
              tab === t.key ? "border-brand text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel">{panel}</div>
    </div>
  );
}
