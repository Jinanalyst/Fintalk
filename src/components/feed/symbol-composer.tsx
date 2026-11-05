"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PenSquare } from "lucide-react";
import { createPostAction } from "@/app/actions/community";
import { useToast } from "@/components/common/toast";
import { useGuard } from "./interactive";

const field = "w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";

/** 종목 상세에서 바로 쓰는 분석 글 작성 폼. 종목 태그가 자동으로 붙습니다. */
export function SymbolComposer({ symbol, name, category, live }: { symbol: string; name: string; category: string; live: boolean }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const { show, comingSoon } = useToast();
  const guard = useGuard();
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!live) return comingSoon("게시글 등록 (Supabase 환경변수 필요)");
    setBusy(true);
    try {
      const r = await createPostAction({ category, title, body, tickers: [symbol], images: [] });
      if (guard(r) && r.ok) {
        show("분석 글을 등록했습니다.");
        setTitle("");
        setBody("");
        setOpen(false);
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="flex w-full items-center gap-2 rounded-xl border bg-card px-4 py-3 text-left text-sm text-muted-foreground hover:border-brand/40">
        <PenSquare className="size-4 text-brand" /> {name} 분석 글을 남겨보세요…
      </button>
    );
  }
  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl border bg-card p-4">
      <p className="text-sm font-semibold">{name} 분석 글쓰기 <span className="ml-1 rounded bg-brand-soft px-1.5 py-0.5 text-xs font-medium text-brand">${symbol}</span></p>
      <input value={title} onChange={(e) => setTitle(e.target.value)} required minLength={2} maxLength={100} placeholder="제목" aria-label="제목" className={field} />
      <textarea value={body} onChange={(e) => setBody(e.target.value)} required minLength={2} maxLength={20000} rows={6} placeholder="근거와 함께 분석을 작성해 주세요. 매수·매도 강요나 허위 정보는 제재될 수 있습니다." aria-label="본문" className={field} />
      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => setOpen(false)} className="rounded-lg border px-3 py-1.5 text-sm hover:bg-muted">취소</button>
        <button disabled={busy} className="rounded-lg bg-brand px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-60">{busy ? "등록 중…" : "등록"}</button>
      </div>
    </form>
  );
}
