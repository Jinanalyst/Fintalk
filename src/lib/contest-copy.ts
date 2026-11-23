/**
 * Rules and FAQ text for the contest pages (/contest/rules, /contest/faq and the cards on "/").
 *
 * PLACEHOLDER COPY — replace every "[TBD …]" with the final wording before launch.
 * Values in {braces} are filled in from the season settings (src/lib/season.ts / the contests table).
 */

export type CopyVars = { maxLeverage: number; startingBalance: string; prize: string; dates: string; payout: string; bonus: number };

export const fill = (text: string, v: CopyVars) =>
  text
    .replaceAll("{maxLeverage}", String(v.maxLeverage))
    .replaceAll("{startingBalance}", v.startingBalance)
    .replaceAll("{prize}", v.prize)
    .replaceAll("{dates}", v.dates)
    .replaceAll("{payout}", v.payout)
    .replaceAll("{bonus}", String(v.bonus));

export const RULES: { id: string; title: string; body: string[] }[] = [
  {
    id: "ranking",
    title: "How ranking works",
    body: [
      "Everyone starts with {startingBalance} of virtual USDT in a dedicated contest account (+{bonus}% with a referral).",
      "Rank = return on your starting balance, including open positions at market price. Max drawdown is shown next to it.",
      "[TBD: tie-breakers, minimum number of trades, how often the board refreshes]",
    ],
  },
  {
    id: "leverage",
    title: "Leverage limit",
    body: ["Contest accounts are capped at {maxLeverage}x leverage. Practice accounts are not limited this way and never count toward the ranking.", "[TBD: anything else about allowed symbols or order types]"],
  },
  {
    id: "countries",
    title: "Who can take part",
    body: ["[TBD: eligible countries / regions and age requirement]", "[TBD: one account per person]"],
  },
  {
    id: "prize",
    title: "Prize and payout",
    body: [
      "1st place wins {prize}. Results are final at the end of the contest ({dates}, UTC).",
      "The prize is paid in USDT on the Tron network (TRC-20) on {payout}, to a TRC-20 wallet address the winner provides. Payments sent to an address on another network cannot be recovered. [TBD: deadline to send the address]",
    ],
  },
  {
    id: "fair-play",
    title: "Fair play",
    body: ["[TBD: multiple accounts, self-referrals, exploiting price feed delays, collusion]", "[TBD: what happens on a violation — disqualification, prize withheld, appeals]"],
  },
];

export const FAQ: { q: string; a: string }[] = [
  { q: "Is it free?", a: "Yes. Joining and trading are free. [TBD: final wording]" },
  { q: "Is real money involved?", a: "No. You trade with virtual funds only — no deposits, no real orders on an exchange. [TBD: final wording]" },
  { q: "How do I get paid?", a: "The winner is contacted after the contest and paid in USDT (TRC-20, Tron network) on {payout}, to a TRC-20 wallet address they provide." },
  { q: "Who can join?", a: "[TBD: eligible countries / regions, age requirement, one account per person]" },
];
