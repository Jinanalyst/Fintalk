"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { ArrowUpRight, Check, Loader2, X } from "lucide-react";
import { connectExchange, disconnectExchange, syncExchanges, type Connection } from "@/app/actions/connections";
import { cn } from "@/lib/utils";
import { Notice, inputCls, primaryBtn, secondaryBtn } from "./ui";
import { applySync } from "./use-exchanges";

type Meta = { id: string; name: string; short: string; url: string; passphrase: boolean; note?: string };

export const CONNECT_EXCHANGES: Meta[] = [
  { id: "OKX", name: "OKX", short: "OKX", url: "https://www.okx.com/account/my-api", passphrase: true },
  { id: "Binance", name: "Binance", short: "BN", url: "https://www.binance.com/en/my/settings/api-management", passphrase: false,
    note: "Binance needs “Enable Futures” on to read futures history. Leave withdrawals, transfers and spot trading off." },
  { id: "Bybit", name: "Bybit", short: "BY", url: "https://www.bybit.com/app/user/api-management", passphrase: false },
  { id: "Bitget", name: "Bitget", short: "BG", url: "https://www.bitget.com/account/newapi", passphrase: true },
];

const SERVER_IPS = (process.env.NEXT_PUBLIC_PLANNER_SERVER_IPS ?? "").trim();
const STEPS = ["Create key", "Paste key", "Verify"] as const;

export function Badge({ children }: { children: React.ReactNode }) {
  return <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted text-[11px] font-extrabold tracking-tight">{children}</span>;
}

/** The "Connect an exchange" cards plus the 3-step connect dialog. */
export function ConnectExchange({ connections, setConnections, signedIn, configured, canAddMore }: {
  connections: Connection[]; setConnections: (c: Connection[]) => void; signedIn: boolean; configured: boolean; canAddMore: boolean;
}) {
  const [active, setActive] = useState<Meta | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const sync = async (m: Meta) => {
    setBusy(m.id);
    const next = applySync(await syncExchanges(m.id));
    if (next) setConnections(next);
    setBusy(null);
  };
  const disconnect = async (m: Meta) => {
    if (!confirm(`Disconnect ${m.name}? The saved key is deleted. Trades already synced stay in your journal.`)) return;
    setBusy(m.id);
    if ((await disconnectExchange(m.id)).ok) setConnections(connections.filter((c) => c.exchange !== m.id));
    setBusy(null);
  };

  return (
    <>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-3">
        {CONNECT_EXCHANGES.map((m) => {
          const conn = connections.find((c) => c.exchange === m.id);
          const blocked = !conn && !canAddMore;
          return (
            <div key={m.id} className={cn("flex items-center gap-3 rounded-2xl border p-3", conn && "border-up/40 bg-up/5")}>
              <Badge>{m.short}</Badge>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{m.name}</p>
                {conn ? (
                  <p className={cn("truncate text-xs", conn.status === "error" ? "text-down" : "text-up")} title={conn.lastError ?? undefined}>
                    {conn.status === "error" ? "Needs attention" : conn.lastSyncAt ? `Synced ${new Date(conn.lastSyncAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "Connected"}
                  </p>
                ) : (
                  <button type="button" disabled={blocked} onClick={() => setActive(m)} className="text-sm font-medium text-brand hover:underline disabled:cursor-not-allowed disabled:text-muted-foreground disabled:no-underline">
                    {blocked ? "Pro" : "Connect"}
                  </button>
                )}
              </div>
              {conn && (
                <div className="flex shrink-0 flex-col items-end gap-0.5 text-xs">
                  <button type="button" disabled={busy === m.id} onClick={() => (conn.status === "error" ? setActive(m) : sync(m))} className="font-medium text-brand hover:underline disabled:opacity-60">
                    {busy === m.id ? "Syncing…" : conn.status === "error" ? "Reconnect" : "Sync"}
                  </button>
                  <button type="button" onClick={() => disconnect(m)} className="text-muted-foreground hover:text-down">Disconnect</button>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {connections.some((c) => c.status === "error") && <Notice tone="down">{connections.find((c) => c.status === "error")?.lastError ?? "A connection needs attention."}</Notice>}
      {active && (
        <ConnectDialog key={active.id} meta={active} signedIn={signedIn} configured={configured}
          onClose={() => setActive(null)} onDone={(c) => setConnections(c)} />
      )}
    </>
  );
}

function ConnectDialog({ meta, signedIn, configured, onClose, onDone }: { meta: Meta; signedIn: boolean; configured: boolean; onClose: () => void; onDone: (c: Connection[]) => void }) {
  const [step, setStep] = useState(0);
  const [key, setKey] = useState("");
  const [secret, setSecret] = useState("");
  const [pass, setPass] = useState("");
  const [state, setState] = useState<{ phase: "working" | "ok" | "error"; text: string }>({ phase: "working", text: "" });
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDialogElement>(null);

  const dlg = (el: HTMLDialogElement | null) => {
    ref.current = el;
    if (el && !el.open) el.showModal();
  };

  const verify = async () => {
    setStep(2);
    setState({ phase: "working", text: "" });
    const res = await connectExchange(meta.id, { key, secret, passphrase: pass });
    if (!res.ok) return setState({ phase: "error", text: res.error });
    const list = applySync(res);
    if (list) onDone(list);
    const n = res.positions[meta.id]?.length ?? 0;
    setState({ phase: "ok", text: `${n} closed trade${n === 1 ? "" : "s"} from the last 90 days synced into your journal.` });
  };

  const ready = key.trim() && secret.trim() && (!meta.passphrase || pass.trim());

  return (
    <dialog ref={dlg} onClose={onClose} onClick={(e) => e.target === ref.current && ref.current?.close()}
      className="m-auto max-h-[94vh] w-[min(96vw,640px)] overflow-hidden rounded-2xl border bg-card p-0 text-foreground backdrop:bg-black/60">
      <div className="flex max-h-[94vh] flex-col">
        <header className="flex items-center gap-3 border-b px-6 py-4">
          <Badge>{meta.short}</Badge>
          <h2 className="flex-1 text-xl font-extrabold tracking-tight">Connect {meta.name}</h2>
          <button type="button" onClick={() => ref.current?.close()} aria-label="Close" className="grid size-9 place-items-center rounded-full text-muted-foreground hover:bg-muted"><X className="size-5" /></button>
        </header>

        <ol className="grid grid-cols-3 gap-2 border-b px-6 py-4 text-sm">
          {STEPS.map((s, i) => (
            <li key={s} className={cn("flex items-center gap-2", i === step ? "font-semibold" : "text-muted-foreground")}>
              <span className={cn("grid size-7 place-items-center rounded-full text-xs font-bold", i === step ? "bg-brand text-white" : i < step ? "bg-up text-white" : "bg-muted")}>{i < step ? <Check className="size-4" /> : i + 1}</span>
              <span className="hidden sm:inline">{s}</span>
            </li>
          ))}
        </ol>

        <div className="min-h-[300px] flex-1 space-y-5 overflow-y-auto px-6 py-6">
          {!signedIn || !configured ? (
            <div className="space-y-3">
              <h3 className="text-lg font-bold">{!configured ? "Not available yet" : "Log in to connect an exchange"}</h3>
              <p className="text-sm text-muted-foreground">{!configured ? "Exchange connections aren’t set up on this site yet. You can still import a CSV." : "Your key is stored encrypted against your account, so you need to be logged in."}</p>
              {configured && <Link href="/login?next=/planner/app%3Ftab%3Dimport" className={primaryBtn}>Log in</Link>}
            </div>
          ) : step === 0 ? (
            <>
              <div>
                <h3 className="text-xl font-bold">Create a read-only key on {meta.name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">We’ll open {meta.name}’s API page in a new tab. Create the key there, then come back.</p>
              </div>
              <a href={meta.url} target="_blank" rel="noopener noreferrer" className={cn(primaryBtn, "flex w-full items-center justify-center gap-2")}>Open {meta.name} API page <ArrowUpRight className="size-4" /></a>
              <div className="space-y-4 rounded-2xl border bg-muted/40 p-4">
                <p className="text-sm font-medium text-muted-foreground">On {meta.name}, set the permissions like this</p>
                <div className="grid grid-cols-3 gap-2">
                  {([["Read", true], ["Trade", false], ["Withdraw", false]] as const).map(([p, on]) => (
                    <div key={p} className={cn("rounded-xl border p-3", on ? "border-up/40 bg-up/10" : "bg-card")}>
                      <p className="font-semibold">{p}</p>
                      <p className={cn("text-sm", on ? "text-up" : "text-muted-foreground")}>{on ? "ON" : "OFF"}</p>
                    </div>
                  ))}
                </div>
                <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
                  <li>Name it anything, e.g. “FinTalk planner”.</li>
                  {meta.passphrase && <li>Choose a passphrase and keep it. You’ll paste it in the next step.</li>}
                  {SERVER_IPS && <li>Optional: limit the key to our IP addresses.</li>}
                  {meta.note && <li>{meta.note}</li>}
                </ul>
                {SERVER_IPS && (
                  <div className="flex items-center justify-between gap-3 rounded-xl bg-card px-3 py-2.5">
                    <code className="break-all font-mono text-sm">{SERVER_IPS}</code>
                    <button type="button" className={secondaryBtn} onClick={() => { void navigator.clipboard.writeText(SERVER_IPS); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>{copied ? "Copied" : "Copy"}</button>
                  </div>
                )}
              </div>
            </>
          ) : step === 1 ? (
            <>
              <div>
                <h3 className="text-xl font-bold">Paste your key</h3>
                <p className="mt-1 text-sm text-muted-foreground">We check it can’t trade or withdraw (where {meta.name} lets us check), then store it encrypted. It’s never shown in the browser again.</p>
              </div>
              <label className="block space-y-1.5 text-sm font-medium">API key
                <input className={inputCls} value={key} onChange={(e) => setKey(e.target.value)} autoComplete="off" spellCheck={false} />
              </label>
              <label className="block space-y-1.5 text-sm font-medium">Secret key
                <input type="password" className={inputCls} value={secret} onChange={(e) => setSecret(e.target.value)} autoComplete="off" spellCheck={false} />
              </label>
              {meta.passphrase && (
                <label className="block space-y-1.5 text-sm font-medium">Passphrase
                  <input type="password" className={inputCls} value={pass} onChange={(e) => setPass(e.target.value)} autoComplete="off" />
                </label>
              )}
            </>
          ) : (
            <div className="grid min-h-[240px] place-items-center text-center">
              {state.phase === "working" ? (
                <div className="space-y-3"><Loader2 className="mx-auto size-8 animate-spin text-brand" /><p className="font-medium">Verifying the key and reading your closed trades…</p></div>
              ) : state.phase === "ok" ? (
                <div className="space-y-3"><span className="mx-auto grid size-12 place-items-center rounded-full bg-up text-white"><Check className="size-6" /></span><h3 className="text-xl font-bold">{meta.name} is connected</h3><p className="text-sm text-muted-foreground">{state.text} New trades sync automatically.</p></div>
              ) : (
                <div className="space-y-3"><span className="mx-auto grid size-12 place-items-center rounded-full bg-down text-white"><X className="size-6" /></span><h3 className="text-xl font-bold">Couldn’t connect</h3><p className="text-sm text-down">{state.text}</p></div>
              )}
            </div>
          )}
        </div>

        <footer className="flex items-center justify-between gap-3 border-t px-6 py-4">
          {step === 0 || step === 2 && state.phase === "ok" || !signedIn || !configured ? (
            <button type="button" onClick={() => ref.current?.close()} className="px-2 text-sm text-muted-foreground hover:text-foreground">{step === 2 && state.phase === "ok" ? "" : "Cancel"}</button>
          ) : (
            <button type="button" disabled={state.phase === "working" && step === 2} onClick={() => setStep(step - 1)} className="px-2 text-sm text-muted-foreground hover:text-foreground disabled:opacity-50">Back</button>
          )}
          {signedIn && configured && (step === 0 ? (
            <button type="button" className={primaryBtn} onClick={() => setStep(1)}>I’ve created my key</button>
          ) : step === 1 ? (
            <button type="button" className={primaryBtn} disabled={!ready} onClick={verify}>Verify and connect</button>
          ) : state.phase === "ok" ? (
            <button type="button" className={primaryBtn} onClick={() => ref.current?.close()}>Done</button>
          ) : null)}
        </footer>
      </div>
    </dialog>
  );
}
