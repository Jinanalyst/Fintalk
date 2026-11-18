"use client";

import Link from "next/link";
import { useActionState } from "react";
import { startProCheckout, type CheckoutState } from "@/app/actions/planner";
import { PRO_PRICE } from "@/lib/planner/config";
import { useIsPro } from "./use-pro";
import { Notice, primaryBtn } from "./ui";
import { cn } from "@/lib/utils";

export function CheckoutButton() {
  const [state, action, pending] = useActionState<CheckoutState, FormData>(startProCheckout, null);
  const { pro, signedIn, loading } = useIsPro();

  if (pro) {
    return (
      <div className="space-y-3">
        <Notice tone="up">You already own Lifetime Pro. Thank you!</Notice>
        <Link href="/planner/app?tab=analysis" className={cn(primaryBtn, "w-full")}>Open my Planner</Link>
      </div>
    );
  }
  return (
    <form action={action} className="space-y-3">
      {!loading && !signedIn && (
        <Notice tone="warn">You’ll sign in first, so Pro unlocks on your account automatically after payment.</Notice>
      )}
      {state?.error && <Notice tone="down">{state.error}</Notice>}
      <button type="submit" disabled={pending} className={cn(primaryBtn, "h-12 w-full text-base")}>
        {pending ? "Opening secure checkout…" : signedIn ? `Pay $${PRO_PRICE} with crypto` : `Sign in & pay $${PRO_PRICE}`}
      </button>
      <p className="text-center text-xs text-muted-foreground">Pro unlocks automatically once the payment is confirmed, usually within minutes.</p>
    </form>
  );
}
