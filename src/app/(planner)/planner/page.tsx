import type { Metadata } from "next";
import Link from "next/link";
import { Check, Download, Lock, ShieldCheck, Undo2 } from "lucide-react";
import { CHECKOUT_URL, FREE_FEATURES, PRO_FEATURES, PRO_PRICE, REFUND_DAYS, X_HANDLE, X_URL } from "@/lib/planner/config";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Trading Planner — find the real reason you lose money",
  description: `Plan every trade, journal it in 30 seconds and see exactly which mistakes cost you. Free to start. Lifetime Pro is $${PRO_PRICE} once, with a ${REFUND_DAYS}-day money-back guarantee.`,
  alternates: { canonical: "/planner" },
};

const REPORT = [
  { name: "Moved my stop", n: "6 trades", pnl: "−$412", bad: true },
  { name: "FOMO entry", n: "4 trades", pnl: "−$305", bad: true },
  { name: "Entered late", n: "3 trades", pnl: "−$188", bad: true },
  { name: "Followed the plan", n: "19 trades", pnl: "+$1,940", bad: false },
];
const HOURS = [["09:00–12:00", 64], ["12:00–17:00", 55], ["17:00–22:00", 52], ["After 22:00", 31]] as const;
const VENUES = ["OKX", "Binance", "Bybit", "Bitget", "Coinbase", "Interactive Brokers", "Alpaca"];
const FAQ = [
  { q: "How does the money-back guarantee work?", a: `Pay $${PRO_PRICE} for Lifetime Pro and try everything. If it isn’t for you, email us within ${REFUND_DAYS} days of purchase and we refund the full amount. No forms, no questions.` },
  { q: "Does it work with my exchange?", a: "Export your closed trades from OKX, Binance, Bybit or any broker as a CSV and import it in seconds. Column names are matched automatically. Direct API sync is on the roadmap." },
  { q: "Is it risky to use?", a: "No keys, no logins to your exchange, and no way to place orders. Files are read in your browser and stored on your device." },
  { q: "Can beginners use it?", a: "Yes. Fill in entry, stop and target and the calculator sizes the position for you. The reports explain results in plain language." },
  { q: `Is $${PRO_PRICE} really one time?`, a: "Yes. One payment, no renewals. Every feature we add to Pro later is included." },
  { q: "What happens to my data if I stop using it?", a: "You can export everything as CSV at any time, before or after you leave." },
  { q: "How is Pro different from Free?", a: "Free covers planning, the journal, the calendar and basic stats for one exchange. Pro adds unlimited exchange imports, the hour, mistake-tag and emotion breakdowns, the full style report, plan vs reality, the full weekly report and unlimited history." },
  { q: "Is this financial advice?", a: "No. Chainlabs Planner analyzes your own trading history. It does not tell you what to buy or sell." },
];
const SECURITY = [
  { title: "No exchange access", text: "We never ask for API keys, trading or withdrawal permission.", icon: ShieldCheck },
  { title: "Private by default", text: "Your trades live on your device and are visible only to you.", icon: Lock },
  { title: "Your data, always", text: "Export everything as CSV at any time. If you leave, your records go with you.", icon: Download },
];

const cta = "inline-flex min-h-12 items-center justify-center rounded-xl bg-brand px-6 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90";
const eyebrow = "text-sm font-semibold text-amber-600 dark:text-amber-300";
const card = "rounded-2xl border bg-card";

function Tick({ className }: { className?: string }) {
  return <Check className={cn("mt-1 size-[18px] shrink-0", className)} strokeWidth={2.5} aria-hidden />;
}

export default function PlannerLanding() {
  return (
    <div className="space-y-16 sm:space-y-24">
      {/* Hero */}
      <section className="grid items-center gap-10 pt-4 lg:grid-cols-2 lg:gap-14 lg:pt-10">
        <div className="space-y-6">
          <span className="inline-flex rounded-full bg-brand-soft px-3 py-1.5 text-xs font-semibold text-brand">Trading journal · Crypto &amp; stocks</span>
          <h1 className="text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl">Your journal fills itself. You just fix the mistakes.</h1>
          <p className="max-w-xl text-lg text-muted-foreground">Import your trades and Chainlabs Planner finds the real reason you lose money — then helps you plan the next one properly.</p>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
            <Link href="/planner/app" className={cn(cta, "h-13")}>Start free</Link>
            <a href="#pricing" className="text-sm font-semibold hover:text-brand">See pricing →</a>
          </div>
          <ul className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-muted-foreground">
            <li className="flex items-center gap-1.5"><Check className="size-4 text-up" aria-hidden /> No card required</li>
            <li className="flex items-center gap-1.5"><Check className="size-4 text-up" aria-hidden /> {REFUND_DAYS}-day money-back guarantee</li>
            <li className="flex items-center gap-1.5"><Check className="size-4 text-up" aria-hidden /> Pay once, keep it forever</li>
          </ul>
        </div>

        <div className={cn(card, "space-y-4 p-6 shadow-xs")} aria-label="Example report">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Why you lost money this month</span>
            <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">Example</span>
          </div>
          {REPORT.map((t) => (
            <div key={t.name} className="flex items-center justify-between gap-3 rounded-xl bg-surface px-4 py-3">
              <div><p className="font-semibold">{t.name}</p><p className="text-xs text-muted-foreground">{t.n}</p></div>
              <span className={cn("font-mono font-semibold", t.bad ? "text-down" : "text-up")}>{t.pnl}</span>
            </div>
          ))}
          <p className="text-xs text-muted-foreground">Sample numbers for illustration.</p>
        </div>
      </section>

      {/* Venues */}
      <section className="-mx-3 border-y bg-card px-3 py-6 sm:mx-0 sm:rounded-2xl sm:border">
        <div className="flex flex-wrap items-center justify-center gap-x-7 gap-y-2 text-sm">
          <span className="text-muted-foreground">Imports from</span>
          {VENUES.map((v) => <span key={v} className="text-base font-semibold">{v}</span>)}
          <span className="text-muted-foreground">+ any broker via CSV</span>
        </div>
      </section>

      {/* Spreadsheet objection */}
      <section className="grid items-center gap-10 lg:grid-cols-2">
        <div className="space-y-5">
          <p className={eyebrow}>“Can’t I just use a spreadsheet?”</p>
          <h2 className="text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">A spreadsheet keeps records. Chainlabs Planner gives answers.</h2>
          <ul className="space-y-3">
            {["Win rate by hour, weekday and symbol, calculated for you", "P&L for each mistake tag, like “moved my stop”", "A report on how your emotions line up with your returns"].map((i) => (
              <li key={i} className="flex gap-3 text-muted-foreground"><Tick className="text-up" />{i}</li>
            ))}
          </ul>
          <p className="font-semibold">No formulas to build. Import and see it right away.</p>
        </div>
        <div className={cn(card, "space-y-3.5 p-6")} aria-label="Example breakdown">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Win rate by entry time · Example</span>
          {HOURS.map(([slot, wr]) => (
            <div key={slot} className="space-y-1">
              <div className="flex justify-between text-sm"><span>{slot}</span><span className={cn("font-mono font-semibold", wr < 40 && "text-down")}>{wr}%</span></div>
              <div className="h-2 overflow-hidden rounded-full bg-border"><div className={cn("h-full rounded-full", wr < 40 ? "bg-down" : "bg-brand")} style={{ width: `${wr}%` }} /></div>
            </div>
          ))}
        </div>
      </section>

      {/* Habit objection */}
      <section className={cn(card, "grid items-center gap-8 p-6 sm:p-10 lg:grid-cols-[1fr_1.3fr]")}>
        <div className="space-y-4">
          <p className={eyebrow}>“I’ll stop using it after a week.”</p>
          <h2 className="text-3xl font-extrabold leading-tight tracking-tight">A journal that doesn’t need discipline</h2>
        </div>
        <ol className="space-y-3">
          {[
            ["1", "Trades import themselves", "Drop in a CSV from your exchange. Done in seconds."],
            ["2", "A note takes 30 seconds", "Tag the setup and how you felt. That’s it."],
            ["3", "The report builds as you go", "Insights keep piling up with every closed trade."],
          ].map(([n, t, d]) => (
            <li key={n} className="flex items-start gap-4 rounded-xl bg-surface p-4">
              <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-brand-soft font-mono font-bold text-brand">{n}</span>
              <div><p className="font-semibold">{t}</p><p className="text-sm text-muted-foreground">{d}</p></div>
            </li>
          ))}
        </ol>
      </section>

      {/* Proof / insights */}
      <section className="space-y-8">
        <div className="space-y-3 text-center">
          <p className={eyebrow}>“Does it actually work?”</p>
          <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Here’s what you’ll find out</h2>
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          {[
            ["31%", "Win rate on trades entered after 10 PM —", "24 points below your average."],
            ["2.1×", "Re-entering within 30 minutes of a loss makes your", "average loss 2.1 times bigger."],
          ].map(([big, a, b]) => (
            <div key={big} className={cn(card, "space-y-3 p-7")}>
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Insight · Example</span>
              <p className="font-mono text-5xl font-semibold leading-none text-down">{big}</p>
              <p className="text-lg">{a} <strong>{b}</strong></p>
            </div>
          ))}
        </div>
        <p className="text-center text-lg font-semibold">Fix one mistake and the ${PRO_PRICE} has already paid for itself.</p>
      </section>

      {/* Security */}
      <section id="security" className="space-y-8 scroll-mt-24">
        <div className="max-w-xl space-y-3">
          <p className={eyebrow}>“Is my account safe?”</p>
          <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">We can’t touch your money.</h2>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          {SECURITY.map((s) => (
            <div key={s.title} className={cn(card, "space-y-2.5 p-6")}>
              <s.icon className="size-7 text-brand" aria-hidden />
              <h3 className="text-lg font-semibold">{s.title}</h3>
              <p className="text-muted-foreground">{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="mx-auto w-full max-w-4xl scroll-mt-24 space-y-10">
        <div className="space-y-3 text-center">
          <p className={eyebrow}>“Is it worth paying for?”</p>
          <h2 className="text-3xl font-extrabold tracking-tight sm:text-5xl">Try it first. Decide later.</h2>
          <p className="text-muted-foreground">Start free. Upgrade once, and if it’s not for you, get every cent back within {REFUND_DAYS} days.</p>
        </div>
        <div className="grid items-stretch gap-6 md:grid-cols-2">
          <div className={cn(card, "flex flex-col gap-5 p-7")}>
            <div>
              <h3 className="text-xl font-semibold">Free</h3>
              <p className="text-5xl font-extrabold leading-tight tracking-tight">$0</p>
              <p className="text-sm text-muted-foreground">Forever. No card required.</p>
            </div>
            <ul className="flex-1 space-y-2.5">{FREE_FEATURES.map((f) => <li key={f} className="flex gap-2.5 text-muted-foreground"><Tick /> {f}</li>)}</ul>
            <Link href="/planner/app" className="inline-flex min-h-12 items-center justify-center rounded-xl border font-semibold hover:bg-muted">Start free</Link>
          </div>

          <div className={cn(card, "relative flex flex-col gap-5 border-2 border-brand p-7")}>
            <div>
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-xl font-semibold">Lifetime Pro</h3>
                <span className="rounded-full bg-brand-soft px-2.5 py-1 text-xs font-bold text-brand">No subscription</span>
              </div>
              <p className="text-5xl font-extrabold leading-tight tracking-tight">${PRO_PRICE} <span className="text-lg font-medium text-muted-foreground">one time</span></p>
              <p className="text-sm text-muted-foreground">Pay once. Every future update included.</p>
            </div>
            <ul className="flex-1 space-y-2.5">{PRO_FEATURES.map((f) => <li key={f} className="flex gap-2.5"><Tick className="text-up" /> {f}</li>)}</ul>
            <a href={CHECKOUT_URL} className={cta}>Get Lifetime Pro — ${PRO_PRICE}</a>
            <p className="flex items-center justify-center gap-1.5 text-center text-sm font-medium">
              <Undo2 className="size-4 text-up" aria-hidden /> {REFUND_DAYS}-day money-back guarantee
            </p>
          </div>
        </div>
        <div className={cn(card, "flex flex-wrap items-center gap-4 p-5")}>
          <ShieldCheck className="size-8 shrink-0 text-up" aria-hidden />
          <p className="min-w-0 flex-1 text-sm text-muted-foreground"><strong className="text-foreground">Zero-risk guarantee.</strong> Try Pro for {REFUND_DAYS} days. If it doesn’t help you spot your mistakes, email us for a full refund. <Link href="/refunds" className="font-medium text-brand hover:underline">Refund policy</Link></p>
        </div>
      </section>

      {/* Trust */}
      <section className={cn(card, "grid items-center gap-8 p-6 sm:p-10 lg:grid-cols-[1fr_1.3fr]")}>
        <div className="space-y-3">
          <p className={eyebrow}>“Can I trust a small product?”</p>
          <h2 className="text-3xl font-extrabold leading-tight tracking-tight">Built in public. Answered by the person who builds it.</h2>
          <p className="text-muted-foreground">Chainlabs · Seongnam, Republic of Korea</p>
        </div>
        <ul className="space-y-3.5">
          <li className="flex gap-3 text-muted-foreground"><Tick className="text-up" /> Public changelog — follow every update on <a href={X_URL} target="_blank" rel="noopener noreferrer" className="font-semibold text-brand hover:underline">X {X_HANDLE}</a></li>
          <li className="flex gap-3 text-muted-foreground"><Tick className="text-up" /> Request a feature and get a reply from the people who build it</li>
          <li className="flex gap-3 text-muted-foreground"><Tick className="text-up" /> A {REFUND_DAYS}-day money-back guarantee, in writing</li>
        </ul>
      </section>

      {/* FAQ */}
      <section id="faq" className="mx-auto w-full max-w-3xl scroll-mt-24 space-y-6">
        <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Questions</h2>
        <div className="space-y-3">
          {FAQ.map((f) => (
            <details key={f.q} className={cn(card, "group px-6 py-5")}>
              <summary className="min-h-7 cursor-pointer text-base font-semibold">{f.q}</summary>
              <p className="mt-3 text-muted-foreground">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="rounded-3xl bg-brand-soft px-6 py-14 text-center sm:px-10">
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-5">
          <h2 className="text-3xl font-extrabold leading-tight tracking-tight sm:text-5xl">Stop repeating the same mistake this month.</h2>
          <Link href="/planner/app" className={cn(cta, "h-14 px-8 text-base")}>Analyze my trades for free</Link>
          <p className="text-sm text-muted-foreground">No card required · {REFUND_DAYS}-day money-back guarantee on Pro</p>
          <a href={X_URL} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-brand hover:underline">Follow {X_HANDLE} on X</a>
        </div>
      </section>

      <p className="pb-4 text-center text-xs text-muted-foreground">Chainlabs Planner is an analysis tool, not financial advice. Trading involves risk of loss. Past results do not guarantee future performance.</p>
    </div>
  );
}
