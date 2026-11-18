import type { Metadata } from "next";
import { Suspense } from "react";
import { PlannerApp } from "@/components/planner/planner-app";

export const metadata: Metadata = {
  title: "Trading Planner",
  description: "Plan every trade, close it in your journal, and see what your results say about your style.",
  robots: { index: false, follow: true },
};

export default function PlannerAppPage() {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl border bg-card" />}>
      <PlannerApp />
    </Suspense>
  );
}
