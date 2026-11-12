/**
 * Anti-reuse rule for couple names after payment (design §1).
 *
 * Names are compared word by word against the paid value:
 * - each matched word may differ by at most floor(word length / 4) edits, so words of
 *   3 letters or fewer must match exactly ("Ana" -> "Eva" is rejected);
 * - at most one word may be added or removed in total ("María" -> "María José" is allowed),
 *   which also means replacing a word (one removed + one added) is rejected;
 * - support can unlock the names manually.
 */
export interface LockedNameChange {
  paid: string;
  next: string;
  unlocked: boolean;
}

const MAX_ADDED_OR_REMOVED_WORDS = 1;

export function canChangeLockedName({ paid, next, unlocked }: LockedNameChange): boolean {
  if (unlocked) return true;

  const paidWords = toWords(paid);
  const nextWords = toWords(next);
  const used = new Set<number>();
  let matched = 0;

  for (const word of paidWords) {
    const tolerance = Math.floor(word.length / 4);
    const index = nextWords.findIndex(
      (candidate, i) => !used.has(i) && levenshtein(word, candidate) <= tolerance,
    );
    if (index !== -1) {
      used.add(index);
      matched += 1;
    }
  }

  const removed = paidWords.length - matched;
  const added = nextWords.length - matched;
  return matched > 0 && removed + added <= MAX_ADDED_OR_REMOVED_WORDS;
}

function toWords(name: string): string[] {
  return name.toLocaleLowerCase("es-CL").trim().split(/\s+/).filter(Boolean);
}

function levenshtein(a: string, b: string): number {
  const left = [...a];
  const right = [...b];
  let previous = Array.from({ length: right.length + 1 }, (_, i) => i);

  for (let i = 1; i <= left.length; i++) {
    const current = [i];
    for (let j = 1; j <= right.length; j++) {
      const substitution = previous[j - 1] + (left[i - 1] === right[j - 1] ? 0 : 1);
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, substitution);
    }
    previous = current;
  }

  return previous[right.length];
}
