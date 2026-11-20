import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from "node:crypto";

/**
 * Read-only exchange access for the planner. Server-only: keys are encrypted at rest (AES-256-GCM) and never
 * sent to the browser. Each adapter first verifies the key can't trade or withdraw, then reads closed positions.
 */
export const API_EXCHANGES = ["OKX", "Binance", "Bybit", "Bitget"] as const;
export type ApiExchange = (typeof API_EXCHANGES)[number];

export type Creds = { key: string; secret: string; passphrase?: string };

/** A closed position, normalized across exchanges. Times are epoch ms. */
export type ClosedPosition = {
  id: string; sym: string; dir: "long" | "short"; entry: number; exit: number; pnl: number; fee: number;
  leverage?: number; qty?: number; openedAt: number; closedAt: number;
};

export class ExchangeError extends Error {}

// ---------- encryption ----------
function secretKey() {
  const k = process.env.PLANNER_ENCRYPTION_KEY;
  if (!k) throw new ExchangeError("Exchange connections aren’t configured yet. Please contact us.");
  return createHash("sha256").update(k).digest();
}
export function encrypt(c: Creds): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", secretKey(), iv);
  const ct = Buffer.concat([cipher.update(JSON.stringify(c), "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), ct].map((b) => b.toString("base64")).join(".");
}
export function decrypt(payload: string): Creds {
  const [iv, tag, ct] = payload.split(".").map((p) => Buffer.from(p, "base64"));
  const d = createDecipheriv("aes-256-gcm", secretKey(), iv);
  d.setAuthTag(tag);
  return JSON.parse(Buffer.concat([d.update(ct), d.final()]).toString("utf8")) as Creds;
}

// ---------- http ----------
const hmac = (algo: "hex" | "base64", secret: string, msg: string) => createHmac("sha256", secret).update(msg).digest(algo);

async function call(url: string, headers: Record<string, string>): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(url, { headers, cache: "no-store", signal: AbortSignal.timeout(15_000) });
  } catch {
    throw new ExchangeError("Couldn’t reach the exchange. Try again in a moment.");
  }
  const body = (await res.json().catch(() => null)) as unknown;
  if (!res.ok && !body) throw new ExchangeError(`The exchange returned an error (${res.status}).`);
  return body;
}
const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const DAYS = 90 * 86_400_000;

// ---------- OKX ----------
async function okx(c: Creds, path: string) {
  const ts = new Date().toISOString();
  const body = (await call("https://www.okx.com" + path, {
    "OK-ACCESS-KEY": c.key, "OK-ACCESS-SIGN": hmac("base64", c.secret, ts + "GET" + path), "OK-ACCESS-TIMESTAMP": ts, "OK-ACCESS-PASSPHRASE": c.passphrase ?? "",
  })) as { code?: string; msg?: string; data?: Record<string, string>[] } | null;
  if (!body || body.code !== "0") throw new ExchangeError(body?.msg ? `OKX: ${body.msg}` : "OKX rejected the key. Check the key, secret and passphrase.");
  return body.data ?? [];
}

// ---------- Binance (USDⓈ-M futures) ----------
async function binance(c: Creds, base: string, path: string, params: Record<string, string | number> = {}) {
  const q = new URLSearchParams({ ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])), timestamp: String(Date.now()), recvWindow: "10000" }).toString();
  const body = (await call(`${base}${path}?${q}&signature=${hmac("hex", c.secret, q)}`, { "X-MBX-APIKEY": c.key })) as { code?: number; msg?: string } | unknown[] | null;
  if (body && !Array.isArray(body) && typeof body.code === "number" && body.code < 0) throw new ExchangeError(`Binance: ${body.msg ?? "key rejected"}`);
  return body as unknown;
}

// ---------- Bybit v5 ----------
async function bybit(c: Creds, path: string, query: string) {
  const ts = String(Date.now());
  const sign = hmac("hex", c.secret, ts + c.key + "5000" + query);
  const body = (await call(`https://api.bybit.com${path}?${query}`, { "X-BAPI-API-KEY": c.key, "X-BAPI-TIMESTAMP": ts, "X-BAPI-RECV-WINDOW": "5000", "X-BAPI-SIGN": sign })) as { retCode?: number; retMsg?: string; result?: Record<string, unknown> } | null;
  if (!body || body.retCode !== 0) throw new ExchangeError(body?.retMsg ? `Bybit: ${body.retMsg}` : "Bybit rejected the key.");
  return body.result ?? {};
}

// ---------- Bitget ----------
async function bitget(c: Creds, path: string, query: string) {
  const ts = String(Date.now());
  const body = (await call(`https://api.bitget.com${path}?${query}`, {
    "ACCESS-KEY": c.key, "ACCESS-SIGN": hmac("base64", c.secret, `${ts}GET${path}?${query}`), "ACCESS-TIMESTAMP": ts, "ACCESS-PASSPHRASE": c.passphrase ?? "", "Content-Type": "application/json",
  })) as { code?: string; msg?: string; data?: unknown } | null;
  if (!body || body.code !== "00000") throw new ExchangeError(body?.msg ? `Bitget: ${body.msg}` : "Bitget rejected the key. Check the key, secret and passphrase.");
  return body.data;
}

/** Throws unless the key is safe (read-only where the exchange lets us check) and valid. */
export async function verify(ex: ApiExchange, c: Creds): Promise<void> {
  if (ex === "OKX") {
    const [cfg] = await okx(c, "/api/v5/account/config");
    const perm = String(cfg?.perm ?? "");
    if (!perm) throw new ExchangeError("Couldn’t read this key’s permissions.");
    if (perm !== "read_only") throw new ExchangeError("This key can trade or withdraw. Create a new key with Read only permission.");
  } else if (ex === "Bybit") {
    const r = (await bybit(c, "/v5/user/query-api", "")) as { readOnly?: number };
    if (r.readOnly !== 1) throw new ExchangeError("This key can trade or withdraw. Create a new key with Read-only permission.");
  } else if (ex === "Binance") {
    const r = (await binance(c, "https://api.binance.com", "/sapi/v1/account/apiRestrictions")) as Record<string, boolean>;
    if (r.enableWithdrawals || r.enableSpotAndMarginTrading || r.enableInternalTransfer || r.permitsUniversalTransfer)
      throw new ExchangeError("This key can withdraw, transfer or trade spot. Turn those off and keep only Enable Reading (plus Futures, which Binance requires to read futures history).");
    if (!r.enableReading) throw new ExchangeError("Turn on “Enable Reading” for this key.");
  } else {
    // Bitget has no endpoint that reports key permissions, so the read below proves the key works; read-only is up to the user.
    await bitget(c, "/api/v2/mix/position/history-position", "productType=USDT-FUTURES&limit=1");
  }
}

/** Closed positions from the last 90 days, newest first. */
export async function fetchClosed(ex: ApiExchange, c: Creds): Promise<ClosedPosition[]> {
  const since = Date.now() - DAYS;
  if (ex === "OKX") {
    const rows = await okx(c, "/api/v5/account/positions-history?limit=100");
    return rows.map((r) => ({
      id: `${r.posId}-${r.uTime}`, sym: String(r.instId).replace(/-SWAP$|-\d{6}$/, ""), dir: r.direction === "short" ? "short" : "long",
      entry: num(r.openAvgPx), exit: num(r.closeAvgPx), pnl: num(r.realizedPnl || r.pnl), fee: Math.abs(num(r.fee)),
      leverage: num(r.lever) || undefined, qty: num(r.closeTotalPos) || undefined, openedAt: num(r.cTime), closedAt: num(r.uTime),
    } as ClosedPosition)).filter((t) => t.closedAt >= since);
  }
  if (ex === "Bybit") {
    // Bybit caps each request at a 7-day window (only startTime → startTime..startTime+7d), so walk back week by week.
    const WEEK = 7 * 86_400_000;
    const list: Record<string, string>[] = [];
    for (let end = Date.now(); end > since; end -= WEEK) {
      const start = Math.max(since, end - WEEK);
      let cursor = "";
      for (let page = 0; page < 10; page++) {
        const q = `category=linear&endTime=${end}&limit=100&startTime=${start}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`;
        const r = (await bybit(c, "/v5/position/closed-pnl", q)) as { list?: Record<string, string>[]; nextPageCursor?: string };
        list.push(...(r.list ?? []));
        cursor = r.nextPageCursor ?? "";
        if (!cursor || !r.list?.length) break;
      }
    }
    const seen = new Set<string>();
    return list.filter((x) => !seen.has(x.orderId) && seen.add(x.orderId)).map((x) => ({
      id: `${x.orderId}`, sym: x.symbol.replace(/USDT$/, "-USDT"), dir: x.side === "Sell" ? "long" : "short", // side is the closing order's side
      entry: num(x.avgEntryPrice), exit: num(x.avgExitPrice), pnl: num(x.closedPnl), fee: Math.abs(num(x.openFee)) + Math.abs(num(x.closeFee)),
      leverage: num(x.leverage) || undefined, qty: num(x.qty) || undefined, openedAt: num(x.createdTime), closedAt: num(x.updatedTime),
    } as ClosedPosition));
  }
  if (ex === "Bitget") {
    const d = (await bitget(c, "/api/v2/mix/position/history-position", `productType=USDT-FUTURES&limit=100&startTime=${since}`)) as { list?: Record<string, string>[] } | undefined;
    return (d?.list ?? []).map((x) => ({
      id: `${x.positionId}`, sym: x.symbol.replace(/USDT$/, "-USDT"), dir: x.holdSide === "short" ? "short" : "long",
      entry: num(x.openAvgPrice), exit: num(x.closeAvgPrice), pnl: num(x.netProfit ?? x.pnl), fee: Math.abs(num(x.openFee)) + Math.abs(num(x.closeFee)),
      openedAt: num(x.ctime), closedAt: num(x.utime),
    } as ClosedPosition));
  }
  // Binance: realized P&L income events. Binance doesn't say which side was closed here, so direction is unknown.
  const inc = (await binance(c, "https://fapi.binance.com", "/fapi/v1/income", { incomeType: "REALIZED_PNL", startTime: since, limit: 1000 })) as Record<string, string>[];
  return (Array.isArray(inc) ? inc : []).map((x) => ({
    id: `${x.tradeId || x.time}-${x.symbol}`, sym: x.symbol.replace(/USDT$/, "-USDT"), dir: "long" as const,
    entry: 0, exit: 0, pnl: num(x.income), fee: 0, openedAt: num(x.time), closedAt: num(x.time),
  }));
}
