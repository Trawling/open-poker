import type { Card } from "./types.js";

const RANK_VALUE: Record<string, number> = {
  "2": 2,
  "3": 3,
  "4": 4,
  "5": 5,
  "6": 6,
  "7": 7,
  "8": 8,
  "9": 9,
  T: 10,
  J: 11,
  Q: 12,
  K: 13,
  A: 14,
};

export const HAND_CATEGORY_NAMES = [
  "Старшая карта",
  "Пара",
  "Две пары",
  "Сет",
  "Стрит",
  "Флеш",
  "Фулл-хаус",
  "Каре",
  "Стрит-флеш",
] as const;

/**
 * Оценка ровно 5 карт. Результат — массив чисел для лексикографического
 * сравнения: [категория, кикеры...]. Чем больше массив при сравнении
 * слева направо — тем сильнее рука.
 */
export function evaluate5(cards: Card[]): number[] {
  if (cards.length !== 5) {
    throw new Error("evaluate5 ожидает ровно 5 карт");
  }
  const ranks = cards.map((c) => RANK_VALUE[c[0]]).sort((a, b) => b - a);
  const suits = cards.map((c) => c[1]);
  const isFlush = suits.every((s) => s === suits[0]);

  const counts = new Map<number, number>();
  for (const r of ranks) counts.set(r, (counts.get(r) ?? 0) + 1);
  const groups = [...counts.entries()]
    .map(([rank, count]) => ({ rank, count }))
    .sort((a, b) => b.count - a.count || b.rank - a.rank);

  const uniqueRanksDesc = [...new Set(ranks)];
  let isStraight = false;
  let straightHigh = 0;
  if (uniqueRanksDesc.length === 5) {
    if (uniqueRanksDesc[0] - uniqueRanksDesc[4] === 4) {
      isStraight = true;
      straightHigh = uniqueRanksDesc[0];
    } else if (uniqueRanksDesc.join(",") === "14,5,4,3,2") {
      // колёсный стрит A-2-3-4-5, туз считается младшей картой
      isStraight = true;
      straightHigh = 5;
    }
  }

  if (isStraight && isFlush) return [8, straightHigh];
  if (groups[0].count === 4) return [7, groups[0].rank, groups[1].rank];
  if (groups[0].count === 3 && groups[1].count === 2) {
    return [6, groups[0].rank, groups[1].rank];
  }
  if (isFlush) return [5, ...ranks];
  if (isStraight) return [4, straightHigh];
  if (groups[0].count === 3) {
    return [3, groups[0].rank, ...groups.slice(1).map((g) => g.rank)];
  }
  if (groups[0].count === 2 && groups[1].count === 2) {
    const pairRanks = [groups[0].rank, groups[1].rank].sort((a, b) => b - a);
    return [2, ...pairRanks, groups[2].rank];
  }
  if (groups[0].count === 2) {
    return [1, groups[0].rank, ...groups.slice(1).map((g) => g.rank)];
  }
  return [0, ...ranks];
}

function* combinations<T>(arr: T[], k: number): Generator<T[]> {
  const n = arr.length;
  if (k > n) return;
  const indices = Array.from({ length: k }, (_, i) => i);
  while (true) {
    yield indices.map((i) => arr[i]);
    let i = k - 1;
    while (i >= 0 && indices[i] === i + n - k) i -= 1;
    if (i < 0) return;
    indices[i] += 1;
    for (let j = i + 1; j < k; j++) indices[j] = indices[j - 1] + 1;
  }
}

export function compareHandScores(a: number[], b: number[]): number {
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const av = a[i] ?? 0;
    const bv = b[i] ?? 0;
    if (av !== bv) return av - bv;
  }
  return 0;
}

/** Лучшая рука из 7 карт (2 карманные + 5 общих). */
export function evaluate7(cards: Card[]): number[] {
  if (cards.length < 5) {
    throw new Error("evaluate7 ожидает минимум 5 карт");
  }
  let best: number[] | null = null;
  for (const combo of combinations(cards, 5)) {
    const score = evaluate5(combo);
    if (best === null || compareHandScores(score, best) > 0) {
      best = score;
    }
  }
  return best as number[];
}

export function describeHandScore(score: number[]): string {
  return HAND_CATEGORY_NAMES[score[0]] ?? "Неизвестно";
}
