import type { Metadata } from "next";
import { ContestsTable } from "@/components/contests/contests-table";
import { getContestSummaries } from "@/lib/contests/data";

export const metadata: Metadata = {
  title: "Trading Contests",
  description: "Free paper trading contests. Browse every round, check the leaderboards and join the next one.",
  alternates: { canonical: "/contests" },
};

export const dynamic = "force-dynamic";

export default async function ContestsPage() {
  const contests = await getContestSummaries();
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Trading Contests</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Trade with 10,000 virtual USDT, climb the leaderboard and win USDT prizes. Rankings update hourly.
        </p>
      </div>
      <ContestsTable contests={contests} />
    </div>
  );
}
