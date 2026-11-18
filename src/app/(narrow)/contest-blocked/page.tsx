import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Not available in your region", robots: { index: false } };

export default function ContestBlockedPage() {
  return (
    <div className="mx-auto max-w-md rounded-xl border bg-card p-10 text-center">
      <h1 className="text-lg font-bold">Contest not available in your region</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Residents of your country or region are not eligible for this contest. You can still use the rest of FinTalk.
      </p>
      <Link href="/" className="mt-4 inline-block rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-primary-foreground">Back to home</Link>
    </div>
  );
}
