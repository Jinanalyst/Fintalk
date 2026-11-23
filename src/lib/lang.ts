/** Hangul syllables / jamo. Used to keep Korean posts out of the English contest pages (they stay in Community). */
const HANGUL = /[ᄀ-ᇿ㄰-㆏가-힯]/;

export const hasKorean = (text: string | null | undefined) => !!text && HANGUL.test(text);

/** True when the post's title or preview text contains Korean. */
export const isKoreanPost = (p: { title: string; body: string[] }) => hasKorean(p.title) || hasKorean(p.body[0]);
