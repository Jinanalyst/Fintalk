"use client";

import { useEffect, useRef } from "react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

type Item = { tv: string; label: string };
type Props = { className?: string } & (
  | { kind: "advanced-chart"; symbol: string }
  | { kind: "symbol-info"; symbol: string }
  | { kind: "ticker-tape"; items: Item[]; title?: string }
  | { kind: "market-quotes"; items: Item[]; title?: string }
);

const FILE = {
  "advanced-chart": "advanced-chart",
  "symbol-info": "symbol-info",
  "ticker-tape": "ticker-tape",
  "market-quotes": "market-quotes",
} as const;

function config(p: Props, theme: string, height: number) {
  const base = { locale: "kr", colorTheme: theme, isTransparent: true };
  switch (p.kind) {
    case "advanced-chart":
      return { autosize: true, symbol: p.symbol, interval: "D", timezone: "Asia/Seoul", theme, style: "1", locale: "kr", allow_symbol_change: false, support_host: "https://www.tradingview.com" };
    case "symbol-info":
      return { ...base, symbol: p.symbol, width: "100%" };
    case "ticker-tape":
      return { ...base, symbols: p.items.map((i) => ({ proName: i.tv, title: i.label })), showSymbolLogo: false, displayMode: "adaptive" };
    case "market-quotes":
      return { ...base, width: "100%", height, showSymbolLogo: false, symbolsGroups: [{ name: p.title ?? "시세", symbols: p.items.map((i) => ({ name: i.tv, displayName: i.label })) }] };
  }
}

/**
 * TradingView 공식 임베드 위젯. 데이터는 TradingView 가 직접 제공하며 우리 서버는 저장하지 않습니다.
 * 출처 표기(copyright 링크)는 TradingView 이용 조건상 항상 노출합니다.
 */
export function TradingViewWidget(props: Props) {
  const { kind, className } = props;
  const host = useRef<HTMLDivElement>(null);
  const { resolvedTheme } = useTheme();
  const theme = resolvedTheme === "dark" ? "dark" : "light";
  const dep = kind === "advanced-chart" || kind === "symbol-info" ? props.symbol : props.items.map((i) => i.tv).join(",");
  const fill = kind === "advanced-chart";

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    el.replaceChildren();
    const widget = document.createElement("div");
    widget.className = cn("tradingview-widget-container__widget", fill ? "absolute inset-0" : "w-full");
    el.appendChild(widget);
    const script = document.createElement("script");
    script.src = `https://s3.tradingview.com/external-embedding/embed-widget-${FILE[kind]}.js`;
    script.async = true;
    script.text = JSON.stringify(config(props, theme, el.clientHeight || 400));
    el.appendChild(script);
    return () => el.replaceChildren();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, dep, theme]);

  const link =
    kind === "advanced-chart" || kind === "symbol-info"
      ? `https://kr.tradingview.com/symbols/${props.symbol.replace(":", "-")}/`
      : "https://kr.tradingview.com/markets/";
  return (
    <div className={cn("tradingview-widget-container flex flex-col", className)}>
      <div ref={host} className={cn("relative min-h-0", (fill || kind === "market-quotes") && "flex-1")} />
      <div className="tradingview-widget-copyright pt-1 text-[11px] text-muted-foreground">
        <a href={link} rel="noopener nofollow" target="_blank" className="underline">
          TradingView
        </a>
        에서 제공하는 {kind === "advanced-chart" ? "차트" : "시세"}
      </div>
    </div>
  );
}
