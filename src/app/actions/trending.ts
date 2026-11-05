"use server";

import { getTrendingTickers, type TrendingTicker } from "@/lib/data/trending";

export async function getTrendingAction(limit = 6): Promise<TrendingTicker[]> {
  return (await getTrendingTickers(Math.min(Math.max(limit, 1), 10))).items;
}
