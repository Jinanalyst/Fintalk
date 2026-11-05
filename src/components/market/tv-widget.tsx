"use client";

import { useEffect, useRef } from "react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

type Kind = "advanced-chart" | "symbol-info";

const SRC: Record<Kind, string> = {
  "advanced-chart": "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js",
  "symbol-info": "https://s3.tradingview.com/external-embedding/embed-widget-symbol-info.js",
};

/**
 * TradingView 공식 임베드 위젯. 출처 표기(copyright 링크)는 TradingView 이용 조건상 항상 노출합니다.
 */
export function TradingViewWidget({ kind, symbol, className }: { kind: Kind; symbol: string; className?: string }) {
  const host = useRef<HTMLDivElement>(null);
  const { resolvedTheme } = useTheme();
  const theme = resolvedTheme === "dark" ? "dark" : "light";

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    el.replaceChildren();
    const widget = document.createElement("div");
    widget.className = cn("tradingview-widget-container__widget", kind === "advanced-chart" ? "absolute inset-0" : "w-full");
    el.appendChild(widget);
    const script = document.createElement("script");
    script.src = SRC[kind];
    script.async = true;
    script.text = JSON.stringify(
      kind === "advanced-chart"
        ? { autosize: true, symbol, interval: "D", timezone: "Asia/Seoul", theme, style: "1", locale: "kr", allow_symbol_change: false, support_host: "https://www.tradingview.com" }
        : { symbol, width: "100%", locale: "kr", colorTheme: theme, isTransparent: true },
    );
    el.appendChild(script);
    return () => el.replaceChildren();
  }, [kind, symbol, theme]);

  return (
    <div className={cn("tradingview-widget-container flex flex-col", className)}>
      <div ref={host} className={cn("relative min-h-0", kind === "advanced-chart" && "flex-1")} />
      <div className="tradingview-widget-copyright pt-1 text-[11px] text-muted-foreground">
        <a href={`https://kr.tradingview.com/symbols/${symbol.replace(":", "-")}/`} rel="noopener nofollow" target="_blank" className="underline">
          TradingView
        </a>
        에서 제공하는 {kind === "advanced-chart" ? "차트" : "시세"}
      </div>
    </div>
  );
}
