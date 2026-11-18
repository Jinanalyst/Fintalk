import Link from "next/link";

export function NotFoundCard() {
  return (
    <div className="rounded-xl border bg-card p-12 text-center">
      <p className="text-4xl font-extrabold text-brand">404</p>
      <h1 className="mt-2 text-lg font-bold">Page not found</h1>
      <p className="mt-1 text-sm text-muted-foreground">The address may be wrong, or the content may have been removed.</p>
      <Link href="/" className="mt-4 inline-block rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-primary-foreground">Back to home</Link>
    </div>
  );
}
