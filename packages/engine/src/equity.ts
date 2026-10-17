import { createDeck } from "./deck.js";
import { compareHandScores, evaluate7 } from "./handEvaluator.js";
import type { Card } from "./types.js";

/**
 * Быстрая нешифрованная тасовка для внутренних симуляций (оценка силы руки
 * бота). В отличие от shuffleDeck в deck.ts, здесь НЕ нужна проверяемая
 * честность — это просто вспомогательный ГПСЧ для Монте-Карло оценки,
 * никогда не используется для реальной раздачи карт игрокам.
 */
function shuffleForSimulation(deck: Card[]): Card[] {
  const result = [...deck];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export interface EquityParams {
  holeCards: Card[];
  communityCards: Card[];
  /** Сколько ещё игроков претендуют на банк (карты неизвестны, разыгрываются случайно). */
  numOpponents: number;
  iterations?: number;
}

/**
 * Оценка вероятности выигрыша методом Монте-Карло: много раз дораздаёт
 * оставшиеся общие карты и случайные карты оппонентам, считает долю побед.
 * Не претендует на точность профессионального солвера — это эвристика
 * для бота-заполнителя, а не инструмент для реальных денежных решений.
 */
export function estimateEquity(params: EquityParams): number {
  const { holeCards, communityCards, numOpponents, iterations = 300 } = params;
  if (numOpponents <= 0) return 1;

  const used = new Set([...holeCards, ...communityCards]);
  const baseDeck = createDeck().filter((c) => !used.has(c));
  const neededCommunity = 5 - communityCards.length;
  const cardsNeededPerRun = neededCommunity + numOpponents * 2;

  if (baseDeck.length < cardsNeededPerRun) {
    // Теоретически невозможно (стол переполнен), подстраховка от деления на 0.
    return 0.5;
  }

  let wins = 0;
  let ties = 0;

  for (let i = 0; i < iterations; i++) {
    const shuffled = shuffleForSimulation(baseDeck);
    let cursor = 0;
    const simCommunity = [...communityCards, ...shuffled.slice(cursor, cursor + neededCommunity)];
    cursor += neededCommunity;

    const heroScore = evaluate7([...holeCards, ...simCommunity]);
    let heroIsBest = true;
    let tiedWithHero = false;

    for (let o = 0; o < numOpponents; o++) {
      const oppHole = shuffled.slice(cursor, cursor + 2);
      cursor += 2;
      const oppScore = evaluate7([...oppHole, ...simCommunity]);
      const cmp = compareHandScores(heroScore, oppScore);
      if (cmp < 0) {
        heroIsBest = false;
        break;
      }
      if (cmp === 0) tiedWithHero = true;
    }

    if (heroIsBest) {
      if (tiedWithHero) ties += 1;
      else wins += 1;
    }
  }

  return (wins + ties * 0.5) / iterations;
}
