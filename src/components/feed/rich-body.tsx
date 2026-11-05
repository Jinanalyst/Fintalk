import { Fragment } from "react";

/**
 * 인사이트용 가벼운 마크다운 렌더러. HTML 은 해석하지 않고 React 요소로만 만들기 때문에 XSS 위험이 없습니다.
 * 지원: `## 소제목`, `### 소소제목`, `- 목록`, `1. 번호 목록`, `> 인용`, `---` 구분선, `**굵게**`.
 * 마커가 없는 일반 글은 기존과 동일하게 문단으로 표시됩니다.
 */
function inline(text: string) {
  return text.split(/(\*\*[^*\n]+\*\*)/g).map((t, i) =>
    t.startsWith("**") && t.endsWith("**") && t.length > 4 ? <strong key={i}>{t.slice(2, -2)}</strong> : <Fragment key={i}>{t}</Fragment>,
  );
}

type Block = { k: "h2" | "h3" | "quote" | "hr" | "ul" | "ol" | "p"; lines: string[] };

function parse(src: string): Block[] {
  const blocks: Block[] = [];
  for (const raw of src.replace(/\r\n/g, "\n").split("\n")) {
    const line = raw.trimEnd();
    if (!line.trim()) { blocks.push({ k: "p", lines: [] }); continue; } // 문단 구분 표시
    let k: Block["k"] = "p";
    let text = line;
    if (/^---+$/.test(line.trim())) { blocks.push({ k: "hr", lines: [] }); continue; }
    if (line.startsWith("### ")) { k = "h3"; text = line.slice(4); }
    else if (line.startsWith("## ")) { k = "h2"; text = line.slice(3); }
    else if (line.startsWith("> ")) { k = "quote"; text = line.slice(2); }
    else if (/^[-*] /.test(line)) { k = "ul"; text = line.slice(2); }
    else if (/^\d+\. /.test(line)) { k = "ol"; text = line.replace(/^\d+\. /, ""); }
    const last = blocks[blocks.length - 1];
    if (last && last.k === k && (k === "ul" || k === "ol" || k === "quote" || (k === "p" && last.lines.length > 0))) last.lines.push(text);
    else blocks.push({ k, lines: [text] });
  }
  return blocks.filter((b) => b.k === "hr" || b.lines.length > 0);
}

export function RichBody({ text }: { text: string }) {
  return (
    <div className="space-y-3 text-[15px] leading-relaxed">
      {parse(text).map((b, i) => {
        switch (b.k) {
          case "h2": return <h2 key={i} className="pt-2 text-lg font-bold">{inline(b.lines[0])}</h2>;
          case "h3": return <h3 key={i} className="pt-1 text-base font-bold">{inline(b.lines[0])}</h3>;
          case "hr": return <hr key={i} className="my-4" />;
          case "quote": return <blockquote key={i} className="border-l-4 border-brand/40 pl-3 text-muted-foreground">{b.lines.map((l, j) => <p key={j}>{inline(l)}</p>)}</blockquote>;
          case "ul": return <ul key={i} className="list-disc space-y-1 pl-5">{b.lines.map((l, j) => <li key={j}>{inline(l)}</li>)}</ul>;
          case "ol": return <ol key={i} className="list-decimal space-y-1 pl-5">{b.lines.map((l, j) => <li key={j}>{inline(l)}</li>)}</ol>;
          default: return <p key={i} className="whitespace-pre-line break-words">{b.lines.map((l, j) => <Fragment key={j}>{j > 0 && "\n"}{inline(l)}</Fragment>)}</p>;
        }
      })}
    </div>
  );
}

/** 분당 약 500자 기준 예상 읽기 시간(분) */
export const readingMinutes = (text: string) => Math.max(1, Math.round(text.replace(/\s/g, "").length / 500));
