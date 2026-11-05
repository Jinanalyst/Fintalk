"use client";

import Link from "next/link";
import { useState } from "react";
import { CornerDownRight, Flag } from "lucide-react";
import { type Comment, creatorName } from "@/lib/sample-data";
import { useToast } from "@/components/common/toast";
import { VoteBar } from "./interactive";

export function CommentForm() {
  const [text, setText] = useState("");
  const { comingSoon } = useToast();
  return (
    <form
      className="rounded-xl border bg-card p-3"
      onSubmit={(e) => {
        e.preventDefault();
        comingSoon("댓글 등록 (로그인 필요)");
      }}
    >
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        placeholder="로그인 후 댓글을 남길 수 있습니다. 서로 존중하는 토론 문화를 만들어 주세요."
        className="w-full resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground"
      />
      <div className="flex items-center justify-between border-t pt-2">
        <span className="text-xs text-muted-foreground">{text.length}/1000</span>
        <button type="submit" className="rounded-lg bg-brand px-3.5 py-1.5 text-sm font-semibold text-primary-foreground hover:opacity-90">
          댓글 등록
        </button>
      </div>
    </form>
  );
}

function CommentItem({ c, depth = 0 }: { c: Comment; depth?: number }) {
  const { comingSoon } = useToast();
  return (
    <li className={depth ? "ml-5 border-l pl-4 sm:ml-8" : ""}>
      <div className="py-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="grid size-6 place-items-center rounded-full bg-brand-soft text-[11px] font-bold text-brand">
            {creatorName(c.author).slice(0, 1)}
          </span>
          <Link href={`/creators/${c.author}`} className="font-semibold text-foreground hover:text-brand">
            {creatorName(c.author)}
          </Link>
          <span>· {c.createdAt}</span>
        </div>
        <p className="mt-1.5 text-sm leading-relaxed">{c.body}</p>
        <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
          <VoteBar up={c.upvotes} />
          {depth === 0 && (
            <button className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => comingSoon("대댓글")}>
              <CornerDownRight className="size-3.5" /> 답글
            </button>
          )}
          <button className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => comingSoon("신고")}>
            <Flag className="size-3.5" /> 신고
          </button>
        </div>
      </div>
      {c.replies && (
        <ul>
          {c.replies.map((r) => (
            <CommentItem key={r.id} c={r} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  );
}

export function CommentList({ comments }: { comments: Comment[] }) {
  return (
    <ul className="divide-y rounded-xl border bg-card px-4">
      {comments.map((c) => (
        <CommentItem key={c.id} c={c} />
      ))}
    </ul>
  );
}
