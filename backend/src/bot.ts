import { estimateEquity, type ActionInput, type PokerTable } from "@open-poker/engine";

/**
 * Бот-заполнитель, принимающий решения на основе оценки силы руки
 * (equity методом Монте-Карло) и пот-оддсов. Это осознанно простая
 * эвристика, а не GTO-солвер — задача бота дать сыграть прямо сейчас,
 * а не быть сильным соперником. См. docs/03-implementation-notes.md.
 */
export function decideBotAction(table: PokerTable, playerId: string): ActionInput {
  const legal = table.getLegalActions(playerId);
  if (!legal.canFold && !legal.canCheck && !legal.canCall && !legal.canBet && !legal.canRaise) {
    return { type: "fold" };
  }

  const seatIndex = table.seats.findIndex((s) => s?.id === playerId);
  const player = table.seats[seatIndex];
  if (!player) return { type: "fold" };

  const numOpponents = table.occupiedSeats().filter(
    (i) => i !== seatIndex && !table.seats[i]!.folded && !table.seats[i]!.sittingOut,
  ).length;

  const equity = estimateEquity({
    holeCards: player.holeCards,
    communityCards: table.communityCards,
    numOpponents: Math.max(1, numOpponents),
    iterations: 200,
  });

  const potBeforeAction = table
    .occupiedSeats()
    .reduce((sum, i) => sum + table.seats[i]!.contributedTotal, 0);

  // Небольшая случайность, чтобы бот не был полностью предсказуемым роботом.
  const noise = (Math.random() - 0.5) * 0.12;
  const perceivedStrength = equity + noise;

  if (legal.canCheck) {
    if (legal.canBet && perceivedStrength > 0.62) {
      const sizeFactor = perceivedStrength > 0.8 ? 0.75 : 0.5;
      const amount = Math.min(
        Math.max(legal.minBet, Math.round(potBeforeAction * sizeFactor)),
        legal.maxTo,
      );
      return { type: "bet", amount };
    }
    if (legal.canBet && Math.random() < 0.08) {
      // редкий блеф небольшим размером
      return { type: "bet", amount: legal.minBet };
    }
    return { type: "check" };
  }

  // Приходится отвечать на чужую ставку — считаем пот-оддсы.
  const callAmount = legal.callAmount;
  const potOdds = callAmount / (potBeforeAction + callAmount || 1);

  if (perceivedStrength > potOdds + 0.08) {
    if (legal.canRaise && perceivedStrength > 0.8 && Math.random() < 0.5) {
      const amount = Math.min(
        Math.max(legal.minRaiseTo, Math.round(potBeforeAction * 0.8)),
        legal.maxTo,
      );
      return { type: "raise", amount };
    }
    if (legal.canCall) return { type: "call" };
  }

  if (legal.canCall && (perceivedStrength > potOdds - 0.05 || Math.random() < 0.1)) {
    return { type: "call" };
  }
  if (legal.canFold) return { type: "fold" };
  return { type: "call" };
}
