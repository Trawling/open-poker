import type { ActionInput, PokerTable } from "@open-poker/engine";

/**
 * Простая эвристика для бота: не стратегия уровня GTO, а заполнитель,
 * чтобы за столом всегда было с кем сыграть прямо сейчас. Улучшение бота —
 * отдельная будущая задача, см. docs/02-mvp-scope.md.
 */
export function decideBotAction(table: PokerTable, playerId: string): ActionInput {
  const legal = table.getLegalActions(playerId);
  const r = Math.random();

  if (legal.canCheck) {
    if (legal.canBet && r > 0.75) {
      const amount = Math.min(legal.minBet * (1 + Math.floor(Math.random() * 2)), legal.maxTo);
      return { type: "bet", amount };
    }
    return { type: "check" };
  }

  // Приходится отвечать на чужую ставку.
  if (legal.canFold && r < 0.2) {
    return { type: "fold" };
  }
  if (legal.canRaise && r > 0.85) {
    const amount = Math.min(
      legal.minRaiseTo + Math.floor(Math.random() * 2) * legal.minRaiseTo,
      legal.maxTo,
    );
    return { type: "raise", amount };
  }
  if (legal.canCall) {
    return { type: "call" };
  }
  return { type: "fold" };
}
