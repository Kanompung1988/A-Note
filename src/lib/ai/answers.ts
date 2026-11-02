// Cheap, deterministic answer matching. Most generated keys are short ("x = 5", "550 baht"),
// so these comparisons settle them without a model call; anything else goes to the judge.

/** Lowercase, drop "x =" style prefixes, thousands separators, spaces and trailing punctuation. */
export function normalizeAnswer(answer: string): string {
  return answer
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[−–—]/g, "-")
    .replace(/(\d),(?=\d{3}\b)/g, "$1")
    .replace(/^\s*(the answer is|answer:?)\s*/, "")
    .replace(/^\s*[a-z]\s*=\s*/, "")
    .replace(/\s+/g, "")
    .replace(/[.。!]+$/, "");
}

/** The numbers in an answer, in order, as canonical strings ("1,250.0 baht" → ["1250"]). */
export function numbersIn(answer: string): string[] {
  const matches = normalizeAnswer(answer).match(/-?\d+(?:\.\d+)?(?:\/\d+)?/g) ?? [];
  return matches.map((m) => {
    if (m.includes("/")) {
      const [a, b] = m.split("/").map(Number);
      return b ? String(+(a / b).toFixed(6)) : m;
    }
    return String(+Number(m).toFixed(6));
  });
}

const UNITS = /baht|cm|mm|km|kg|ml|units?|degrees?|°c?|m|g|l|s/g;

/** Words left after units are removed mean the answer needs reading, not matching. */
function isWordy(normalized: string): boolean {
  return /[a-zก-๙]{4,}/.test(normalized.replace(UNITS, ""));
}

/**
 * true when two answers clearly agree, false when they clearly disagree, null when it takes judgement
 * (words, explanations, different forms).
 */
export function sameAnswer(a: string, b: string): boolean | null {
  const x = normalizeAnswer(a);
  const y = normalizeAnswer(b);
  if (!x || !y) return null;
  if (x === y) return true;
  const nx = numbersIn(a);
  const ny = numbersIn(b);
  const wordy = isWordy(x) || isWordy(y);
  if (nx.length && ny.length && !wordy) return nx.length === ny.length && nx.every((n, i) => n === ny[i]);
  return null;
}
