"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { ChevronDown, Maximize2, MessageCircle, Minimize2, Send } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { REASON_LABEL, fmtPrice, fmtUsd, type ClosedTrade } from "@/lib/trade";
import { cn } from "@/lib/utils";

type CloseMeta = { symbol: string; side: "long" | "short"; leverage: number; entry: number; exit: number; pnl: number; roe: number; reason: ClosedTrade["reason"] };
type Msg = {
  id: number;
  user_id: string | null;
  kind: "msg" | "close";
  nickname: string;
  avatar_url: string | null;
  body: string;
  meta: CloseMeta | null;
  created_at: string;
};

type Mode = "closed" | "open" | "tall";
const K_MODE = "fintalk.chat.mode.v1";
const MAX_KEEP = 200;
const time = (iso: string) => new Date(iso).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });

function Face({ name, url, size = 24 }: { name: string; url: string | null; size?: number }) {
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" width={size} height={size} className="shrink-0 rounded-full border object-cover" style={{ width: size, height: size }} />
  ) : (
    <span className="grid shrink-0 place-items-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground" style={{ width: size, height: size }} aria-hidden>
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}

function CloseCard({ m }: { m: Msg }) {
  const c = m.meta;
  if (!c) return null;
  const liq = c.reason === "liquidation";
  const win = c.pnl > 0;
  const long = c.side === "long";
  const extra = c.reason === "tp" || c.reason === "sl" || c.reason === "limit" ? REASON_LABEL[c.reason] : null;
  return (
    <div className={cn("rounded-xl border px-3 py-2 text-sm", liq ? "border-down/60" : win ? "border-up/60" : "border-border")}>
      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
        <span className={cn("rounded px-1.5 py-0.5 text-[11px] font-bold text-white", liq ? "bg-down" : "bg-brand")}>{liq ? "강제청산" : "선물"}</span>
        <Face name={m.nickname} url={m.avatar_url} size={20} />
        <span className="font-semibold">{m.nickname}</span>
        <span className="font-bold">{c.symbol}</span>
        <span className={cn("font-bold", long ? "text-up" : "text-down")}>{long ? "LONG" : "SHORT"}</span>
        <span className="text-muted-foreground">{c.leverage}x 청산{extra ? ` · ${extra}` : ""}</span>
      </div>
      <div className="mt-1 flex items-baseline justify-between gap-2">
        <span className={cn("text-base font-extrabold tabular-nums", c.pnl >= 0 ? "text-up" : "text-down")}>
          {c.pnl >= 0 ? "+" : ""}
          {fmtUsd(c.pnl)} USDT
          <span className="ml-1.5 text-xs font-semibold">({c.roe >= 0 ? "+" : ""}{c.roe.toFixed(2)}%)</span>
        </span>
        <span className="shrink-0 text-[11px] text-muted-foreground">{time(m.created_at)}</span>
      </div>
      <p className="mt-0.5 text-[11px] text-muted-foreground tabular-nums">
        진입 {fmtPrice(c.entry)} → 청산 {fmtPrice(c.exit)}
      </p>
    </div>
  );
}

function Bubble({ m, mine }: { m: Msg; mine: boolean }) {
  return (
    <div className="flex items-start gap-2">
      <Face name={m.nickname} url={m.avatar_url} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-1.5">
          <span className={cn("text-xs font-semibold", mine && "text-brand")}>{m.nickname}</span>
          <span className="text-[10px] text-muted-foreground">{time(m.created_at)}</span>
        </div>
        <p className="whitespace-pre-wrap break-words text-sm leading-snug">{m.body}</p>
      </div>
    </div>
  );
}

/** 화면 오른쪽 아래의 실시간 채팅: 접기/펼치기/크게 보기, 접속자 수, 포지션 청산 라이브 피드 */
export function LiveChat() {
  // 저장된 열림 상태를 읽는 컴포넌트는 브라우저에서만 그려 서버 화면과 어긋나지 않게 합니다.
  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false);
  return mounted ? <ChatInner /> : null;
}

function readMode(): Mode {
  try {
    const v = localStorage.getItem(K_MODE);
    return v === "open" || v === "tall" ? v : "closed";
  } catch {
    return "closed";
  }
}

function ChatInner() {
  const pathname = usePathname();
  const [mode, setModeState] = useState<Mode>(readMode);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [online, setOnline] = useState(0);
  const [unread, setUnread] = useState(0);
  const [uid, setUid] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [err, setErr] = useState("");
  const [sending, setSending] = useState(false);
  const list = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const modeRef = useRef<Mode>(mode);
  const hidden = pathname.startsWith("/admin");

  const setMode = useCallback((m: Mode) => {
    modeRef.current = m;
    setModeState(m);
    if (m !== "closed") setUnread(0);
    try {
      localStorage.setItem(K_MODE, m);
    } catch {
      /* 저장 불가 환경 */
    }
  }, []);

  // 로그인 상태
  useEffect(() => {
    if (!isSupabaseConfigured || hidden) return;
    const sb = createClient();
    sb.auth.getUser().then(({ data }) => setUid(data.user?.id ?? null));
    const { data: sub } = sb.auth.onAuthStateChange((_e, s) => setUid(s?.user?.id ?? null));
    return () => sub.subscription.unsubscribe();
  }, [hidden]);

  // 기록 불러오기 + 실시간 구독 + 접속자(Presence)
  useEffect(() => {
    if (!isSupabaseConfigured || hidden) return;
    const sb = createClient();
    let alive = true;
    const key = Math.random().toString(36).slice(2);

    sb.from("chat_messages")
      .select("*")
      .order("id", { ascending: false })
      .limit(50)
      .then(({ data }) => {
        if (!alive || !data) return;
        setMsgs((cur) => {
          const seen = new Set(cur.map((x) => x.id));
          return [...(data as Msg[]).reverse().filter((x) => !seen.has(x.id)), ...cur].slice(-MAX_KEEP);
        });
      });

    const ch = sb
      .channel("fintalk-chat", { config: { presence: { key } } })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages" }, (p) => {
        const row = p.new as Msg;
        setMsgs((cur) => (cur.some((x) => x.id === row.id) ? cur : [...cur, row].slice(-MAX_KEEP)));
        if (modeRef.current === "closed") setUnread((n) => n + 1);
      })
      .on("presence", { event: "sync" }, () => setOnline(Object.keys(ch.presenceState()).length))
      .subscribe((status) => {
        if (status === "SUBSCRIBED") void ch.track({ at: Date.now() });
      });

    return () => {
      alive = false;
      void sb.removeChannel(ch);
    };
  }, [hidden]);

  // 새 메시지가 오면 맨 아래로 (위로 스크롤해서 읽는 중이면 그대로 둡니다)
  useEffect(() => {
    const el = list.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [msgs, mode]);

  const send = useCallback(async () => {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setErr("");
    const { error } = await createClient().rpc("chat_send", { p_body: body });
    setSending(false);
    if (error) setErr(error.message);
    else {
      setText("");
      stick.current = true;
    }
  }, [text, sending]);

  if (hidden || !isSupabaseConfigured) return null;

  if (mode === "closed") {
    return (
      <button
        type="button"
        onClick={() => setMode("open")}
        className="fixed bottom-[76px] right-3 z-[60] flex items-center gap-2 rounded-full border bg-card px-4 py-2.5 text-sm font-semibold shadow-lg transition-colors hover:bg-muted lg:bottom-4"
        aria-label="실시간 채팅 열기"
      >
        <MessageCircle className="size-4 text-brand" />
        실시간 채팅
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <span className="size-1.5 rounded-full bg-up" />
          {online}
        </span>
        {unread > 0 && <span className="grid min-w-5 place-items-center rounded-full bg-down px-1.5 text-[11px] font-bold text-white">{unread > 99 ? "99+" : unread}</span>}
      </button>
    );
  }

  return (
    <section
      aria-label="실시간 채팅"
      className={cn(
        "fixed bottom-[76px] right-3 z-[60] flex w-[min(94vw,380px)] flex-col overflow-hidden rounded-2xl border bg-card shadow-2xl lg:bottom-4",
        mode === "tall" ? "h-[calc(100dvh-110px)] sm:w-[min(94vw,440px)]" : "h-[min(68dvh,480px)]",
      )}
    >
      <header className="flex items-center gap-2 border-b px-3 py-2.5">
        <span className="grid size-8 place-items-center rounded-lg bg-brand text-white">
          <MessageCircle className="size-4" />
        </span>
        <h2 className="text-sm font-bold">실시간 채팅</h2>
        <span className="flex items-center gap-1 rounded-full border border-up/40 bg-up/10 px-2 py-0.5 text-[11px] font-semibold text-up" title="지금 접속 중인 사람">
          <span className="size-1.5 rounded-full bg-up" />
          {online}
        </span>
        <span className="ml-auto flex items-center gap-0.5">
          <button type="button" onClick={() => setMode(mode === "tall" ? "open" : "tall")} aria-label={mode === "tall" ? "채팅 작게" : "채팅 크게"} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
            {mode === "tall" ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
          </button>
          <button type="button" onClick={() => setMode("closed")} aria-label="채팅 접기" className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
            <ChevronDown className="size-4" />
          </button>
        </span>
      </header>

      <div
        ref={list}
        onScroll={(e) => {
          const el = e.currentTarget;
          stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
        }}
        className="flex-1 space-y-2.5 overflow-y-auto px-3 py-3"
      >
        {msgs.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">아직 대화가 없습니다. 첫 메시지를 남겨 보세요!</p>
        ) : (
          msgs.map((m) => (m.kind === "close" ? <CloseCard key={m.id} m={m} /> : <Bubble key={m.id} m={m} mine={m.user_id === uid} />))
        )}
      </div>

      <footer className="border-t p-2.5">
        {uid ? (
          <>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void send();
              }}
              className="flex gap-2"
            >
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                maxLength={300}
                placeholder="메시지를 입력하세요"
                aria-label="채팅 메시지"
                className="h-9 min-w-0 flex-1 rounded-lg border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              />
              <button type="submit" disabled={sending || !text.trim()} aria-label="보내기" className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand text-white disabled:opacity-40">
                <Send className="size-4" />
              </button>
            </form>
            {err && <p className="mt-1.5 text-xs text-down">{err}</p>}
          </>
        ) : (
          <p className="rounded-lg border border-dashed bg-muted/40 py-2.5 text-center text-sm text-muted-foreground">
            <Link href="/login" className="font-semibold text-brand hover:underline">로그인</Link> 후 이용해주세요.
          </p>
        )}
      </footer>
    </section>
  );
}
