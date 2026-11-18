"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, CornerDownRight, Trash2 } from "lucide-react";
import { type Comment, creatorName } from "@/lib/sample-data";
import { useToast } from "@/components/common/toast";
import { UserAvatar } from "@/components/common/user-avatar";
import { acceptAnswerAction, addCommentAction, deleteCommentAction } from "@/app/actions/community";
import { ReportMenu, VoteBar, useGuard } from "./interactive";

/** live=false 이면 샘플 화면(저장 없음), live=true 이면 Supabase 에 저장 */
export function CommentForm({
  postId,
  parentId = null,
  live = false,
  onDone,
  placeholder,
  answer = false,
}: {
  postId?: string;
  parentId?: string | null;
  live?: boolean;
  onDone?: () => void;
  placeholder?: string;
  /** 질문 글: 답변 작성 문구로 표시 */
  answer?: boolean;
}) {
  const [text, setText] = useState("");
  const [pending, start] = useTransition();
  const { comingSoon, show } = useToast();
  const guard = useGuard();
  const router = useRouter();

  return (
    <form
      className="rounded-xl border bg-card p-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!live || !postId) return comingSoon("Comments on sample posts");
        start(async () => {
          const r = await addCommentAction(postId, parentId, text);
          if (guard(r)) {
            setText("");
            show(answer && !parentId ? "Answer posted." : "Comment posted.");
            onDone?.();
            router.refresh();
          }
        });
      }}
    >
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={parentId ? 2 : 3}
        maxLength={1000}
        placeholder={placeholder ?? (answer ? "Write an answer based on your experience and evidence. (Login required)" : "Please keep the discussion respectful. (Login required)")}
        className="w-full resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground"
      />
      <div className="flex items-center justify-between border-t pt-2">
        <span className="text-xs text-muted-foreground">{text.length}/1000</span>
        <button
          type="submit"
          disabled={pending || !text.trim()}
          className="rounded-lg bg-brand px-3.5 py-1.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {parentId ? "Post reply" : answer ? "Post answer" : "Post comment"}
        </button>
      </div>
    </form>
  );
}

function CommentItem({ c, postId, live, depth = 0, canAccept = false }: { c: Comment; postId?: string; live: boolean; depth?: number; canAccept?: boolean }) {
  const { comingSoon, show } = useToast();
  const guard = useGuard();
  const router = useRouter();
  const [replying, setReplying] = useState(false);

  return (
    <li className={depth ? "ml-5 border-l pl-4 sm:ml-8" : c.accepted ? "-mx-4 rounded-xl border-2 border-up/60 bg-up/5 px-4" : ""}>
      <div className="py-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <UserAvatar name={creatorName(c.author)} url={c.authorAvatar} className="size-6 text-[11px]" />
          <Link href={`/creators/${encodeURIComponent(c.author)}`} className="font-semibold text-foreground hover:text-brand">
            {creatorName(c.author)}
          </Link>
          <span>· {c.createdAt}</span>
          {c.accepted && (
            <span className="inline-flex items-center gap-1 rounded bg-up/10 px-1.5 py-0.5 text-[11px] font-semibold text-up"><CheckCircle2 className="size-3" />Accepted answer</span>
          )}
        </div>
        <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed">{c.body}</p>
        <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
          {c.upvotes !== undefined && <VoteBar up={c.upvotes} />}
          {depth === 0 && (
            <button
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 hover:bg-muted hover:text-foreground"
              onClick={() => (live ? setReplying(!replying) : comingSoon("Replies on sample posts"))}
            >
              <CornerDownRight className="size-3.5" /> Reply
            </button>
          )}
          {live && canAccept && !c.mine && (
            <button
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 hover:bg-muted hover:text-up"
              onClick={async () => {
                if (guard(await acceptAnswerAction(postId!, c.accepted ? null : c.id))) {
                  show(c.accepted ? "Acceptance removed." : "Accepted as the helpful answer.");
                  router.refresh();
                }
              }}
            >
              <CheckCircle2 className="size-3.5" /> {c.accepted ? "Unaccept" : "Accept answer"}
            </button>
          )}
          {live ? (
            <ReportMenu type="comment" id={c.id} />
          ) : null}
          {live && c.mine && (
            <button
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 hover:bg-muted hover:text-down"
              onClick={async () => {
                if (!confirm("Delete this comment?")) return;
                if (guard(await deleteCommentAction(c.id, postId!))) {
                  show("Deleted.");
                  router.refresh();
                }
              }}
            >
              <Trash2 className="size-3.5" /> Delete
            </button>
          )}
        </div>
        {replying && (
          <div className="mt-2">
            <CommentForm postId={postId} parentId={c.id} live onDone={() => setReplying(false)} placeholder="Write a reply" />
          </div>
        )}
      </div>
      {c.replies && c.replies.length > 0 && (
        <ul>
          {c.replies.map((r) => (
            <CommentItem key={r.id} c={r} postId={postId} live={live} depth={depth + 1} canAccept={canAccept} />
          ))}
        </ul>
      )}
    </li>
  );
}

export function CommentList({ comments, postId, live = false, canAccept = false, answer = false }: { comments: Comment[]; postId?: string; live?: boolean; canAccept?: boolean; answer?: boolean }) {
  if (comments.length === 0)
    return <p className="rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground">{answer ? "No answers yet. Share what you know." : "Be the first to comment."}</p>;
  // 채택된 답변을 맨 위로
  const ordered = [...comments].sort((a, b) => Number(!!b.accepted) - Number(!!a.accepted));
  return (
    <ul className="divide-y rounded-xl border bg-card px-4">
      {ordered.map((c) => (
        <CommentItem key={c.id} c={c} postId={postId} live={live} canAccept={canAccept} />
      ))}
    </ul>
  );
}
