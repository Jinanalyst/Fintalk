"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Logo } from "./header";
import {
  oauthAction,
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

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

/** Google / X one-click buttons (sign-up and log-in are the same flow). */
function OAuthButtons({ next, configured }: { next: string; configured: boolean }) {
  const btn = "flex h-12 w-full items-center justify-center gap-2.5 rounded-xl text-[15px] font-bold transition-opacity hover:opacity-90 disabled:opacity-50";
  return (
    <div className="space-y-2.5">
      <form action={oauthAction}>
        <input type="hidden" name="next" value={next} />
        <input type="hidden" name="provider" value="google" />
        <button type="submit" disabled={!configured} className={`${btn} border-2 bg-card`}>
          <GoogleIcon /> Continue with Google
        </button>
      </form>
      <form action={oauthAction}>
        <input type="hidden" name="next" value={next} />
        <input type="hidden" name="provider" value="x" />
        <button type="submit" disabled={!configured} className={`${btn} bg-foreground text-background`}>
          <XIcon /> Continue with X
        </button>
      </form>
    </div>
  );
}

type Mode = "login" | "signup" | "reset" | "newpw";
const titles: Record<Mode, string> = { login: "Log in", signup: "Join the contest", reset: "Reset password", newpw: "Set new password" };
const subtitles: Partial<Record<Mode, string>> = {
  login: "Welcome back. Pick up where you left off.",
  signup: "Free crypto paper trading · $10,000 virtual · no card needed",
};
const actions = { login: signInAction, signup: signUpAction, reset: resetRequestAction, newpw: updatePasswordAction };
const urlErrors: Record<string, string> = {
  config: "Supabase environment variables are not set on the server.",
  oauth: "Could not start the sign-in. Please try another option.",
  callback: "The verification link has expired or is invalid. Please try again.",
};

export function AuthForm({
  mode,
  next = "/trade",
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
  const social = mode === "login" || mode === "signup";
  // 소셜 버튼이 주 동선. 이메일 폼은 접어 두되, 오류·안내가 있으면 펼칩니다.
  const [emailOpen, setEmailOpen] = useState(!social);
  const showEmail = emailOpen || !!state.error || !!state.message;

  return (
    <div className="mx-auto max-w-sm">
      <div className="mb-6 flex flex-col items-center gap-2 text-center">
        <Logo />
        <p className="text-sm text-muted-foreground">Paper trading only · not investment advice</p>
      </div>
      <div className="rounded-xl border bg-card p-5 shadow-xs">
        <h1 className="text-xl font-extrabold tracking-tight">{titles[mode]}</h1>
        {subtitles[mode] && <p className="mt-1 text-sm text-muted-foreground">{subtitles[mode]}</p>}
        <div className="mb-4" />

        {!configured && (
          <p className="mb-3 rounded-lg border border-amber-300/70 bg-amber-50 p-2.5 text-xs text-amber-800 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-200">
            Login is disabled because Supabase environment variables are not set. Configure <code>.env.local</code>.
          </p>
        )}
        {error && <p role="alert" className="mb-3 rounded-lg bg-down/10 p-2.5 text-sm text-down">{error}</p>}
        {state.message && <p role="status" className="mb-3 rounded-lg bg-up/10 p-2.5 text-sm text-up">{state.message}</p>}

        {social && (
          <>
            <OAuthButtons next={next} configured={configured} />
            <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground">
              <span className="h-px flex-1 bg-border" />
              {showEmail ? "or with email" : (
                <button type="button" onClick={() => setEmailOpen(true)} className="font-medium hover:text-foreground">Use email instead</button>
              )}
              <span className="h-px flex-1 bg-border" />
            </div>
          </>
        )}

        {showEmail && (
        <form action={formAction} className="space-y-3">
          <input type="hidden" name="next" value={next} />
          {mode === "signup" && (
            <div>
              <label className="mb-1 block text-sm font-medium" htmlFor="nick">Nickname</label>
              <input id="nick" name="nickname" required className={field} placeholder="2-14 letters or numbers" minLength={2} maxLength={14} />
            </div>
          )}
          {mode !== "newpw" && (
            <div>
              <label className="mb-1 block text-sm font-medium" htmlFor="email">Email</label>
              <input id="email" name="email" type="email" required autoComplete="email" className={field} placeholder="you@example.com" />
            </div>
          )}
          {mode !== "reset" && (
            <div>
              <label className="mb-1 block text-sm font-medium" htmlFor="pw">{mode === "newpw" ? "New password" : "Password"}</label>
              <input id="pw" name="password" type="password" required minLength={mode === "login" ? undefined : 8} autoComplete={mode === "login" ? "current-password" : "new-password"} className={field} placeholder="At least 8 characters" />
            </div>
          )}
          {mode === "signup" && (
            <label className="flex items-start gap-2 text-xs text-muted-foreground">
              <input type="checkbox" name="agree" required className="mt-0.5" />
              <span>
                <Link href="/terms" target="_blank" className="text-brand underline">Terms of Service</Link> and{" "}
                <Link href="/privacy" target="_blank" className="text-brand underline">Privacy Policy</Link>. I understand FinTalk is an information-sharing community, not investment advice.
              </span>
            </label>
          )}
          <button
            type="submit"
            disabled={pending || !configured}
            className="w-full rounded-lg bg-brand py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {pending ? "Processing…" : mode === "reset" ? "Send reset email" : mode === "signup" ? "Sign up with email" : titles[mode]}
          </button>
        </form>
        )}


        <div className="mt-4 flex justify-between text-xs text-muted-foreground">
          {mode === "login" ? (
            <>
              <Link href={`/signup?next=${encodeURIComponent(next)}`} className="hover:text-brand">New here? Join</Link>
              <Link href="/forgot-password" className="hover:text-brand">Forgot your password?</Link>
            </>
          ) : (
            <Link href={`/login?next=${encodeURIComponent(next)}`} className="hover:text-brand">Already have an account? Log in</Link>
          )}
        </div>
      </div>
      <p className="mt-4 text-center text-xs text-muted-foreground">
        By continuing you agree to the <Link href="/terms" className="text-brand">Terms</Link> and <Link href="/privacy" className="text-brand">Privacy Policy</Link>.
      </p>
    </div>
  );
}
