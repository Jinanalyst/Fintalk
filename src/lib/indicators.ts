/** 차트 보조지표 계산. 입력과 같은 길이의 배열을 돌려주며, 값이 아직 정해지지 않은 구간은 null 입니다. */

export type Candle = { time: number; open: number; high: number; low: number; close: number; volume: number };
export type Series = (number | null)[];

export function sma(values: number[], period: number): Series {
  const out: Series = new Array(values.length).fill(null);
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}

export function ema(values: number[], period: number): Series {
  const out: Series = new Array(values.length).fill(null);
  if (values.length < period) return out;
  const k = 2 / (period + 1);
  let prev = values.slice(0, period).reduce((a, b) => a + b, 0) / period; // 첫 값은 단순평균으로 시작
  out[period - 1] = prev;
  for (let i = period; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
}

/** 볼린저 밴드: 중심선(SMA) ± 표준편차 × mult */
export function bollinger(values: number[], period = 20, mult = 2) {
  const mid = sma(values, period);
  const upper: Series = new Array(values.length).fill(null);
  const lower: Series = new Array(values.length).fill(null);
  for (let i = period - 1; i < values.length; i++) {
    const m = mid[i] as number;
    let v = 0;
    for (let j = i - period + 1; j <= i; j++) v += (values[j] - m) ** 2;
    const sd = Math.sqrt(v / period);
    upper[i] = m + mult * sd;
    lower[i] = m - mult * sd;
  }
  return { mid, upper, lower };
}

/** RSI (Wilder 방식) */
export function rsi(values: number[], period = 14): Series {
  const out: Series = new Array(values.length).fill(null);
  if (values.length <= period) return out;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i++) {
    const d = values[i] - values[i - 1];
    if (d >= 0) gain += d;
    else loss -= d;
  }
  gain /= period;
  loss /= period;
  const val = () => (loss === 0 ? 100 : 100 - 100 / (1 + gain / loss));
  out[period] = val();
  for (let i = period + 1; i < values.length; i++) {
    const d = values[i] - values[i - 1];
    gain = (gain * (period - 1) + Math.max(d, 0)) / period;
    loss = (loss * (period - 1) + Math.max(-d, 0)) / period;
    out[i] = val();
  }
  return out;
}

/** MACD(12, 26, 9): MACD 선, 시그널 선, 히스토그램 */
export function macd(values: number[], fast = 12, slow = 26, signalPeriod = 9) {
  const f = ema(values, fast);
  const s = ema(values, slow);
  const line: Series = values.map((_, i) => (f[i] !== null && s[i] !== null ? (f[i] as number) - (s[i] as number) : null));
  const start = line.findIndex((v) => v !== null);
  const signal: Series = new Array(values.length).fill(null);
  if (start >= 0) {
    const sig = ema(line.slice(start) as number[], signalPeriod);
    sig.forEach((v, i) => (signal[start + i] = v));
  }
  const hist: Series = line.map((v, i) => (v !== null && signal[i] !== null ? v - (signal[i] as number) : null));
  return { line, signal, hist };
}

/** 하이킨아시 캔들 */
export function heikinAshi(candles: Candle[]): Candle[] {
  const out: Candle[] = [];
  candles.forEach((c, i) => {
    const close = (c.open + c.high + c.low + c.close) / 4;
    const open = i === 0 ? (c.open + c.close) / 2 : (out[i - 1].open + out[i - 1].close) / 2;
    out.push({ time: c.time, open, close, high: Math.max(c.high, open, close), low: Math.min(c.low, open, close), volume: c.volume });
  });
  return out;
}

/** 지표 설정 (기간 등). 차트의 설정 창에서 바꿉니다. */
export type MaLine = { period: number; on: boolean };
export type IndCfg = {
  ma: MaLine[];
  ema: MaLine[];
  boll: { period: number; mult: number };
  rsi: { period: number };
  macd: { fast: number; slow: number; signal: number };
  /** 지표별 선 색 (키: ma0~2, ema0~2, bollBand, bollMid, rsi, macd, macdSig) */
  colors: Record<string, string>;
  /** 지표별 점선 여부 (colors 와 같은 키) */
  dashed: Record<string, boolean>;
  /** 캔들 색 (빈 문자열이면 사이트 기본 상승/하락 색) */
  candle: { up: string; down: string };
};

export const MA_COLORS = ["#f0b90b", "#a855f7", "#14b8a6"];
export const EMA_COLORS = ["#3b82f6", "#f97316", "#ec4899"];

export const DEFAULT_COLORS: Record<string, string> = {
  ma0: MA_COLORS[0], ma1: MA_COLORS[1], ma2: MA_COLORS[2],
  ema0: EMA_COLORS[0], ema1: EMA_COLORS[1], ema2: EMA_COLORS[2],
  bollBand: "#60a5fa", bollMid: "#9ca3af", rsi: "#a855f7", macd: "#3b82f6", macdSig: "#f97316",
};

export const DEFAULT_DASHED: Record<string, boolean> = {
  ma0: false, ma1: false, ma2: false, ema0: false, ema1: false, ema2: false,
  bollBand: true, bollMid: false, rsi: false, macd: false, macdSig: false,
};

export const DEFAULT_CFG: IndCfg = {
  ma: [
    { period: 20, on: true },
    { period: 60, on: true },
    { period: 120, on: false },
  ],
  ema: [
    { period: 12, on: true },
    { period: 26, on: true },
    { period: 50, on: false },
  ],
  boll: { period: 20, mult: 2 },
  rsi: { period: 14 },
  macd: { fast: 12, slow: 26, signal: 9 },
  colors: { ...DEFAULT_COLORS },
  dashed: { ...DEFAULT_DASHED },
  candle: { up: "", down: "" },
};

const num = (v: unknown, fallback: number, min: number, max: number) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= min && n <= max ? n : fallback;
};

/** 저장된 값이 깨졌거나 범위를 벗어나도 안전하게 기본값으로 되돌립니다. */
export function mergeCfg(raw: unknown): IndCfg {
  const r = (raw ?? {}) as Partial<Record<keyof IndCfg, unknown>>;
  const lines = (src: unknown, def: MaLine[]): MaLine[] =>
    def.map((d, i) => {
      const x = (Array.isArray(src) ? src[i] : undefined) as Partial<MaLine> | undefined;
      return { period: Math.trunc(num(x?.period, d.period, 1, 500)), on: typeof x?.on === "boolean" ? x.on : d.on };
    });
  const b = (r.boll ?? {}) as Record<string, unknown>;
  const rs = (r.rsi ?? {}) as Record<string, unknown>;
  const m = (r.macd ?? {}) as Record<string, unknown>;
  const fast = Math.trunc(num(m.fast, 12, 1, 200));
  const slow = Math.trunc(num(m.slow, 26, 2, 400));
  const rc = (r.colors ?? {}) as Record<string, unknown>;
  const colors: Record<string, string> = {};
  for (const k of Object.keys(DEFAULT_COLORS)) colors[k] = typeof rc[k] === "string" && /^#[0-9a-fA-F]{6}$/.test(rc[k] as string) ? (rc[k] as string) : DEFAULT_COLORS[k];
  const rd = (r.dashed ?? {}) as Record<string, unknown>;
  const dashed: Record<string, boolean> = {};
  for (const k of Object.keys(DEFAULT_DASHED)) dashed[k] = typeof rd[k] === "boolean" ? (rd[k] as boolean) : DEFAULT_DASHED[k];
  const rcd = (r.candle ?? {}) as Record<string, unknown>;
  const hex = (v: unknown) => (typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v) ? v : "");
  return {
    colors,
    dashed,
    candle: { up: hex(rcd.up), down: hex(rcd.down) },
    ma: lines(r.ma, DEFAULT_CFG.ma),
    ema: lines(r.ema, DEFAULT_CFG.ema),
    boll: { period: Math.trunc(num(b.period, 20, 2, 500)), mult: num(b.mult, 2, 0.1, 10) },
    rsi: { period: Math.trunc(num(rs.period, 14, 2, 200)) },
    macd: fast < slow ? { fast, slow, signal: Math.trunc(num(m.signal, 9, 1, 200)) } : { ...DEFAULT_CFG.macd },
  };
}

export type Calc = {
  ma: Series[];
  ema: Series[];
  bbMid: Series;
  bbUp: Series;
  bbLow: Series;
  rsi: Series;
  macd: Series;
  macdSignal: Series;
  macdHist: Series;
};

export function calcAll(candles: Candle[], cfg: IndCfg): Calc {
  const closes = candles.map((c) => c.close);
  const bb = bollinger(closes, cfg.boll.period, cfg.boll.mult);
  const m = macd(closes, cfg.macd.fast, cfg.macd.slow, cfg.macd.signal);
  return {
    ma: cfg.ma.map((l) => (l.on ? sma(closes, l.period) : [])),
    ema: cfg.ema.map((l) => (l.on ? ema(closes, l.period) : [])),
    bbMid: bb.mid,
    bbUp: bb.upper,
    bbLow: bb.lower,
    rsi: rsi(closes, cfg.rsi.period),
    macd: m.line,
    macdSignal: m.signal,
    macdHist: m.hist,
  };
}
