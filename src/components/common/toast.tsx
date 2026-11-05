"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { Info } from "lucide-react";

type Ctx = { show: (msg: string) => void; comingSoon: (feature?: string) => void };
const ToastCtx = createContext<Ctx>({ show: () => {}, comingSoon: () => {} });

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((m: string) => {
    setMsg(m);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setMsg(null), 2600);
  }, []);
  const comingSoon = useCallback(
    (feature?: string) => show(`${feature ?? "이 기능"}은(는) 개발 예정입니다 (Phase 2 이후 제공).`),
    [show],
  );

  return (
    <ToastCtx.Provider value={{ show, comingSoon }}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-20 z-[100] flex justify-center px-4 lg:bottom-6"
      >
        {msg && (
          <div className="pointer-events-auto flex max-w-md items-center gap-2 rounded-lg bg-foreground px-4 py-2.5 text-sm text-background shadow-lg">
            <Info className="size-4 shrink-0" />
            {msg}
          </div>
        )}
      </div>
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);
