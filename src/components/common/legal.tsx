import type { ReactNode } from "react";

export const OPERATOR = {
  service: "핀톡",
  name: "체인랩스",
  ceo: "장진우",
  regNo: "382-25-02223",
  address: "경기도 성남시 중원구 여수울로 50, 406동 403호 (여수동, 연꽃마을)",
  email: "jangj6091@gmail.com",
  effective: "2026년 11월 5일",
};

export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <article className="rounded-2xl border bg-card p-5 shadow-xs sm:p-8">
      <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
      <p className="mt-1 text-xs text-muted-foreground">시행일: {OPERATOR.effective}</p>
      <div className="mt-6 space-y-6 text-sm leading-relaxed">{children}</div>
    </article>
  );
}

export function Clause({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 text-base font-bold">{title}</h2>
      <div className="space-y-2 text-muted-foreground [&_li]:ml-4 [&_li]:list-disc">{children}</div>
    </section>
  );
}
