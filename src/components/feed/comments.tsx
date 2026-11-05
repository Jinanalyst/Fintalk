"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, CornerDownRight, Trash2 } from "lucide-react";
import { type Comment, creatorName } from "@/lib/sample-data";
import { useToast } from "@/components/common/toast";
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
        if (!live || !postId) return comingSoon("샘플 게시글 댓글");
        start(async () => {
          const r = await addCommentAction(postId, parentId, text);
          if (guard(r)) {
            setText("");
            show(answer && !parentId ? "답변을 등록했습니다." : "댓글을 등록했습니다.");
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
        placeholder={placeholder ?? (answer ? "내 경험과 근거를 바탕으로 질문자에게 도움이 될 답변을 작성해 주세요. (로그인 필요)" : "서로 존중하는 토론 문화를 만들어 주세요. (로그인 필요)")}
        className="w-full resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground"
      />
      <div className="flex items-center justify-between border-t pt-2">
        <span className="text-xs text-muted-foreground">{text.length}/1000</span>
        <button
          type="submit"
          disabled={pending || !text.trim()}
          className="rounded-lg bg-brand px-3.5 py-1.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {parentId ? "답글 등록" : answer ? "답변 등록" : "댓글 등록"}
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
          <span className="grid size-6 place-items-center rounded-full bg-brand-soft text-[11px] font-bold text-brand">
            {creatorName(c.author).slice(0, 1)}
          </span>
          <Link href={`/creators/${encodeURIComponent(c.author)}`} className="font-semibold text-foreground hover:text-brand">
            {creatorName(c.author)}
          </Link>
          <span>· {c.createdAt}</span>
          {c.accepted && (
            <span className="inline-flex items-center gap-1 rounded bg-up/10 px-1.5 py-0.5 text-[11px] font-semibold text-up"><CheckCircle2 className="size-3" />채택된 답변</span>
          )}
        </div>
        <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed">{c.body}</p>
        <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
          {c.upvotes !== undefined && <VoteBar up={c.upvotes} />}
          {depth === 0 && (
            <button
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 hover:bg-muted hover:text-foreground"
              onClick={() => (live ? setReplying(!replying) : comingSoon("샘플 게시글 답글"))}
            >
              <CornerDownRight className="size-3.5" /> 답글
            </button>
          )}
          {live && canAccept && !c.mine && (
            <button
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 hover:bg-muted hover:text-up"
              onClick={async () => {
                if (guard(await acceptAnswerAction(postId!, c.accepted ? null : c.id))) {
                  show(c.accepted ? "채택을 취소했습니다." : "도움이 된 답변으로 채택했습니다.");
                  router.refresh();
                }
              }}
            >
              <CheckCircle2 className="size-3.5" /> {c.accepted ? "채택 취소" : "답변 채택"}
            </button>
          )}
          {live ? (
            <ReportMenu type="comment" id={c.id} />
          ) : null}
          {live && c.mine && (
            <button
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 hover:bg-muted hover:text-down"
              onClick={async () => {
                if (!confirm("댓글을 삭제할까요?")) return;
                if (guard(await deleteCommentAction(c.id, postId!))) {
                  show("삭제했습니다.");
                  router.refresh();
                }
              }}
            >
              <Trash2 className="size-3.5" /> 삭제
            </button>
          )}
        </div>
        {replying && (
          <div className="mt-2">
            <CommentForm postId={postId} parentId={c.id} live onDone={() => setReplying(false)} placeholder="답글을 입력하세요" />
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
    return <p className="rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground">{answer ? "아직 답변이 없어요. 아는 만큼 먼저 답해 주세요." : "첫 댓글을 남겨보세요."}</p>;
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
