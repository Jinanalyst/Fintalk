"use client";

import { useEffect, useRef } from "react";
import { useTheme } from "next-themes";

/** TradingView 무료 Advanced Chart 위젯 (바이낸스 선물 무기한 계약 차트) */
export function TradingViewChart({ symbol }: { symbol: string }) {
  const box = useRef<HTMLDivElement>(null);
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    el.innerHTML = "";
    const widget = document.createElement("div");
    widget.className = "tradingview-widget-container__widget";
    widget.style.height = "100%";
    widget.style.width = "100%";
    el.appendChild(widget);

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: `BINANCE:${symbol}.P`,
      interval: "15",
      timezone: "Asia/Seoul",
      theme: resolvedTheme === "dark" ? "dark" : "light",
      style: "1",
      locale: "kr",
      allow_symbol_change: false,
      hide_side_toolbar: false,
      withdateranges: true,
      support_host: "https://www.tradingview.com",
    });
    el.appendChild(script);
    return () => {
      el.innerHTML = "";
    };
  }, [symbol, resolvedTheme]);

  return <div ref={box} className="tradingview-widget-container h-full w-full" />;
}
