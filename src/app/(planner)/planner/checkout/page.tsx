import type { Metadata } from "next";
import Link from "next/link";
import { Check, Undo2 } from "lucide-react";
import { PRO_FEATURES, PRO_PRICE, REFUND_DAYS } from "@/lib/planner/config";

export const metadata: Metadata = {
  title: "Get Lifetime Pro",
  description: `Chainlabs Planner Lifetime Pro — $${PRO_PRICE} once, with a ${REFUND_DAYS}-day money-back guarantee.`,
  robots: { index: false, follow: true },
};

export default function CheckoutPage() {
  return (
    <div className="mx-auto grid max-w-4xl items-start gap-8 py-4 md:grid-cols-[1fr_410px]">
      <div className="space-y-5">
        <h1 className="text-3xl font-extrabold tracking-tight">Get Lifetime Pro</h1>
        <p className="text-4xl font-extrabold">${PRO_PRICE} <span className="text-base font-medium text-muted-foreground">one time</span></p>
        <ul className="space-y-2.5">
          {PRO_FEATURES.map((f) => (
            <li key={f} className="flex gap-2.5"><Check className="mt-1 size-[18px] shrink-0 text-up" strokeWidth={2.5} aria-hidden /> {f}</li>
          ))}
        </ul>
        <p className="flex items-center gap-2 text-sm font-medium"><Undo2 className="size-4 text-up" aria-hidden /> {REFUND_DAYS}-day money-back guarantee. <Link href="/refunds" className="text-brand hover:underline">Refund policy</Link></p>
        <p className="text-xs text-muted-foreground">Payment is processed by NOWPayments. Keep your payment receipt, and email us if you need help or a refund.</p>
      </div>

      <div className="overflow-hidden rounded-2xl border bg-card">
        <iframe
          src="https://nowpayments.io/embeds/payment-widget?iid=6224725968"
          title="Pay for Lifetime Pro"
          width="410"
          height="696"
          frameBorder="0"
          scrolling="no"
          className="block max-w-full"
          style={{ overflowY: "hidden" }}
        />
      </div>
    </div>
  );
}
