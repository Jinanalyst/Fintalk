"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Logo } from "./header";
import {
  googleAction,
  resetRequestAction,
  signInAction,
  signUpAction,
  updatePasswordAction,
  type FormState,
} from "@/app/actions/auth";

const field =
  "w-full rounded-lg border bg-card px-3 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
      <path fill="#4285F4" d="M23 12.3c0-.8-.1-1.5-.2-2.2H12v4.2h6.2a5.3 5.3 0 0 1-2.3 3.5v2.9h3.7c2.2-2 3.4-4.9 3.4-8.4z" />
      <path fill="#34A853" d="M12 23.5c3.1 0 5.7-1 7.6-2.8l-3.7-2.9c-1 .7-2.3 1.1-3.9 1.1-3 0-5.5-2-6.4-4.7H1.8v3C3.7 21.1 7.5 23.5 12 23.5z" />
      <path fill="#FBBC05" d="M5.6 14.2a6.9 6.9 0 0 1 0-4.4v-3H1.8a11.5 11.5 0 0 0 0 10.4l3.8-3z" />
      <path fill="#EA4335" d="M12 5.4c1.7 0 3.2.6 4.4 1.7l3.3-3.3A11.4 11.4 0 0 0 12 .5C7.5.5 3.7 2.9 1.8 6.8l3.8 3C6.5 7.4 9 5.4 12 5.4z" />
    </svg>
  );
}

type Mode = "login" | "signup" | "reset" | "newpw";
const titles: Record<Mode, string> = { login: "로그인", signup: "회원가입", reset: "비밀번호 재설정", newpw: "새 비밀번호 설정" };
const actions = { login: signInAction, signup: signUpAction, reset: resetRequestAction, newpw: updatePasswordAction };
const urlErrors: Record<string, string> = {
  config: "서버에 Supabase 환경변수가 설정되지 않았습니다.",
  oauth: "Google 로그인을 시작하지 못했습니다. 설정을 확인해 주세요.",
  callback: "인증 링크가 만료되었거나 올바르지 않습니다. 다시 시도해 주세요.",
};

export function AuthForm({
  mode,
  next = "/",
  urlError,
  configured,
}: {
  mode: Mode;
  next?: string;
  urlError?: string;
  configured: boolean;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(actions[mode], {});
  const error = state.error ?? (urlError ? urlErrors[urlError] : undefined);

  return (
    <div className="mx-auto max-w-sm">
      <div className="mb-6 flex flex-col items-center gap-2 text-center">
        <Logo />
        <p className="text-sm text-muted-foreground">시장을 읽고, 생각을 나누다.</p>
      </div>
      <div className="rounded-xl border bg-card p-5 shadow-xs">
        <h1 className="mb-4 text-lg font-bold">{titles[mode]}</h1>

        {!configured && (
          <p className="mb-3 rounded-lg border border-amber-300/70 bg-amber-50 p-2.5 text-xs text-amber-800 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-200">
            Supabase 환경변수가 설정되지 않아 로그인이 비활성화되어 있습니다. <code>.env.local</code> 을 설정해 주세요.
          </p>
        )}
        {error && <p role="alert" className="mb-3 rounded-lg bg-down/10 p-2.5 text-sm text-down">{error}</p>}
        {state.message && <p role="status" className="mb-3 rounded-lg bg-up/10 p-2.5 text-sm text-up">{state.message}</p>}

        <form action={formAction} className="space-y-3">
          <input type="hidden" name="next" value={next} />
          {mode === "signup" && (
            <div>
              <label className="mb-1 block text-sm font-medium" htmlFor="nick">닉네임</label>
              <input id="nick" name="nickname" required className={field} placeholder="한글/영문/숫자 2~14자" minLength={2} maxLength={14} />
            </div>
          )}
          {mode !== "newpw" && (
            <div>
              <label className="mb-1 block text-sm font-medium" htmlFor="email">이메일</label>
              <input id="email" name="email" type="email" required autoComplete="email" className={field} placeholder="you@example.com" />
            </div>
          )}
          {mode !== "reset" && (
            <div>
              <label className="mb-1 block text-sm font-medium" htmlFor="pw">{mode === "newpw" ? "새 비밀번호" : "비밀번호"}</label>
              <input id="pw" name="password" type="password" required minLength={mode === "login" ? undefined : 8} autoComplete={mode === "login" ? "current-password" : "new-password"} className={field} placeholder="8자 이상" />
            </div>
          )}
          {mode === "signup" && (
            <label className="flex items-start gap-2 text-xs text-muted-foreground">
              <input type="checkbox" name="agree" required className="mt-0.5" />
              <span>
                <Link href="/terms" target="_blank" className="text-brand underline">이용약관</Link> 및{" "}
                <Link href="/privacy" target="_blank" className="text-brand underline">개인정보처리방침</Link>에 동의합니다. (투자 권유가 아닌 정보 공유 커뮤니티임을 이해합니다)
              </span>
            </label>
          )}
          <button
            type="submit"
            disabled={pending || !configured}
            className="w-full rounded-lg bg-brand py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {pending ? "처리 중…" : mode === "reset" ? "재설정 메일 보내기" : titles[mode]}
          </button>
        </form>

        {(mode === "login" || mode === "signup") && (
          <>
            <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground">
              <span className="h-px flex-1 bg-border" /> 또는 <span className="h-px flex-1 bg-border" />
            </div>
            <form action={googleAction}>
              <input type="hidden" name="next" value={next} />
              <button
                type="submit"
                disabled={!configured}
                className="flex w-full items-center justify-center gap-2 rounded-lg border py-2.5 text-sm font-medium hover:bg-muted disabled:opacity-50"
              >
                <GoogleIcon /> Google로 계속하기
              </button>
            </form>
          </>
        )}

        <div className="mt-4 flex justify-between text-xs text-muted-foreground">
          {mode === "login" ? (
            <>
              <Link href="/signup" className="hover:text-brand">회원가입</Link>
              <Link href="/forgot-password" className="hover:text-brand">비밀번호를 잊으셨나요?</Link>
            </>
          ) : (
            <Link href="/login" className="hover:text-brand">이미 계정이 있으신가요? 로그인</Link>
          )}
        </div>
      </div>
      <p className="mt-4 text-center text-xs text-muted-foreground">
        로그인 없이도 <Link href="/community" className="text-brand">공개 게시글</Link>과 <Link href="/insights" className="text-brand">인사이트</Link>를 읽을 수 있습니다.
      </p>
    </div>
  );
}
