"use client";

import { useState } from "react";
import { Check, Pencil, Plus, X } from "lucide-react";
import { planner, setupList, usePlanner } from "@/lib/planner/store";
import { cn } from "@/lib/utils";
import { Chip } from "./ui";

const inputCls = "h-9 w-32 rounded-full border bg-card px-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";

/** Setup chips with a + button to add your own, and an edit mode to rename or remove them. */
export function SetupPicker({ value, onChange }: { value: string; onChange: (s: string) => void }) {
  const list = setupList(usePlanner());
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");

  const add = () => {
    if (!draft.trim()) return setAdding(false);
    if (!planner.addSetup(draft)) return setError("That name is empty or already used.");
    onChange(draft.trim().slice(0, 24));
    setDraft("");
    setError("");
    setAdding(false);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">Setup</span>
        <button type="button" onClick={() => { setEditing((v) => !v); setAdding(false); setError(""); }} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          {editing ? <><Check className="size-3.5" /> Done</> : <><Pencil className="size-3.5" /> Edit</>}
        </button>
      </div>
      <div role="group" aria-label="Setup" className="flex flex-wrap items-center gap-2">
        {list.map((s) =>
          editing ? (
            <SetupEdit key={s} name={s} onRename={(to) => { if (!planner.renameSetup(s, to)) return setError("That name is empty or already used."); setError(""); if (value === s) onChange(to.trim().slice(0, 24)); }}
              onRemove={list.length > 1 ? () => { planner.removeSetup(s); if (value === s) onChange(list.find((x) => x !== s) ?? ""); } : undefined} />
          ) : (
            <Chip key={s} on={value === s} onClick={() => onChange(s)}>{s}</Chip>
          ),
        )}
        {!editing && !list.includes(value) && value && <Chip on onClick={() => {}}>{value}</Chip>}
        {adding ? (
          <input autoFocus aria-label="New setup name" maxLength={24} className={inputCls} placeholder="New setup" value={draft}
            onChange={(e) => { setDraft(e.target.value); setError(""); }} onBlur={add}
            onKeyDown={(e) => { if (e.key === "Enter") add(); if (e.key === "Escape") { setDraft(""); setAdding(false); } }} />
        ) : (
          <button type="button" aria-label="Add setup" title="Add your own setup" onClick={() => { setAdding(true); setEditing(false); }}
            className={cn("grid size-9 place-items-center rounded-full border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground")}>
            <Plus className="size-4" />
          </button>
        )}
      </div>
      {error && <p role="alert" className="text-xs text-down">{error}</p>}
      {editing && <p className="text-xs text-muted-foreground">Rename a setup and your past trades follow it. Removing one keeps the label on old trades.</p>}
    </div>
  );
}

function SetupEdit({ name, onRename, onRemove }: { name: string; onRename: (to: string) => void; onRemove?: () => void }) {
  const [v, setV] = useState(name);
  return (
    <span className="inline-flex items-center gap-1">
      <input aria-label={`Rename ${name}`} maxLength={24} className={inputCls} value={v} onChange={(e) => setV(e.target.value)}
        onBlur={() => v.trim() !== name && onRename(v)} onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()} />
      {onRemove && (
        <button type="button" aria-label={`Remove ${name}`} onClick={onRemove} className="grid size-6 place-items-center rounded-full text-muted-foreground hover:text-down">
          <X className="size-3.5" />
        </button>
      )}
    </span>
  );
}
