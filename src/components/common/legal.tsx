import type { ReactNode } from "react";

export const OPERATOR = {
  service: "FinTalk",
  name: "ChainLabs",
  ceo: "Jang Jin-woo",
  regNo: "382-25-02223",
  address: "406-403, 50 Yeosuul-ro, Jungwon-gu, Seongnam-si, Gyeonggi-do, Republic of Korea",
  email: "support@fintalk.space",
  effective: "November 5, 2026",
};

export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <article className="rounded-2xl border bg-card p-5 shadow-xs sm:p-8">
      <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
      <p className="mt-1 text-xs text-muted-foreground">Effective date: {OPERATOR.effective}</p>
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
