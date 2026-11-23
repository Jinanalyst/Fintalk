import Link from "next/link";
import { Logo } from "./header";
import { X_HANDLE, X_URL } from "@/lib/planner/config";

const BUSINESS = {
  name: "ChainLabs",
  ceo: "Jang Jin-woo",
  regNo: "382-25-02223",
  address: "406-403, 50 Yeosuul-ro, Jungwon-gu, Seongnam-si, Gyeonggi-do, Republic of Korea",
  email: "support@fintalk.space",
};

const LINKS = [
  { href: "/", label: "Contest" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/contest/rules", label: "Rules" },
  { href: "/contest/faq", label: "FAQ" },
  { href: "/community", label: "Community" },
];

/** 사이트 공통 푸터: 서비스 소개, 사업자 정보, 투자 유의 안내 */
export function Footer() {
  return (
    <footer className="mb-16 border-t bg-card lg:mb-0" aria-label="Site information">
      <div className="mx-auto w-full max-w-[1320px] px-3 py-8 sm:px-4">
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <Logo />
            <p className="text-sm font-medium text-muted-foreground">Paper trading only · not investment advice</p>
          </div>
          <a href={`mailto:${BUSINESS.email}`} className="text-sm font-medium text-muted-foreground hover:text-brand">
            Contact {BUSINESS.email}
          </a>
        </div>

        <nav aria-label="Quick links" className="mt-5 flex flex-wrap gap-x-5 gap-y-2 border-t pt-5 text-sm font-medium text-muted-foreground">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="hover:text-brand">{l.label}</Link>
          ))}
          <span className="hidden h-4 w-px self-center bg-border sm:block" aria-hidden="true" />
          <a href={X_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 hover:text-brand" aria-label={`FinTalk on X (${X_HANDLE})`}>
            <svg viewBox="0 0 24 24" className="size-3.5" fill="currentColor" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
            {X_HANDLE}
          </a>
          <Link href="/terms" className="hover:text-brand">Terms of Service</Link>
          <Link href="/refunds" className="hover:text-brand">Refunds</Link>
          <Link href="/privacy" className="font-semibold text-foreground hover:text-brand">Privacy Policy</Link>
        </nav>

        <dl className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
          <div className="flex gap-1.5"><dt>Company</dt><dd>{BUSINESS.name}</dd></div>
          <div className="flex gap-1.5"><dt>CEO</dt><dd>{BUSINESS.ceo}</dd></div>
          <div className="flex gap-1.5"><dt>Business Reg. No.</dt><dd>{BUSINESS.regNo}</dd></div>
          <div className="flex gap-1.5"><dt>Address</dt><dd>{BUSINESS.address}</dd></div>
          <div className="flex gap-1.5"><dt>Email</dt><dd><a href={`mailto:${BUSINESS.email}`} className="hover:text-brand">{BUSINESS.email}</a></dd></div>
        </dl>

        <p className="mt-3 max-w-3xl text-[11px] leading-relaxed text-muted-foreground">
          Posts on FinTalk are personal opinions of users and are not investment advice. Paper trading only. You are solely responsible for your own investment decisions.
        </p>
        <p className="mt-2 text-xs text-muted-foreground">© {new Date().getFullYear()} FinTalk · {BUSINESS.name}. All rights reserved.</p>
      </div>
    </footer>
  );
}
