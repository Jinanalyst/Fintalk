/**
 * Database functions (see supabase/migrations) raise their user-facing errors in Korean.
 * The site is English-only, so translate the known messages here. Unknown messages fall back to a generic text.
 * (Keep this in sync when adding new `raise exception '...'` messages in SQL.)
 */
const EXACT: [string, string][] = [
  ["가격이 올바르지 않습니다.", "Invalid price."],
  ["거래 기록을 찾을 수 없습니다.", "Trade record not found."],
  ["게시글은 1시간에 10개까지 작성할 수 있습니다.", "You can publish up to 10 posts per hour."],
  ["내 게시글만 연결할 수 있습니다.", "You can only attach your own post."],
  ["너무 빠르게 보내고 있습니다. 잠시 후 다시 시도해 주세요.", "You are sending messages too fast. Please try again shortly."],
  ["댓글은 1시간에 60개까지 작성할 수 있습니다.", "You can post up to 60 comments per hour."],
  ["레버리지는 1~150배입니다.", "Leverage must be between 1x and 150x."],
  ["레버리지는 1~50배입니다.", "Leverage must be between 1x and 50x."],
  ["로그인이 필요합니다.", "Login required."],
  ["롱 손절가는 진입가보다 낮아야 합니다.", "A long stop loss must be below the entry price."],
  ["롱 손절가는 현재가보다 낮아야 합니다. (진입가 위로는 올릴 수 있어요)", "A long stop loss must be below the current price (it can be above your entry price)."],
  ["롱 익절가는 진입가보다 높아야 합니다.", "A long take profit must be above the entry price."],
  ["롱 익절가는 현재가보다 높아야 합니다.", "A long take profit must be above the current price."],
  ["마진 모드가 올바르지 않습니다.", "Invalid margin mode."],
  ["메시지는 300자까지 보낼 수 있습니다.", "Messages can be up to 300 characters."],
  ["메시지를 입력해 주세요.", "Enter a message."],
  ["방향이 올바르지 않습니다.", "Invalid side."],
  ["숏 손절가는 진입가보다 높아야 합니다.", "A short stop loss must be above the entry price."],
  ["숏 손절가는 현재가보다 높아야 합니다. (진입가 아래로는 내릴 수 있어요)", "A short stop loss must be above the current price (it can be below your entry price)."],
  ["숏 익절가는 진입가보다 낮아야 합니다.", "A short take profit must be below the entry price."],
  ["숏 익절가는 현재가보다 낮아야 합니다.", "A short take profit must be below the current price."],
  ["시세가 갱신되지 않았습니다. 잠시 후 다시 시도해 주세요.", "Prices have not updated yet. Please try again shortly."],
  ["시세가 없습니다.", "No price available."],
  ["이미 모든 포지션에 청산 주문이 걸려 있습니다. 기존 청산 주문을 먼저 취소해 주세요.", "Every position already has a close order. Cancel an existing close order first."],
  ["이용이 제한된 계정입니다.", "Your account is restricted."],
  ["주문 규모가 너무 큽니다.", "The order size is too large."],
  ["주문 규모는 최소 10 USDT 입니다.", "The minimum order size is 10 USDT."],
  ["주문 규모를 입력해 주세요.", "Enter an order size."],
  ["지정가 청산 수량이 포지션 수량을 넘습니다. 기존 청산 주문을 먼저 취소해 주세요.", "The limit close size exceeds the position size. Cancel an existing close order first."],
  ["지정가 청산 주문은 포지션당 10개까지 가능합니다.", "You can place up to 10 limit close orders per position."],
  ["지정가가 현재가와 겹칩니다. 시장가로 주문하거나 가격을 조정해 주세요.", "The limit price crosses the current price. Use a market order or adjust the price."],
  ["질문 작성자만 답변을 채택할 수 있습니다.", "Only the question author can accept an answer."],
  ["채택할 수 없는 답변입니다. (본인 댓글은 채택할 수 없습니다)", "This answer cannot be accepted (you cannot accept your own comment)."],
  ["취소할 수 있는 주문이 아닙니다.", "This order cannot be cancelled."],
  ["포지션과 미체결 주문은 합쳐서 30개까지 가능합니다.", "Positions and open orders are limited to 30 in total."],
  ["포지션을 찾을 수 없습니다.", "Position not found."],
  ["프로필을 찾을 수 없습니다.", "Profile not found."],
];

const PATTERNS: [RegExp, (m: RegExpMatchArray) => string][] = [
  [/잔고가 부족합니다\. \(필요 ([\d.,]+) USDT\)/, (m) => `Insufficient balance (${m[1]} USDT required).`],
  [/청산 비율은 1~100%+ 입니다\./, () => "Close percentage must be between 1 and 100."],
  [/리듀스 온리 지정가는 현재가보다 (\S+) 가격이어야 합니다/, (m) => `A reduce-only limit price must be ${/높/.test(m[1]) ? "above" : "below"} the current price. Use market to reduce immediately.`],
  [/줄일 (\S+) 포지션이 없습니다/, (m) => `There is no ${/롱|long/i.test(m[1]) ? "long" : "short"} position to reduce. Reduce-only can only reduce the opposite side.`],
  [/이 종목에 (\S+) 마진 모드의 포지션\/주문이 있어/, (m) => `You have ${/교차|cross/i.test(m[1]) ? "cross" : "isolated"} margin positions or orders on this symbol, so the margin mode cannot be changed.`],
  [/지정가 청산은 (\S+)가 현재가보다 (\S+)야 합니다/, (m) => `For a limit close, the price must be ${/높/.test(m[2]) ? "above" : "below"} the current price. Use market to close immediately.`],
];

export const GENERIC_DB_ERROR = "Could not process the request.";

/** Returns an English message for a database error text, or null when it is not a known message. */
export function translateDbMessage(raw: string): string | null {
  const text = raw.trim();
  for (const [ko, en] of EXACT) if (text.includes(ko)) return en;
  for (const [re, fn] of PATTERNS) {
    const m = text.match(re);
    if (m) return fn(m);
  }
  return /[가-힣]/.test(text) ? null : text; // already English
}
