import { NextResponse } from "next/server";
import { listContests } from "@/lib/contests/data";
import { runSnapshot } from "@/lib/contests/snapshot";
import { contestStatus, isFrozen } from "@/lib/contests/time";

/**
 * Hourly snapshot trigger. Schedule it at the top of every hour (Vercel Cron, Supabase pg_cron, GitHub Actions…):
 *   GET /api/contests/snapshot   with header  Authorization: Bearer $CRON_SECRET
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const now = Date.now();
  const results = [];
  for (const c of await listContests()) {
    const status = contestStatus(c, now);
    if (status !== "live" || isFrozen(c, now)) {
      results.push({ id: c.id, skipped: status === "live" ? "frozen" : status });
      continue;
    }
    const { snapshotAt, rows } = await runSnapshot(c, now);
    // TODO(supabase): insert `rows` into ranking_snapshots (contest_id, user_id, snapshot_at, rank, return_pct,
    // mdd_pct, trades_count, qualified, disqualified) using a service-role client, upserting on
    // (contest_id, user_id, snapshot_at) so a retried job stays idempotent.
    results.push({ id: c.id, snapshotAt, rows: rows.length });
  }
  return NextResponse.json({ ok: true, results });
}
