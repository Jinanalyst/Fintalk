export const X_URL = "https://x.com/chainlabstory";
export const X_HANDLE = "@chainlabstory";
export const REFUND_DAYS = 3;
export const PRO_PRICE = 40;
export const CONTACT_EMAIL = "jangj6091@gmail.com";

/** Where "Get Lifetime Pro" goes. Set NEXT_PUBLIC_PLANNER_CHECKOUT_URL to your payment link once one exists. */
export const CHECKOUT_URL =
  process.env.NEXT_PUBLIC_PLANNER_CHECKOUT_URL ??
  `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent("Chainlabs Planner — Lifetime Pro")}`;

export const FREE_FEATURES = [
  "Trade planner and position calculator",
  "CSV import from 1 exchange",
  "Journal with 30-second notes",
  "P&L calendar",
  "Basic stats and a weekly summary",
  "Export all your data anytime",
];

export const PRO_FEATURES = [
  "Everything in Free",
  "Unlimited exchange and broker imports",
  "Win rate by hour, weekday and symbol",
  "P&L by mistake tag and the emotion report",
  "Full style report and behavior flags",
  "Plan vs reality analysis",
  "Full weekly report and unlimited history",
  "All future updates",
];
