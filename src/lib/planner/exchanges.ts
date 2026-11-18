/** Per-venue settings the planner applies when you change the exchange on a plan. Estimates for planning, not a quote. */
export type ExchangeId = "Mock" | "OKX" | "Binance" | "Bybit" | "Other";

export const EXCHANGE_CONFIG: Record<ExchangeId, { label: string; maxLeverage: number; takerFee: number; symbol: (base: string) => string; note: string }> = {
  Mock: { label: "FinTalk Mock Trading", maxLeverage: 150, takerFee: 0.0004, symbol: (b) => `${b}USDT`, note: "Virtual funds, 0.04% fee" },
  OKX: { label: "OKX", maxLeverage: 125, takerFee: 0.0005, symbol: (b) => `${b}-USDT-SWAP`, note: "Perpetual swap, ~0.05% taker fee" },
  Binance: { label: "Binance", maxLeverage: 125, takerFee: 0.0005, symbol: (b) => `${b}USDT`, note: "USDT-M futures, ~0.05% taker fee" },
  Bybit: { label: "Bybit", maxLeverage: 100, takerFee: 0.00055, symbol: (b) => `${b}USDT`, note: "Linear perpetual, ~0.055% taker fee" },
  Other: { label: "Other", maxLeverage: 100, takerFee: 0.0005, symbol: (b) => `${b}-USDT`, note: "Generic, ~0.05% taker fee" },
};

export const EXCHANGE_IDS = Object.keys(EXCHANGE_CONFIG) as ExchangeId[];
export const exchangeLabel = (id: string) => EXCHANGE_CONFIG[id as ExchangeId]?.label ?? id;
export const exchangeConfig = (id: string) => EXCHANGE_CONFIG[id as ExchangeId] ?? EXCHANGE_CONFIG.Other;
