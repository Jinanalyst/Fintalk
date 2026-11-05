"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * 서버에서 가져온 데이터를 주기적으로 다시 불러옵니다. (탭이 보일 때만, 창으로 돌아오면 즉시 갱신)
 */
export function LiveRefresh({ seconds = 30 }: { seconds?: number }) {
  const router = useRouter();
  const [at, setAt] = useState<string>("");

  useEffect(() => {
    const stamp = () => setAt(new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    stamp();
    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      router.refresh();
      stamp();
    };
    const t = setInterval(refresh, seconds * 1000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [router, seconds]);

  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground" aria-live="off">
      <span className="relative flex size-2">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-up/60" />
        <span className="relative inline-flex size-2 rounded-full bg-up" />
      </span>
      실시간 · {seconds}초마다 갱신{at && ` · ${at}`}
    </span>
  );
}
