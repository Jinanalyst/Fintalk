"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { submitContestEntryAction } from "@/app/actions/contest";
import { COUNTRIES, isBlockedCountry } from "@/lib/contest";
import { useGuard } from "@/components/feed/interactive";
import { useToast } from "@/components/common/toast";

const field = "w-full rounded-lg border bg-card px-3 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";

export function EntryForm({ defaultUid = "", defaultCountry = "", disabled = false }: { defaultUid?: string; defaultCountry?: string; disabled?: boolean }) {
  const [uid, setUid] = useState(defaultUid);
  const [country, setCountry] = useState(defaultCountry);
  const [agree, setAgree] = useState(false);
  const [pending, start] = useTransition();
  const guard = useGuard();
  const { show } = useToast();
  const router = useRouter();
  const blocked = isBlockedCountry(country);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      const r = await submitContestEntryAction({ uid, country, agree });
      if (guard(r)) {
        show("Entry submitted. We'll verify your OKX UID shortly.");
        router.refresh();
      }
    });
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <label htmlFor="country" className="mb-1 block text-sm font-medium">Country of residence</label>
        <select id="country" required value={country} onChange={(e) => setCountry(e.target.value)} className={field} disabled={disabled}>
          <option value="" disabled>Select your country…</option>
          {COUNTRIES.map((c) => (
            <option key={c.code} value={c.code}>{c.name}</option>
          ))}
        </select>
        {blocked && (
          <p role="alert" className="mt-1.5 rounded-lg bg-down/10 p-2 text-xs text-down">
            Residents of this country are not eligible to enter the contest.
          </p>
        )}
      </div>
      <div>
        <label htmlFor="uid" className="mb-1 block text-sm font-medium">OKX UID</label>
        <input
          id="uid" required inputMode="numeric" pattern="[0-9]{6,20}" placeholder="e.g. 123456789012345678"
          value={uid} onChange={(e) => setUid(e.target.value.replace(/\D/g, ""))} className={field} disabled={disabled}
        />
        <p className="mt-1 text-xs text-muted-foreground">Find it in the OKX app under Profile → UID. It must belong to an account created with our referral link.</p>
      </div>
      <label className="flex items-start gap-2 text-xs text-muted-foreground">
        <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5" disabled={disabled} />
        <span>I confirm I do not reside in a restricted country, the UID is mine, and I accept the contest rules. Paper trading only. No purchase necessary.</span>
      </label>
      <button
        type="submit" disabled={pending || disabled || blocked || !country || !uid || !agree}
        className="w-full rounded-lg bg-brand py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "Submitting…" : "Submit for verification"}
      </button>
    </form>
  );
}
