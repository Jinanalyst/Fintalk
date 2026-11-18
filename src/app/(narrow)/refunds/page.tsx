import type { Metadata } from "next";
import Link from "next/link";
import { Clause, LegalPage, OPERATOR } from "@/components/common/legal";
import { PRO_PRICE, REFUND_DAYS, X_HANDLE, X_URL } from "@/lib/planner/config";

export const metadata: Metadata = {
  title: "Refund Policy",
  description: `FinTalk Planner Lifetime Pro comes with a ${REFUND_DAYS}-day money-back guarantee.`,
  alternates: { canonical: "/refunds" },
};

export default function RefundsPage() {
  return (
    <LegalPage title="Refund Policy">
      <Clause title={`${REFUND_DAYS}-day money-back guarantee`}>
        <p>
          If FinTalk Planner Lifetime Pro (${PRO_PRICE}, one-time) isn’t right for you, request a refund within <strong className="text-foreground">{REFUND_DAYS} days</strong> of your purchase
          and we will refund the full amount. You don’t need to give a reason.
        </p>
      </Clause>
      <Clause title="How to request a refund">
        <ul>
          <li>Email <a className="text-brand underline" href={`mailto:${OPERATOR.email}?subject=Planner%20refund%20request`}>{OPERATOR.email}</a> from the address you used to purchase, or message {" "}
            <a className="text-brand underline" href={X_URL} target="_blank" rel="noopener noreferrer">{X_HANDLE}</a> on X.</li>
          <li>Include your purchase receipt or order number, if you have one.</li>
          <li>We confirm your request and issue the refund to your original payment method. Your bank may take several business days to show it.</li>
        </ul>
      </Clause>
      <Clause title="What happens after a refund">
        <ul>
          <li>Pro features are switched off. Your Free plan and all your data stay available.</li>
          <li>You can export everything as CSV from the Journal at any time.</li>
        </ul>
      </Clause>
      <Clause title="Other notes">
        <ul>
          <li>The Free plan costs nothing, so there is nothing to refund.</li>
          <li>Requests made after {REFUND_DAYS} days are reviewed case by case.</li>
          <li>This policy does not limit any rights you have under the consumer protection laws that apply to you.</li>
        </ul>
        <p><Link href="/planner#pricing" className="text-brand underline">Back to Planner pricing</Link></p>
      </Clause>
    </LegalPage>
  );
}
