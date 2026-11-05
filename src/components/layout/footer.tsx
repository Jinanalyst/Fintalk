import Link from "next/link";
import { Logo } from "./header";

const BUSINESS = {
  name: "체인랩스",
  ceo: "장진우",
  regNo: "382-25-02223",
  address: "경기도 성남시 중원구 여수울로 50, 406동 403호 (여수동, 연꽃마을)",
  email: "jangj6091@gmail.com",
};

const LINKS = [
  { href: "/", label: "홈" },
  { href: "/community", label: "커뮤니티" },
  { href: "/insights", label: "인사이트" },
  { href: "/creators", label: "크리에이터" },
  { href: "/rewards", label: "리워드" },
];

/** 사이트 공통 푸터: 서비스 소개, 사업자 정보, 투자 유의 안내 */
export function Footer() {
  return (
    <footer className="mb-16 border-t bg-card lg:mb-0" aria-label="사이트 정보">
      <div className="mx-auto w-full max-w-[1320px] px-3 py-8 sm:px-4">
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <Logo />
            <p className="text-sm text-muted-foreground">투자의 생각을 나누고, 함께 성장하다.</p>
          </div>
          <a href={`mailto:${BUSINESS.email}`} className="text-sm font-medium text-muted-foreground hover:text-brand">
            문의 {BUSINESS.email}
          </a>
        </div>

        <nav aria-label="바로가기" className="mt-5 flex flex-wrap gap-x-5 gap-y-2 border-t pt-5 text-sm font-medium text-muted-foreground">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="hover:text-brand">{l.label}</Link>
          ))}
          <span className="hidden h-4 w-px self-center bg-border sm:block" aria-hidden="true" />
          <Link href="/terms" className="hover:text-brand">이용약관</Link>
          <Link href="/privacy" className="font-semibold text-foreground hover:text-brand">개인정보처리방침</Link>
        </nav>

        <dl className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
          <div className="flex gap-1.5"><dt>상호</dt><dd>{BUSINESS.name}</dd></div>
          <div className="flex gap-1.5"><dt>대표</dt><dd>{BUSINESS.ceo}</dd></div>
          <div className="flex gap-1.5"><dt>사업자등록번호</dt><dd>{BUSINESS.regNo}</dd></div>
          <div className="flex gap-1.5"><dt>주소</dt><dd>{BUSINESS.address}</dd></div>
          <div className="flex gap-1.5"><dt>이메일</dt><dd><a href={`mailto:${BUSINESS.email}`} className="hover:text-brand">{BUSINESS.email}</a></dd></div>
        </dl>

        <p className="mt-3 max-w-3xl text-[11px] leading-relaxed text-muted-foreground">
          핀톡의 게시글은 이용자의 개인 의견이며 투자 권유가 아닙니다. 투자 판단과 그에 따른 책임은 본인에게 있습니다.
        </p>
        <p className="mt-2 text-xs text-muted-foreground">© {new Date().getFullYear()} 핀톡 · {BUSINESS.name}. All rights reserved.</p>
      </div>
    </footer>
  );
}
