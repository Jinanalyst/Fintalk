import type { Metadata } from "next";
import Link from "next/link";
import { FAQ, fill } from "@/lib/contest-copy";
import { copyVars, getSeason } from "@/lib/contests/season-data";

export const metadata: Metadata = {
  title: "Contest FAQ",
  description: "Is it free? Is real money involved? How is the prize paid? Who can join?",
  alternates: { canonical: "/contest/faq" },
};

export default async function FaqPage() {
  const v = copyVars(await getSeason());
  return (
    <article className="space-y-5">
      <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Frequently asked questions</h1>
      <div className="divide-y rounded-2xl border bg-card shadow-xs">
        {FAQ.map((f, i) => (
          <details key={f.q} className="group px-5 py-4" open={i === 0}>
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-semibold [&::-webkit-details-marker]:hidden">
              {f.q}
              <span className="text-lg text-muted-foreground transition-transform group-open:rotate-45" aria-hidden>+</span>
            </summary>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{fill(f.a, v)}</p>
          </details>
        ))}
      </div>
      <p className="text-sm text-muted-foreground">
        Full details in the <Link href="/contest/rules" className="font-semibold text-brand hover:underline">contest rules</Link>.
      </p>
    </article>
  );
}
