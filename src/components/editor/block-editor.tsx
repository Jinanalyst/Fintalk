"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Film, GripVertical, Heading2, Heading3, ImagePlus, List, ListOrdered, Loader2, Minus, Pilcrow, Plus, Quote, Star, X } from "lucide-react";
import { MAX_MEDIA, MIN_IMG_W, imageLine, mediaOf, videoLine } from "@/lib/media-md";

/**
 * 노션 스타일 블록 에디터.
 * - 본문은 기존과 같은 마크다운 문자열로 저장됩니다 (이미지 `![이미지](url)`, 동영상 `@[video](url)`).
 * - `/` 로 블록 메뉴, `## `·`- `·`1. `·`> `·`---` 마크다운 단축 입력, 붙여넣기·드래그로 사진/동영상 삽입.
 */
type T = "p" | "h2" | "h3" | "ul" | "ol" | "quote" | "hr" | "image" | "video";
type B = { id: string; t: T; text: string; url?: string; preview?: string; up?: boolean; cover?: boolean; w?: number };

export const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
export const VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"];
const IMAGE_MAX = 5 * 1024 * 1024;
const VIDEO_MAX = 50 * 1024 * 1024;

let seq = 0;
const uid = () => `b${++seq}`;
const mk = (t: T, text = ""): B => ({ id: uid(), t, text });
const isMedia = (b: B) => b.t === "image" || b.t === "video";
const isText = (b: B) => !isMedia(b) && b.t !== "hr";

function parseMd(src: string): B[] {
  const out: B[] = [];
  let para: string[] = [];
  const flush = () => {
    if (para.length) out.push(mk("p", para.join("\n")));
    para = [];
  };
  for (const raw of src.replace(/\r\n/g, "\n").split("\n")) {
    const line = raw.trimEnd();
    if (!line.trim()) { flush(); continue; }
    const m = mediaOf(line);
    if (m) { flush(); out.push({ id: uid(), t: m.kind, text: "", url: m.url, cover: m.cover, w: m.width }); continue; }
    if (/^---+$/.test(line.trim())) { flush(); out.push(mk("hr")); continue; }
    let t: T | null = null;
    let text = line;
    if (line.startsWith("### ")) { t = "h3"; text = line.slice(4); }
    else if (line.startsWith("## ")) { t = "h2"; text = line.slice(3); }
    else if (line.startsWith("> ")) { t = "quote"; text = line.slice(2); }
    else if (/^[-*] /.test(line)) { t = "ul"; text = line.slice(2); }
    else if (/^\d+\. /.test(line)) { t = "ol"; text = line.replace(/^\d+\. /, ""); }
    if (t) { flush(); out.push(mk(t, text)); } else para.push(line);
  }
  flush();
  return out;
}

function withTail(bs: B[]): B[] {
  if (!bs.length || !isText(bs[bs.length - 1])) return [...bs, mk("p")];
  return bs;
}

function serialize(bs: B[]) {
  let out = "";
  let prev: T | null = null;
  for (const b of bs) {
    let line: string;
    if (isMedia(b)) {
      if (b.up || !b.url) continue;
      line = b.t === "image" ? imageLine(b.url, b.cover, b.w) : videoLine(b.url);
    } else if (b.t === "hr") line = "---";
    else {
      if (!b.text.trim()) continue;
      line = b.t === "h2" ? `## ${b.text}` : b.t === "h3" ? `### ${b.text}` : b.t === "ul" ? `- ${b.text}` : b.t === "ol" ? `1. ${b.text}` : b.t === "quote" ? `> ${b.text}` : b.text;
    }
    const same = prev === b.t && (b.t === "ul" || b.t === "ol" || b.t === "quote");
    out += out ? (same ? "\n" : "\n\n") + line : line;
    prev = b.t;
  }
  return out;
}

const ITEMS: { k: T; label: string; desc: string; Icon: typeof List; kw: string }[] = [
  { k: "p", label: "텍스트", desc: "일반 문단", Icon: Pilcrow, kw: "text paragraph 텍스트 문단" },
  { k: "h2", label: "큰 제목", desc: "소제목으로 구역 나누기", Icon: Heading2, kw: "h1 h2 heading title 제목 소제목" },
  { k: "h3", label: "작은 제목", desc: "더 작은 제목", Icon: Heading3, kw: "h3 heading 제목" },
  { k: "ul", label: "글머리 목록", desc: "점으로 된 목록", Icon: List, kw: "bullet list 목록 글머리" },
  { k: "ol", label: "번호 목록", desc: "순서가 있는 목록", Icon: ListOrdered, kw: "number list 번호 목록" },
  { k: "quote", label: "인용", desc: "인용구·출처 강조", Icon: Quote, kw: "quote 인용" },
  { k: "hr", label: "구분선", desc: "내용을 시각적으로 구분", Icon: Minus, kw: "divider hr line 구분선" },
  { k: "image", label: "이미지", desc: "사진·차트 이미지 업로드", Icon: ImagePlus, kw: "image photo picture 사진 이미지 차트" },
  { k: "video", label: "동영상", desc: "MP4·WEBM·MOV 업로드", Icon: Film, kw: "video movie 동영상 영상" },
];

const TEXT_CLASS: Record<string, string> = {
  p: "text-[15px] leading-relaxed",
  h2: "pt-3 text-xl font-bold leading-snug",
  h3: "pt-2 text-base font-bold leading-snug",
  ul: "text-[15px] leading-relaxed",
  ol: "text-[15px] leading-relaxed",
  quote: "text-[15px] leading-relaxed text-muted-foreground",
};
const BLOCK_HINT: Record<string, string> = { h2: "큰 제목", h3: "작은 제목", ul: "목록", ol: "목록", quote: "인용구" };

function Area({ value, onValue, onKeyDown, onFocus, onBlur, reg, className, placeholder, maxLength }: {
  value: string; onValue: (v: string) => void; onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onFocus: () => void; onBlur: () => void; reg: (el: HTMLElement | null) => void; className: string; placeholder: string; maxLength: number;
}) {
  const el = useRef<HTMLTextAreaElement | null>(null);
  const fit = () => {
    const t = el.current;
    if (!t) return;
    t.style.height = "auto";
    t.style.height = `${t.scrollHeight}px`;
  };
  useLayoutEffect(fit, [value]);
  useEffect(() => {
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);
  return (
    <textarea
      ref={(n) => { el.current = n; reg(n); }}
      rows={1}
      value={value}
      maxLength={maxLength}
      placeholder={placeholder}
      onChange={(e) => onValue(e.target.value)}
      onKeyDown={onKeyDown}
      onFocus={onFocus}
      onBlur={onBlur}
      className={`block w-full resize-none overflow-hidden bg-transparent outline-none placeholder:text-muted-foreground/50 ${className}`}
    />
  );
}

/** 이미지 좌/우 가장자리를 끌어서 너비(%)를 조절하는 손잡이. 가운데 정렬이라 한쪽을 끌면 양쪽이 같이 변합니다. 더블클릭하면 원래 크기. */
function ResizeHandle({ side, width, onWidth }: { side: "left" | "right"; width: number; onWidth: (w: number, done: boolean) => void }) {
  const st = useRef<{ x: number; w: number; full: number } | null>(null);
  const calc = (e: React.PointerEvent) => {
    const s = st.current!;
    const dx = (e.clientX - s.x) * (side === "right" ? 1 : -1);
    const w = Math.round((s.w + ((dx * 2) / s.full) * 100) / 5) * 5;
    return Math.max(MIN_IMG_W, Math.min(100, w));
  };
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="이미지 크기 조절 (끌어서 조절, 더블클릭하면 원래 크기)"
      title="끌어서 크기 조절 · 더블클릭하면 원래 크기"
      onPointerDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const full = e.currentTarget.closest<HTMLElement>("[data-media-outer]")?.clientWidth || 1;
        st.current = { x: e.clientX, w: width, full };
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => { if (st.current) onWidth(calc(e), false); }}
      onPointerUp={(e) => { if (st.current) { const w = calc(e); st.current = null; onWidth(w, true); } }}
      onPointerCancel={() => { st.current = null; }}
      onDoubleClick={() => onWidth(100, true)}
      className={`absolute top-1/2 z-10 flex h-14 w-4 -translate-y-1/2 cursor-ew-resize touch-none items-center justify-center ${side === "left" ? "left-1" : "right-1"}`}
    >
      <span className="h-10 w-1.5 rounded-full border border-background bg-foreground/80 shadow" />
    </div>
  );
}

type Props = {
  initial: string;
  onChange: (md: string) => void;
  onUpload: (file: File) => Promise<string>;
  onBusy?: (busy: boolean) => void;
  notify: (msg: string) => void;
  placeholder?: string;
};

export function BlockEditor({ initial, onChange, onUpload, onBusy, notify, placeholder }: Props) {
  const [blocks, setBlocks] = useState<B[]>(() => withTail(parseMd(initial)));
  const ref = useRef(blocks);
  const [active, setActive] = useState<string | null>(null);
  const [menuIdx, setMenuIdx] = useState(0);
  const [menuOff, setMenuOff] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<{ id: string; after: boolean } | null>(null);
  const [, setTick] = useState(0);
  const els = useRef(new Map<string, HTMLElement>());
  const pf = useRef<{ id: string; pos: "start" | "end" | number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const afterRef = useRef<string | null>(null);

  const commit = (next: B[]) => {
    const safe = next.length ? next : [mk("p")];
    ref.current = safe;
    setBlocks(safe);
    onChange(serialize(safe));
    onBusy?.(safe.some((b) => b.up));
  };
  const patch = (id: string, p: Partial<B>) => commit(ref.current.map((b) => (b.id === id ? { ...b, ...p } : b)));
  /** 대표 사진은 글당 하나: 지정하면 기존 대표는 해제, 다시 누르면 해제(첫 사진이 자동 썸네일) */
  const toggleCover = (id: string) => commit(ref.current.map((b) => (b.t === "image" ? { ...b, cover: b.id === id ? !b.cover : false } : b)));
  const focus = (id: string, pos: "start" | "end" | number = "end") => {
    pf.current = { id, pos };
    setTick((n) => n + 1);
  };
  const insertAfter = (id: string, nb: B[]) => {
    const cur = ref.current;
    const at = cur.findIndex((b) => b.id === id);
    commit([...cur.slice(0, at + 1), ...nb, ...cur.slice(at + 1)]);
  };
  const removeBlock = (id: string) => {
    const cur = ref.current;
    const i = cur.findIndex((b) => b.id === id);
    if (i < 0) return;
    const prev = cur[i - 1];
    const next = cur[i + 1];
    commit(cur.filter((b) => b.id !== id));
    if (prev) focus(prev.id, "end");
    else if (next) focus(next.id, "start");
  };

  /** 블록 순서 바꾸기: 위/아래로 한 칸 */
  const moveBy = (id: string, dir: -1 | 1, pos: "start" | "end" | number = "end") => {
    const cur = ref.current;
    const i = cur.findIndex((b) => b.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= cur.length) return;
    const next = [...cur];
    [next[i], next[j]] = [next[j], next[i]];
    commit(withTail(next));
    focus(id, pos);
  };
  /** 끌어다 놓기: target 블록의 앞/뒤로 이동 */
  const moveTo = (id: string, targetId: string, after: boolean) => {
    if (id === targetId) return;
    const cur = ref.current;
    const moving = cur.find((b) => b.id === id);
    if (!moving) return;
    const rest = cur.filter((b) => b.id !== id);
    const at = rest.findIndex((b) => b.id === targetId);
    if (at < 0) return;
    rest.splice(after ? at + 1 : at, 0, moving);
    commit(withTail(rest));
  };

  useLayoutEffect(() => {
    const f = pf.current;
    if (!f) return;
    pf.current = null;
    const el = els.current.get(f.id);
    if (!el) return;
    el.focus();
    if (el instanceof HTMLTextAreaElement) {
      const n = f.pos === "start" ? 0 : f.pos === "end" ? el.value.length : f.pos;
      el.setSelectionRange(n, n);
    }
  });

  useEffect(() => () => ref.current.forEach((b) => b.preview && URL.revokeObjectURL(b.preview)), []);

  /* ───────── 미디어 업로드 ───────── */
  function insertFiles(files: File[], afterId: string | null) {
    const cur = ref.current;
    let room = MAX_MEDIA - cur.filter(isMedia).length;
    const made: B[] = [];
    const jobs: { id: string; file: File }[] = [];
    for (const f of files) {
      const img = IMAGE_TYPES.includes(f.type);
      const vid = VIDEO_TYPES.includes(f.type);
      if (!img && !vid) { notify(`${f.name}: 이미지(PNG/JPG/WEBP/GIF)와 동영상(MP4/WEBM/MOV)만 올릴 수 있습니다.`); continue; }
      if (f.size > (img ? IMAGE_MAX : VIDEO_MAX)) { notify(`${f.name}: ${img ? "이미지는 5MB" : "동영상은 50MB"} 이하만 올릴 수 있습니다.`); continue; }
      if (room <= 0) { notify(`이미지·동영상은 글 하나에 ${MAX_MEDIA}개까지 넣을 수 있습니다.`); break; }
      room--;
      const b: B = { id: uid(), t: img ? "image" : "video", text: "", preview: URL.createObjectURL(f), up: true };
      made.push(b);
      jobs.push({ id: b.id, file: f });
    }
    if (!made.length) return;

    const at = afterId ? cur.findIndex((b) => b.id === afterId) : -1;
    let next: B[];
    if (at >= 0 && cur[at].t === "p" && !cur[at].text.trim()) next = [...cur.slice(0, at), ...made, ...cur.slice(at + 1)];
    else {
      const pos = at >= 0 ? at + 1 : cur.length;
      next = [...cur.slice(0, pos), ...made, ...cur.slice(pos)];
    }
    const lastIdx = next.indexOf(made[made.length - 1]);
    if (lastIdx === next.length - 1) {
      const p = mk("p");
      next.push(p);
      pf.current = { id: p.id, pos: "start" };
    }
    commit(next);

    for (const { id, file } of jobs) {
      onUpload(file).then(
        (url) => {
          if (!ref.current.some((b) => b.id === id)) return;
          commit(ref.current.map((b) => (b.id === id ? { ...b, url, up: false } : b)));
        },
        (err) => {
          notify(err instanceof Error && err.message ? err.message : `${file.name}: 업로드하지 못했습니다.`);
          commit(ref.current.filter((b) => b.id !== id));
        },
      );
    }
  }

  const openPicker = (kind: "image" | "video", afterId: string | null) => {
    const input = fileRef.current;
    if (!input) return;
    afterRef.current = afterId;
    input.accept = (kind === "image" ? IMAGE_TYPES : VIDEO_TYPES).join(",");
    input.value = "";
    input.click();
  };

  /* ───────── 슬래시 메뉴 ───────── */
  const ab = blocks.find((b) => b.id === active);
  const slash = ab && ab.t === "p" ? /^\/(\S*)$/.exec(ab.text) : null;
  const items = slash && ab && menuOff !== ab.id ? ITEMS.filter((it) => `${it.label} ${it.kw}`.toLowerCase().includes(slash[1].toLowerCase())) : [];
  const sel = Math.min(menuIdx, Math.max(0, items.length - 1));

  function pick(id: string, it: (typeof ITEMS)[number]) {
    if (it.k === "image" || it.k === "video") {
      patch(id, { text: "" });
      openPicker(it.k, id);
      return;
    }
    if (it.k === "hr") {
      const p = mk("p");
      commit(ref.current.flatMap((b) => (b.id === id ? [{ ...b, t: "hr" as T, text: "" }, p] : [b])));
      focus(p.id, "start");
      return;
    }
    patch(id, { t: it.k, text: "" });
    focus(id, "start");
  }

  /* ───────── 텍스트 블록 입력 ───────── */
  function setText(b: B, raw: string) {
    let t = b.t;
    let text = b.t === "p" ? raw : raw.replace(/\n/g, " ");
    if (b.t === "p") {
      const sc: Record<string, T> = { "## ": "h2", "### ": "h3", "- ": "ul", "* ": "ul", "1. ": "ol", "> ": "quote" };
      const m = /^(### |## |- |\* |1\. |> )/.exec(raw);
      if (m) { t = sc[m[1]]; text = raw.slice(m[1].length); }
    }
    setMenuIdx(0);
    setMenuOff(null);
    patch(b.id, { t, text });
  }

  const oneLine = (el: HTMLTextAreaElement) => el.scrollHeight <= (parseFloat(getComputedStyle(el).lineHeight) || 24) * 1.6 + 12;

  function onKey(e: React.KeyboardEvent<HTMLTextAreaElement>, b: B, i: number) {
    if (e.nativeEvent.isComposing || e.keyCode === 229) return; // 한글 조합 중에는 무시
    const el = e.currentTarget;
    const s = el.selectionStart;
    const en = el.selectionEnd;
    const cur = ref.current;

    if (items.length > 0) {
      if (e.key === "ArrowDown") { e.preventDefault(); setMenuIdx((sel + 1) % items.length); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); setMenuIdx((sel - 1 + items.length) % items.length); return; }
      if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); pick(b.id, items[sel]); return; }
      if (e.key === "Escape") { e.preventDefault(); setMenuOff(b.id); return; }
    }

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
      e.preventDefault();
      if (s === en) return;
      const text = b.text.slice(0, s) + "**" + b.text.slice(s, en) + "**" + b.text.slice(en);
      patch(b.id, { text });
      focus(b.id, en + 4);
      return;
    }

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      const url = window.prompt("링크 주소 (https://…)", "https://")?.trim();
      if (!url || !/^https?:\/\/\S+$/.test(url)) { if (url) notify("http:// 또는 https:// 로 시작하는 주소를 입력해 주세요."); return; }
      const label = b.text.slice(s, en) || "링크";
      const md = `[${label}](${url})`;
      patch(b.id, { text: b.text.slice(0, s) + md + b.text.slice(en) });
      focus(b.id, s + md.length);
      return;
    }

    if (e.key === "Enter") {
      if (e.shiftKey) { if (b.t !== "p") e.preventDefault(); return; }
      e.preventDefault();
      if (b.t === "p" && b.text.trim() === "---") {
        const p = mk("p");
        commit(cur.flatMap((x) => (x.id === b.id ? [{ ...x, t: "hr" as T, text: "" }, p] : [x])));
        focus(p.id, "start");
        return;
      }
      if ((b.t === "ul" || b.t === "ol" || b.t === "quote") && !b.text) { patch(b.id, { t: "p" }); return; }
      const nt: T = b.t === "ul" || b.t === "ol" || b.t === "quote" ? b.t : "p";
      const nb = mk(nt, b.text.slice(en));
      commit(cur.flatMap((x) => (x.id === b.id ? [{ ...x, text: b.text.slice(0, s) }, nb] : [x])));
      focus(nb.id, "start");
      return;
    }

    if (e.key === "Backspace" && s === 0 && en === 0) {
      if (b.t !== "p") { e.preventDefault(); patch(b.id, { t: "p" }); return; }
      const prev = cur[i - 1];
      if (!prev) return;
      e.preventDefault();
      if (isText(prev)) {
        const joined = prev.text + b.text;
        commit(cur.filter((x) => x.id !== b.id).map((x) => (x.id === prev.id ? { ...x, text: joined } : x)));
        focus(prev.id, prev.text.length);
      } else if (prev.t === "hr") commit(cur.filter((x) => x.id !== prev.id));
      else if (!b.text) removeBlock(b.id);
      else focus(prev.id);
      return;
    }

    if (e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
      e.preventDefault();
      moveBy(b.id, e.key === "ArrowUp" ? -1 : 1, s);
      return;
    }

    if (e.shiftKey || e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key === "ArrowUp" && s === en && (s === 0 || oneLine(el)) && i > 0) { e.preventDefault(); focus(cur[i - 1].id, "end"); }
    if (e.key === "ArrowDown" && s === en && (s === el.value.length || oneLine(el)) && i < cur.length - 1) { e.preventDefault(); focus(cur[i + 1].id, "start"); }
  }

  function onNavKey(e: React.KeyboardEvent<HTMLElement>, b: B, i: number) {
    if (e.target !== e.currentTarget) return;
    const cur = ref.current;
    if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) { e.preventDefault(); moveBy(b.id, e.key === "ArrowUp" ? -1 : 1); }
    else if (e.key === "Backspace" || e.key === "Delete") { e.preventDefault(); removeBlock(b.id); }
    else if (e.key === "Enter") { e.preventDefault(); const p = mk("p"); insertAfter(b.id, [p]); focus(p.id, "start"); }
    else if (e.key === "ArrowUp" && i > 0) { e.preventDefault(); focus(cur[i - 1].id, "end"); }
    else if (e.key === "ArrowDown" && i < cur.length - 1) { e.preventDefault(); focus(cur[i + 1].id, "start"); }
  }

  /* ───────── 붙여넣기 / 드래그 ───────── */
  function onPaste(e: React.ClipboardEvent) {
    const text = e.clipboardData.getData("text/plain");
    const files = Array.from(e.clipboardData.files);
    if (files.length && !text) {
      e.preventDefault();
      insertFiles(files, active ?? ref.current[ref.current.length - 1].id);
      return;
    }
    const t = e.target;
    // 글자를 선택한 상태에서 URL 을 붙여넣으면 링크로 만들기
    if (t instanceof HTMLTextAreaElement && /^https?:\/\/\S+$/.test(text.trim()) && t.selectionStart !== t.selectionEnd) {
      const cb = ref.current.find((x) => x.id === active);
      if (cb) {
        e.preventDefault();
        const a = t.selectionStart;
        const md = `[${cb.text.slice(a, t.selectionEnd)}](${text.trim()})`;
        patch(cb.id, { text: cb.text.slice(0, a) + md + cb.text.slice(t.selectionEnd) });
        focus(cb.id, a + md.length);
        return;
      }
    }
    if (!(t instanceof HTMLTextAreaElement) || !text.includes("\n")) return;
    const b = ref.current.find((x) => x.id === active);
    if (!b) return;
    const pasted = parseMd(text);
    if (!pasted.length) return;
    e.preventDefault();
    const before = b.text.slice(0, t.selectionStart);
    const after = b.text.slice(t.selectionEnd);
    const keepType: T = b.t === "ul" || b.t === "ol" || b.t === "quote" ? b.t : "p";
    const tail = after ? [mk(keepType, after)] : [];
    const head = before || b.t !== "p" ? [{ ...b, text: before }] : [];
    const last = pasted[pasted.length - 1];
    commit(ref.current.flatMap((x) => (x.id === b.id ? [...head, ...pasted, ...tail] : [x])));
    if (isText(last)) focus(last.id, "end");
  }

  const hasFiles = (e: React.DragEvent) => Array.from(e.dataTransfer.types).includes("Files");

  const lastBlock = blocks[blocks.length - 1];
  // 대표를 지정하지 않으면 첫 이미지가 자동으로 썸네일이 됩니다.
  const autoCoverId = blocks.some((x) => x.cover) ? null : blocks.find((x) => x.t === "image" && !x.up)?.id ?? null;

  return (
    <div
      className={`rounded-lg transition-shadow ${drag ? "ring-2 ring-brand/50" : ""}`}
      onPaste={onPaste}
      onDragOver={(e) => { if (hasFiles(e)) { e.preventDefault(); setDrag(true); } }}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDrag(false); }}
      onDrop={(e) => {
        setDrag(false);
        if (!hasFiles(e)) return;
        e.preventDefault();
        insertFiles(Array.from(e.dataTransfer.files), active ?? lastBlock.id);
      }}
    >
      <input ref={fileRef} type="file" multiple className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => { insertFiles(Array.from(e.target.files ?? []), afterRef.current); e.target.value = ""; }} />

      <div className="space-y-1">
        {blocks.map((b, i) => {
          const reg = (el: HTMLElement | null) => { if (el) els.current.set(b.id, el); else els.current.delete(b.id); };
          const isActive = active === b.id;
          let content: React.ReactNode;

          if (isText(b)) {
            let n = 1;
            for (let j = i - 1; j >= 0 && blocks[j].t === "ol"; j--) n++;
            const ph = b.t === "p" ? (isActive ? "텍스트를 입력하거나 '/' 로 이미지·동영상·제목을 추가하세요" : blocks.length === 1 ? (placeholder ?? "") : "") : BLOCK_HINT[b.t];
            const area = (
              <Area
                value={b.text}
                onValue={(v) => setText(b, v)}
                onKeyDown={(e) => onKey(e, b, i)}
                onFocus={() => setActive(b.id)}
                onBlur={() => setActive((a) => (a === b.id ? null : a))}
                reg={reg}
                className={TEXT_CLASS[b.t]}
                placeholder={ph}
                maxLength={5000}
              />
            );
            // 블록 유형이 바뀌어도 textarea 가 다시 만들어지지 않도록 항상 같은 구조로 렌더링합니다 (포커스 유지).
            const wrap = b.t === "ul" || b.t === "ol" ? "flex gap-2 pl-1" : b.t === "quote" ? "border-l-4 border-brand/40 pl-3" : "";
            content = (
              <div className={wrap}>
                {b.t === "ul" && <span aria-hidden className="select-none leading-relaxed">•</span>}
                {b.t === "ol" && <span aria-hidden className="min-w-4 select-none leading-relaxed text-muted-foreground">{n}.</span>}
                {area}
              </div>
            );
          } else if (b.t === "hr") {
            content = (
              <div ref={reg} tabIndex={0} onFocus={() => setActive(b.id)} onBlur={() => setActive((a) => (a === b.id ? null : a))} onKeyDown={(e) => onNavKey(e, b, i)} className="rounded py-3 outline-none focus:bg-muted">
                <hr />
              </div>
            );
          } else {
            const src = b.url ?? b.preview;
            const w = b.t === "image" ? (b.w ?? 100) : 100;
            const resizable = b.t === "image" && !b.up;
            content = (
              <div ref={reg} data-media-outer tabIndex={0} onFocus={() => setActive(b.id)} onBlur={() => setActive((a) => (a === b.id ? null : a))} onKeyDown={(e) => onNavKey(e, b, i)} className="my-1 rounded-lg outline-none focus:ring-2 focus:ring-brand/50">
              <div style={{ width: `${w}%` }} className="group/media relative mx-auto overflow-hidden rounded-lg border">
                {b.t === "image" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={src} alt="첨부 이미지" draggable={false} className="mx-auto max-h-[70vh] w-full object-contain" />
                ) : (
                  <video src={src} controls={!b.up} playsInline preload="metadata" className="mx-auto max-h-[70vh] w-full bg-black" />
                )}
                {resizable && <ResizeHandle side="left" width={w} onWidth={(nw) => patch(b.id, { w: nw >= 100 ? undefined : nw })} />}
                {resizable && <ResizeHandle side="right" width={w} onWidth={(nw) => patch(b.id, { w: nw >= 100 ? undefined : nw })} />}
                {resizable && w < 100 && <span className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-foreground/80 px-2 py-0.5 text-xs font-medium text-background">{w}%</span>}
                <div className="absolute bottom-2 right-2 flex flex-col gap-1 sm:hidden">
                  <button type="button" aria-label="위로 이동" onClick={() => moveBy(b.id, -1)} className="rounded-full bg-foreground/80 p-1 text-background"><ChevronUp className="size-4" /></button>
                  <button type="button" aria-label="아래로 이동" onClick={() => moveBy(b.id, 1)} className="rounded-full bg-foreground/80 p-1 text-background"><ChevronDown className="size-4" /></button>
                </div>
                {b.up && (
                  <div className="absolute inset-0 flex items-center justify-center gap-2 bg-background/70 text-sm font-medium">
                    <Loader2 className="size-4 animate-spin" /> 업로드 중…
                  </div>
                )}
                {b.t === "image" && !b.up && (
                  <button
                    type="button"
                    aria-pressed={!!b.cover}
                    title={b.cover ? "대표 사진 해제" : "대표 사진(썸네일)으로 지정"}
                    onClick={() => toggleCover(b.id)}
                    className={`absolute left-2 top-2 inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${b.cover || autoCoverId === b.id ? "bg-brand text-white opacity-100" : "bg-foreground/80 text-background hover:bg-foreground sm:opacity-0 sm:group-hover/media:opacity-100 sm:group-focus/media:opacity-100"}`}
                  >
                    <Star className={`size-3.5 ${b.cover || autoCoverId === b.id ? "fill-current" : ""}`} />
                    {b.cover ? "대표 사진" : autoCoverId === b.id ? "대표 사진 (자동)" : "대표로 지정"}
                  </button>
                )}
                <button type="button" aria-label="삭제" onClick={() => removeBlock(b.id)} className="absolute right-2 top-2 rounded-full bg-foreground/80 p-1 text-background opacity-100 hover:bg-foreground sm:opacity-0 sm:group-hover/media:opacity-100 sm:group-focus/media:opacity-100">
                  <X className="size-4" />
                </button>
              </div>
              </div>
            );
          }

          return (
            <div
              key={b.id}
              className={`group relative pl-12 ${dragId === b.id ? "opacity-40" : ""}`}
              onDragOver={(e) => {
                if (!dragId || hasFiles(e)) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                const r = e.currentTarget.getBoundingClientRect();
                const after = e.clientY > r.top + r.height / 2;
                setOver((o) => (o && o.id === b.id && o.after === after ? o : { id: b.id, after }));
              }}
              onDrop={(e) => {
                if (!dragId || hasFiles(e)) return;
                e.preventDefault();
                e.stopPropagation();
                const r = e.currentTarget.getBoundingClientRect();
                moveTo(dragId, b.id, e.clientY > r.top + r.height / 2);
                setDragId(null);
                setOver(null);
              }}
            >
              {over && over.id === b.id && dragId && dragId !== b.id && <div aria-hidden className={`pointer-events-none absolute inset-x-0 z-20 h-0.5 rounded bg-brand ${over.after ? "-bottom-0.5" : "-top-0.5"}`} />}
              <button
                type="button"
                tabIndex={-1}
                draggable
                aria-label="끌어서 순서 바꾸기"
                title="끌어서 순서 바꾸기 (Alt+↑/↓ 로도 이동)"
                onDragStart={(e) => {
                  e.dataTransfer.setData("application/x-fintalk-block", b.id);
                  e.dataTransfer.effectAllowed = "move";
                  const row = e.currentTarget.parentElement;
                  if (row) e.dataTransfer.setDragImage(row, 16, 16);
                  setDragId(b.id);
                }}
                onDragEnd={() => { setDragId(null); setOver(null); }}
                className={`absolute left-6 top-0.5 cursor-grab rounded p-1 text-muted-foreground/70 hover:bg-muted hover:text-foreground active:cursor-grabbing ${isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
              >
                <GripVertical className="size-4" />
              </button>
              <button
                type="button"
                tabIndex={-1}
                aria-label="블록 추가"
                title="블록 추가"
                onClick={() => {
                  if (b.t === "p" && !b.text) { patch(b.id, { text: "/" }); focus(b.id); return; }
                  const p = mk("p", "/");
                  insertAfter(b.id, [p]);
                  focus(p.id);
                }}
                className={`absolute left-0 top-0.5 rounded p-1 text-muted-foreground/70 hover:bg-muted hover:text-foreground ${isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
              >
                <Plus className="size-4" />
              </button>
              {content}
              {isActive && items.length > 0 && ab?.id === b.id && (
                <div role="listbox" aria-label="블록 선택" className="absolute left-12 top-full z-30 mt-1 w-64 max-w-[calc(100%-3rem)] rounded-lg border bg-card p-1 shadow-lg" onMouseDown={(e) => e.preventDefault()}>
                  <p className="px-2 py-1 text-xs text-muted-foreground">블록 추가</p>
                  {items.map((it, k) => (
                    <button key={it.k} type="button" role="option" aria-selected={k === sel} onMouseEnter={() => setMenuIdx(k)} onClick={() => pick(b.id, it)} className={`flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left ${k === sel ? "bg-muted" : ""}`}>
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-md border bg-background"><it.Icon className="size-4" /></span>
                      <span className="min-w-0">
                        <span className="block text-sm font-medium">{it.label}</span>
                        <span className="block truncate text-xs text-muted-foreground">{it.desc}</span>
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 빈 공간을 누르면 맨 아래에서 이어서 쓰기 */}
      <div
        className="min-h-48 cursor-text"
        onClick={() => {
          if (isText(lastBlock)) focus(lastBlock.id, "end");
          else { const p = mk("p"); insertAfter(lastBlock.id, [p]); focus(p.id, "start"); }
        }}
      />

      <div className="mt-1 flex flex-wrap items-center gap-2 border-t pt-2 text-xs text-muted-foreground">
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => openPicker("image", active ?? lastBlock.id)} className="inline-flex items-center gap-1 rounded-md border px-2 py-1 font-medium hover:bg-muted hover:text-foreground">
          <ImagePlus className="size-3.5" /> 이미지
        </button>
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => openPicker("video", active ?? lastBlock.id)} className="inline-flex items-center gap-1 rounded-md border px-2 py-1 font-medium hover:bg-muted hover:text-foreground">
          <Film className="size-3.5" /> 동영상
        </button>
        <span>왼쪽 ⋮⋮ 를 끌어 순서 변경 · 이미지 양옆을 끌어 크기 조절 · 붙여넣기·끌어다 놓기도 가능 · 이미지 5MB / 동영상 50MB · 최대 {MAX_MEDIA}개</span>
      </div>
    </div>
  );
}
