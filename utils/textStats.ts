/** Document statistics computed from plain text (blocks separated by "\n"). */

export interface TextStats {
  words: number;
  characters: number;
  charactersNoSpaces: number;
  paragraphs: number;
  sentences: number;
  /** Minutes at ~200 words per minute (0 for an empty document). */
  readingMinutes: number;
}

const OBJECT_CHAR = /￼/g;
const CJK = /[぀-ヿ㐀-䶿一-鿿豈-﫿가-힯]/g;

export const countWords = (text: string): number => {
  const clean = text.replace(OBJECT_CHAR, ' ');
  // CJK scripts don't separate words with spaces: count each character.
  const cjk = (clean.match(CJK) || []).length;
  const rest = clean.replace(CJK, ' ').trim();
  const latin = rest ? rest.split(/\s+/).filter(w => /[\p{L}\p{N}]/u.test(w)).length : 0;
  return latin + cjk;
};

export const countSentences = (text: string): number => {
  let count = 0;
  for (const para of text.split('\n')) {
    const trimmed = para.trim();
    if (!/[\p{L}\p{N}]/u.test(trimmed)) continue;
    // A sentence ends with . ! ? (or CJK equivalents) followed by space/end; a
    // paragraph without final punctuation still counts as one sentence.
    const parts = trimmed.split(/(?<=[.!?。！？…])["'”’)\]]*\s+|(?<=[。！？])/u);
    count += parts.filter(p => /[\p{L}\p{N}]/u.test(p)).length;
  }
  return count;
};

export const computeTextStats = (text: string, words?: number): TextStats => {
  const clean = (text || '').replace(OBJECT_CHAR, '');
  const w = typeof words === 'number' ? words : countWords(clean);
  return {
    words: w,
    characters: clean.replace(/\n/g, '').length,
    charactersNoSpaces: clean.replace(/\s/g, '').length,
    paragraphs: clean.split('\n').filter(p => p.trim().length > 0).length,
    sentences: countSentences(clean),
    readingMinutes: w === 0 ? 0 : Math.max(1, Math.ceil(w / 200)),
  };
};
