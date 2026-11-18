"use client";

import { useEffect, useState } from "react";
import { usePriceFeed } from "@/components/trade/use-price-feed";
import { isSymbol } from "@/lib/trade";

/**
 * Live prices for the planner, from the same Binance futures stream the mock-trading terminal uses
 * (all symbols once a second, plus tick-by-tick for the selected pair). If the stream is blocked,
 * the selected pair falls back to polling Binance's public REST price every 5 seconds.
 */
export function useLivePrices(pair: string) {
  const valid = isSymbol(pair);
  const { prices, live } = usePriceFeed({}, valid ? pair : "BTCUSDT");
  const [rest, setRest] = useState<{ pair: string; price: number } | null>(null);

  useEffect(() => {
    if (live || !valid) return;
    let alive = true;
    const poll = async () => {
      try {
        const res = await fetch(`https://data-api.binance.vision/api/v3/ticker/price?symbol=${pair}`, { cache: "no-store" });
        const j = (await res.json()) as { price?: string };
        const p = Number(j.price);
        if (alive && p > 0) setRest({ pair, price: p });
      } catch {
        /* keep the last price */
      }
    };
    poll();
    const t = setInterval(poll, 5000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [live, valid, pair]);

  const price = valid ? prices[pair] ?? (rest?.pair === pair ? rest.price : undefined) : undefined;
  return { prices, price, live, valid };
}
