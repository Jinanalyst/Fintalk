import type { Metadata } from "next";
import Link from "next/link";
import { RULES, fill } from "@/lib/contest-copy";
import { copyVars, getSeason } from "@/lib/contests/season-data";
import { dateRange } from "@/lib/season";

export const metadata: Metadata = {
  title: "Contest rules",
  description: "Ranking, leverage limit, eligibility, prize payout and fair-play rules of the FinTalk paper trading contest.",
  alternates: { canonical: "/contest/rules" },
};

/** Season dates and limits come from the database; refresh hourly. */
export const revalidate = 3600;

export default async function RulesPage() {
  const season = await getSeason();
  const v = copyVars(season);
  return (
    <article className="space-y-6">
      <header>
        <p className="text-xs font-bold uppercase tracking-wider text-brand">{season.label} · {dateRange(season)} (UTC)</p>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">Contest rules</h1>
        <nav aria-label="Sections" className="mt-3 flex flex-wrap gap-2">
          {RULES.map((r) => (
            <a key={r.id} href={`#${r.id}`} className="rounded-full border px-3 py-1 text-xs font-medium text-muted-foreground hover:border-brand hover:text-brand">{r.title}</a>
          ))}
        </nav>
      </header>
      {RULES.map((r) => (
        <section key={r.id} id={r.id} className="scroll-mt-20 rounded-2xl border bg-card p-5 shadow-xs">
          <h2 className="text-lg font-bold">{r.title}</h2>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-muted-foreground">
            {r.body.map((b) => <li key={b}>{fill(b, v)}</li>)}
          </ul>
        </section>
      ))}
      <p className="text-sm text-muted-foreground">
        Questions? See the <Link href="/contest/faq" className="font-semibold text-brand hover:underline">FAQ</Link>. Paper trading only · not investment advice.
      </p>
    </article>
  );
}
