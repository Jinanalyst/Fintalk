"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bold, Heading2, ImagePlus, List, ListOrdered, Minus, Quote, X } from "lucide-react";
import { RichBody, readingMinutes } from "@/components/feed/rich-body";
import { BOARD_CATEGORIES, POST_TYPES, type PostType } from "@/lib/sample-data";
import { useToast } from "@/components/common/toast";
import { createClient } from "@/lib/supabase/client";
import { createPostAction, updatePostAction } from "@/app/actions/community";
import { useGuard } from "@/components/feed/interactive";

type Initial = { id: string; category: string; type: PostType; sponsored: boolean; draft: boolean; title: string; body: string; tickers: string[]; images: string[] };

const AUTOSAVE_KEY = "fintalk:write-draft";

type Fmt = "h2" | "bold" | "ul" | "ol" | "quote" | "hr";
const TOOLS: { k: Fmt; label: string; Icon: typeof Bold }[] = [
  { k: "h2", label: "소제목", Icon: Heading2 },
  { k: "bold", label: "굵게", Icon: Bold },
  { k: "ul", label: "목록", Icon: List },
  { k: "ol", label: "번호 목록", Icon: ListOrdered },
  { k: "quote", label: "인용", Icon: Quote },
  { k: "hr", label: "구분선", Icon: Minus },
];

const MAX_BYTES = 5 * 1024 * 1024;
const TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

export function WriteForm({ live, initial, prefillTickers, prefillType }: { live: boolean; initial?: Initial; prefillTickers?: string[]; prefillType?: PostType }) {
  const { comingSoon, show } = useToast();
  const guard = useGuard();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const [saved, setSaved] = useState<{ title: string; body: string } | null>(null);

  const [category, setCategory] = useState(initial?.category ?? "kr-stock");
  const [type, setType] = useState<PostType>(initial?.type ?? prefillType ?? "general");
  const [sponsored, setSponsored] = useState(initial?.sponsored ?? false);
  const [preview, setPreview] = useState(false);
  const [title, setTitle] = useState(initial?.title ?? "");
  const [body, setBody] = useState(initial?.body ?? "");
  const [tags, setTags] = useState<string[]>(initial?.tickers ?? prefillTickers ?? []);
  const [tagInput, setTagInput] = useState("");
  const [existing, setExisting] = useState<string[]>(initial?.images ?? []);
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);

  const addTag = () => {
    const t = tagInput.trim().replace(/^\$/, "").toUpperCase();
    if (/^[0-9A-Z._-]{1,20}$/.test(t) && !tags.includes(t) && tags.length < 5) setTags([...tags, t]);
    setTagInput("");
  };

  const pickFiles = (list: FileList | null) => {
    const picked = Array.from(list ?? []);
    const ok = picked.filter((f) => {
      if (!TYPES.includes(f.type)) return show(`${f.name}: PNG/JPG/WEBP/GIF 만 첨부할 수 있습니다.`), false;
      if (f.size > MAX_BYTES) return show(`${f.name}: 5MB 이하만 첨부할 수 있습니다.`), false;
      return true;
    });
    setFiles([...files, ...ok].slice(0, 5 - existing.length));
    if (fileRef.current) fileRef.current.value = "";
  };

  // 새 글 작성 중 브라우저에 자동 보관 (수정 화면에서는 사용하지 않음). 저장소를 못 쓰는 환경에서도 동작에는 문제 없습니다.
  useEffect(() => {
    if (initial) return;
    try {
      const raw = localStorage.getItem(AUTOSAVE_KEY);
      const v = raw ? JSON.parse(raw) : null;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (v && typeof v.body === "string" && v.body.trim().length > 1) setSaved({ title: String(v.title ?? ""), body: v.body });
    } catch {}
  }, [initial]);

  useEffect(() => {
    if (initial || (!title && !body)) return;
    const t = setTimeout(() => {
      try { localStorage.setItem(AUTOSAVE_KEY, JSON.stringify({ title, body })); } catch {}
    }, 800);
    return () => clearTimeout(t);
  }, [initial, title, body]);

  const clearAutosave = () => { try { localStorage.removeItem(AUTOSAVE_KEY); } catch {} };

  const format = (k: Fmt) => {
    const el = bodyRef.current;
    if (!el) return;
    const a = el.selectionStart;
    const b = el.selectionEnd;
    const sel = body.slice(a, b);
    const lineStart = body.lastIndexOf("\n", a - 1) + 1;
    let next = body;
    let caret = b;
    if (k === "bold") {
      const t = sel || "굵은 글씨";
      next = body.slice(0, a) + "**" + t + "**" + body.slice(b);
      caret = a + t.length + 4;
    } else if (k === "hr") {
      next = body.slice(0, b) + "\n\n---\n\n" + body.slice(b);
      caret = b + 7;
    } else {
      const prefix = k === "h2" ? "## " : k === "ul" ? "- " : k === "ol" ? "1. " : "> ";
      const nl = body.indexOf("\n", a);
      const rangeEnd = b > a ? b : nl === -1 ? body.length : nl;
      const target = body.slice(lineStart, rangeEnd);
      const out = (target || "내용").split("\n").map((l) => prefix + l).join("\n");
      next = body.slice(0, lineStart) + out + body.slice(rangeEnd);
      caret = lineStart + out.length;
    }
    setBody(next);
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(caret, caret); });
  };

  const insightType = POST_TYPES.find((t) => t.slug === type)?.insight ?? false;

  async function submit(e: React.FormEvent, asDraft = false) {
    e.preventDefault();
    if (!live) return comingSoon("게시글 등록 (Supabase 환경변수 필요)");
    setBusy(true);
    try {
      const sb = createClient();
      const { data: auth } = await sb.auth.getUser();
      if (!auth.user) {
        guard({ ok: false, error: "login" });
        return;
      }
      const uploaded: string[] = [];
      for (const f of files) {
        const ext = f.type === "image/jpeg" ? "jpg" : f.type.split("/")[1];
        const path = `${auth.user.id}/${crypto.randomUUID()}.${ext}`;
        const { error } = await sb.storage.from("post-images").upload(path, f, { contentType: f.type });
        if (error) return show("이미지를 업로드하지 못했습니다.");
        uploaded.push(sb.storage.from("post-images").getPublicUrl(path).data.publicUrl);
      }
      const payload = { category, type, title, body, tickers: tags, images: [...existing, ...uploaded], sponsored, draft: asDraft };
      const r = initial ? await updatePostAction(initial.id, payload) : await createPostAction(payload);
      if (guard(r) && r.ok) {
        clearAutosave();
        show(asDraft ? "임시 저장했습니다." : initial ? "수정했습니다." : "게시글을 등록했습니다.");
        router.push(asDraft ? "/me?tab=drafts" : `/community/${"id" in r ? r.id : initial?.id}`);
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  const field = "w-full rounded-lg border bg-card px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";

  return (
    <form className="space-y-4 rounded-xl border bg-card p-4 sm:p-5" onSubmit={(e) => submit(e)}>
      <div>
        <p className="mb-1 text-sm font-medium">게시글 유형</p>
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="게시글 유형">
          {POST_TYPES.map((t) => (
            <button
              key={t.slug}
              type="button"
              role="radio"
              aria-checked={type === t.slug}
              onClick={() => setType(t.slug)}
              className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${type === t.slug ? "border-brand bg-brand-soft text-brand" : "text-muted-foreground hover:bg-muted"}`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-xs text-muted-foreground">{POST_TYPES.find((t) => t.slug === type)?.hint}</p>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium" htmlFor="cat">카테고리</label>
        <select id="cat" className={field} value={category} onChange={(e) => setCategory(e.target.value)}>
          {BOARD_CATEGORIES.filter((c) => c.slug !== "all").map((c) => (
            <option key={c.slug} value={c.slug}>{c.label}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium" htmlFor="title">제목</label>
        <input id="title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} required minLength={2} placeholder="제목을 입력하세요" className={field} />
        <p className="mt-1 text-right text-xs text-muted-foreground">{title.length}/100</p>
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between">
          <label className="text-sm font-medium" htmlFor="body">본문</label>
          <button type="button" onClick={() => setPreview(!preview)} className="text-xs font-medium text-brand hover:underline">{preview ? "편집" : "미리보기"}</button>
        </div>
        {saved && !initial && !body && (
          <div className="mb-2 flex items-center justify-between gap-2 rounded-lg bg-brand-soft p-2.5 text-xs text-brand">
            <span>이 브라우저에 작성 중이던 글이 있습니다.</span>
            <span className="flex gap-2">
              <button type="button" className="font-semibold underline" onClick={() => { setTitle(saved.title); setBody(saved.body); setSaved(null); }}>불러오기</button>
              <button type="button" className="underline" onClick={() => { clearAutosave(); setSaved(null); }}>삭제</button>
            </span>
          </div>
        )}
        {preview ? (
          <article className="min-h-40 rounded-lg border bg-background p-4">
            <h2 className="mb-3 text-lg font-bold">{title || "제목 없음"}</h2>
            <RichBody text={body.trim() ? body : "본문이 비어 있습니다."} />
          </article>
        ) : (
          <>
            <div className="flex flex-wrap gap-1 rounded-t-lg border border-b-0 bg-muted/50 p-1" role="toolbar" aria-label="서식">
              {TOOLS.map(({ k, label, Icon }) => (
                <button key={k} type="button" title={label} aria-label={label} onClick={() => format(k)} className="rounded-md p-1.5 text-muted-foreground hover:bg-background hover:text-foreground">
                  <Icon className="size-4" />
                </button>
              ))}
            </div>
            <textarea ref={bodyRef} id="body" value={body} onChange={(e) => setBody(e.target.value)} rows={insightType ? 24 : 10} required minLength={2} maxLength={20000} placeholder={insightType ? "근거(데이터·차트·출처)와 함께 분석 과정을 구조적으로 작성해 보세요. 소제목(##), 목록(-), 인용(>)을 사용할 수 있습니다." : "시장에 대한 생각을 자유롭게 작성해 주세요. 특정 종목의 매수·매도를 강요하거나 허위 정보를 퍼뜨리는 글은 제재될 수 있습니다."} className={field + " rounded-t-none"} />
          </>
        )}
        <p className="mt-1 flex justify-between text-xs text-muted-foreground">
          <span>{insightType ? "소제목 ## · 목록 - · 인용 > · 굵게 ** ** 을 지원합니다." : "문단은 빈 줄로 구분합니다."}</span>
          <span>{body.replace(/\s/g, "").length.toLocaleString("ko-KR")}자 · 약 {readingMinutes(body)}분</span>
        </p>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium" htmlFor="tag">종목 태그 (최대 5개)</label>
        <div className="flex gap-2">
          <input
            id="tag" value={tagInput} onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
            placeholder="예: BTC, 005930, NVDA" className={field}
          />
          <button type="button" onClick={addTag} className="shrink-0 rounded-lg border px-3 text-sm font-medium hover:bg-muted">추가</button>
        </div>
        {tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {tags.map((t) => (
              <span key={t} className="inline-flex items-center gap-1 rounded-md bg-brand-soft px-2 py-1 text-xs font-medium text-brand">
                ${t}
                <button type="button" aria-label={`${t} 태그 삭제`} onClick={() => setTags(tags.filter((x) => x !== t))}><X className="size-3" /></button>
              </span>
            ))}
          </div>
        )}
      </div>

      <div>
        <p className="mb-1 text-sm font-medium">이미지 / 차트 이미지 (최대 5장, 장당 5MB)</p>
        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-2 text-sm hover:bg-muted">
          <ImagePlus className="size-4" /> 이미지 선택
          <input ref={fileRef} type="file" accept={TYPES.join(",")} multiple className="sr-only" onChange={(e) => pickFiles(e.target.files)} />
        </label>
        {(existing.length > 0 || files.length > 0) && (
          <ul className="mt-2 flex flex-wrap gap-2">
            {existing.map((u) => (
              <li key={u} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={u} alt="첨부 이미지" className="size-20 rounded-lg border object-cover" />
                <button type="button" aria-label="이미지 제거" onClick={() => setExisting(existing.filter((x) => x !== u))} className="absolute -right-1.5 -top-1.5 rounded-full bg-foreground p-0.5 text-background"><X className="size-3" /></button>
              </li>
            ))}
            {files.map((f, i) => (
              <li key={f.name + i} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={URL.createObjectURL(f)} alt={f.name} className="size-20 rounded-lg border object-cover" />
                <button type="button" aria-label="이미지 제거" onClick={() => setFiles(files.filter((_, j) => j !== i))} className="absolute -right-1.5 -top-1.5 rounded-full bg-foreground p-0.5 text-background"><X className="size-3" /></button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <label className="flex items-start gap-2 rounded-lg bg-muted/60 p-3 text-sm">
        <input type="checkbox" checked={sponsored} onChange={(e) => setSponsored(e.target.checked)} className="mt-0.5" />
        <span>
          <b className="font-medium">협찬·이해관계 표시</b>
          <span className="block text-xs text-muted-foreground">광고·협찬을 받았거나 언급한 종목을 보유하는 등 이해관계가 있다면 표시해 주세요. 수익 보장·유료 리딩방 홍보는 금지됩니다.</span>
        </span>
      </label>

      <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
        <button type="button" onClick={() => router.back()} className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted">취소</button>
        <button type="button" disabled={busy || title.trim().length < 2 || body.trim().length < 2} onClick={(e) => submit(e, true)} className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50">임시 저장</button>
        <button type="submit" disabled={busy} className="rounded-lg bg-brand px-5 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50">
          {busy ? "저장 중…" : initial && !initial.draft ? "수정 완료" : "등록"}
        </button>
      </div>
    </form>
  );
}
