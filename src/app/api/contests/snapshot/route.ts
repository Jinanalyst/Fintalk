import { NextResponse } from "next/server";
import { listContests } from "@/lib/contests/data";
import { runSnapshot, writeSnapshot } from "@/lib/contests/snapshot";
import { HOUR, contestStatus, isFrozen } from "@/lib/contests/time";

/**
 * Hourly snapshot trigger. Schedule it at the top of every hour (Vercel Cron, Supabase pg_cron, GitHub Actions…):
 *   GET /api/contests/snapshot   with header  Authorization: Bearer $CRON_SECRET
 * Needs TRADE_TICK_SECRET too (the snapshot RPCs check the same secret as the price tick).
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
    // Ended within the last 6 hours → take the final snapshot (stamped at the end time).
    const justEnded = status === "ended" && now - Date.parse(c.endsAt) < 6 * HOUR;
    if ((status !== "live" && !justEnded) || (status === "live" && isFrozen(c, now))) {
      results.push({ id: c.id, skipped: status === "live" ? "frozen" : status });
      continue;
    }
    const { snapshotAt, rows } = await runSnapshot(c, now);
    const written = await writeSnapshot(c, snapshotAt, rows);
    results.push({ id: c.id, snapshotAt, rows: rows.length, written });
  }
  return NextResponse.json({ ok: true, results });
}
