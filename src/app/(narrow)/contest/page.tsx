import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { CheckCircle2, Clock, ExternalLink, XCircle, Ban } from "lucide-react";
import { Card } from "@/components/common/bits";
import { EntryForm } from "@/components/contest/entry-form";
import { CONTEST, BLOCKED_COUNTRIES, COUNTRIES, OKX_REFERRAL_URL, countryFromHeaders, isBlockedCountry } from "@/lib/contest";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export const metadata: Metadata = {
  title: "Trading Contest",
  description: "Join the free paper trading contest. Sign up on OKX with our link, verify your UID, and trade with virtual funds.",
  alternates: { canonical: "/contest" },
};

export const dynamic = "force-dynamic";

type Entry = { okx_uid: string; country: string; status: "pending" | "verified" | "rejected"; note: string | null };

const STATUS = {
  pending: { icon: Clock, text: "Verification pending", cls: "bg-amber-100 text-amber-800 dark:bg-amber-400/15 dark:text-amber-300" },
  verified: { icon: CheckCircle2, text: "Verified — you're in!", cls: "bg-up/10 text-up" },
  rejected: { icon: XCircle, text: "Verification failed", cls: "bg-down/10 text-down" },
} as const;

export default async function ContestPage() {
  const regionBlocked = isBlockedCountry(countryFromHeaders(await headers()));
  let entry: Entry | null = null;
  let loggedIn = false;
  if (isSupabaseConfigured) {
    const sb = await createClient();
    const { data: auth } = await sb.auth.getUser();
    loggedIn = !!auth.user;
    if (auth.user) {
      const { data } = await sb.from("contest_entries").select("okx_uid,country,status,note").eq("user_id", auth.user.id).maybeSingle();
      entry = (data as Entry | null) ?? null;
    }
  }
  const st = entry ? STATUS[entry.status] : null;
  const blockedNames = BLOCKED_COUNTRIES.map((c) => COUNTRIES.find((x) => x.code === c)?.name ?? c).join(", ");

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">{CONTEST.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Free to enter. Trade crypto futures with {CONTEST.startingBalance.toLocaleString("en-US")} virtual USDT and climb the leaderboard.
        </p>
      </div>

      {regionBlocked && (
        <div role="alert" className="flex items-start gap-2 rounded-lg bg-down/10 p-3 text-sm text-down">
          <Ban className="mt-0.5 size-4 shrink-0" />
          <p>Entries are not available from your region. You can read the rules, but you can&apos;t sign up or submit a UID.</p>
        </div>
      )}

      <div className="grid grid-cols-3 gap-2.5">
        {[["Prize pool", CONTEST.prize], ["Period", CONTEST.period], ["Start balance", `${CONTEST.startingBalance.toLocaleString("en-US")} USDT`]].map(([l, v]) => (
          <Card key={l} className="p-3"><p className="text-xs text-muted-foreground">{l}</p><p className="mt-1 text-sm font-bold">{v}</p></Card>
        ))}
      </div>

      <Card className="space-y-3">
        <h2 className="text-base font-bold">Step 1 · Create your OKX account with our link</h2>
        <p className="text-sm text-muted-foreground">Only accounts registered through the referral link below are eligible. If you already have an OKX account, you can&apos;t re-register it.</p>
        {regionBlocked ? null : OKX_REFERRAL_URL ? (
          <a
            href={OKX_REFERRAL_URL} target="_blank" rel="noopener noreferrer sponsored"
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            Sign up on OKX <ExternalLink className="size-4" />
          </a>
        ) : (
          <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">The referral link is not configured yet (set <code>NEXT_PUBLIC_OKX_REFERRAL_URL</code>).</p>
        )}
        <p className="text-xs text-muted-foreground">We may earn a commission when you sign up through this link. It costs you nothing.</p>
      </Card>

      <Card className="space-y-3">
        <h2 className="text-base font-bold">Step 2 · Verify your OKX UID</h2>
        {!loggedIn ? (
          <p className="text-sm text-muted-foreground">
            <Link href="/login?next=/contest" className="font-semibold text-brand hover:underline">Log in</Link> or{" "}
            <Link href="/signup" className="font-semibold text-brand hover:underline">create a FinTalk account</Link> to submit your UID.
          </p>
        ) : (
          <>
            {st && entry && (
              <div className={`flex items-start gap-2 rounded-lg p-3 text-sm ${st.cls}`} role="status">
                <st.icon className="mt-0.5 size-4 shrink-0" />
                <div>
                  <p className="font-semibold">{st.text}</p>
                  <p className="text-xs opacity-80">UID {entry.okx_uid} · {COUNTRIES.find((c) => c.code === entry!.country)?.name ?? entry.country}</p>
                  {entry.status === "rejected" && entry.note && <p className="mt-1 text-xs">{entry.note}</p>}
                </div>
              </div>
            )}
            {entry?.status === "verified" ? (
              <Link href="/trade" className="inline-block rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-primary-foreground">Start trading</Link>
            ) : (
              <EntryForm defaultUid={entry?.okx_uid} defaultCountry={entry?.country} disabled={regionBlocked} />
            )}
          </>
        )}
      </Card>

      <Card className="space-y-1.5 text-sm text-muted-foreground">
        <h2 className="text-base font-bold text-foreground">Eligibility</h2>
        <p>Not available to residents of: {blockedNames}, or any region where OKX services are restricted. One account per person and per OKX UID.</p>
        <p>Paper trading only — no real money is traded. No purchase necessary. Not financial advice.</p>
        <p className="text-xs">LEGAL REVIEW REQUIRED: final rules, prize terms and payout conditions will be published before the contest starts.</p>
      </Card>
    </div>
  );
}
