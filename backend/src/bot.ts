import { estimateEquity, type ActionInput, type PokerTable } from "@open-poker/engine";

/** Стек короче этого числа больших блайндов — играем пуш/фолд, а не тонкую игру. */
const SHORT_STACK_BB_THRESHOLD = 12;
/** Ещё короче — почти не фолдим: блайнды всё равно добьют за 1-2 круга. */
const CRITICAL_STACK_BB_THRESHOLD = 5;

/**
 * Бот-заполнитель, принимающий решения на основе оценки силы руки
 * (equity методом Монте-Карло) и пот-оддсов. Это осознанно простая
 * эвристика, а не GTO-солвер — задача бота дать сыграть прямо сейчас,
 * а не быть сильным соперником. См. docs/03-implementation-notes.md.
 *
 * С коротким стеком (типично — поздняя стадия турнира) переключается на
 * прямолинейный пуш/фолд: иначе бот "тонко разыгрывает" руку, пока блайнды
 * медленно его съедают, и партия/турнир тянется неоправданно долго.
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
  const callAmount = legal.callAmount;
  const potOdds = callAmount / (potBeforeAction + callAmount || 1);

  // Небольшая случайность, чтобы бот не был полностью предсказуемым роботом.
  const noise = (Math.random() - 0.5) * 0.12;
  const perceivedStrength = equity + noise;

  const stackInBigBlinds = player.stack / table.config.bigBlind;
  if (stackInBigBlinds <= SHORT_STACK_BB_THRESHOLD) {
    const isCritical = stackInBigBlinds <= CRITICAL_STACK_BB_THRESHOLD;
    return decideShortStackAction(legal, perceivedStrength, potOdds, isCritical);
  }

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

  // Приходится отвечать на чужую ставку.
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

/**
 * Прямолинейный пуш/фолд для короткого стека — без полуставок и тонкой игры.
 * На критически коротком стеке (CRITICAL_STACK_BB_THRESHOLD) почти не
 * фолдим: блайнды всё равно добьют за 1-2 круга, так что смысла беречь
 * фишки для следующей раздачи больше нет — цель формата "турбо" важнее
 * имитации "осторожной" игры.
 */
function decideShortStackAction(
  legal: ReturnType<PokerTable["getLegalActions"]>,
  perceivedStrength: number,
  potOdds: number,
  isCritical: boolean,
): ActionInput {
  const shoveThreshold = isCritical ? 0.15 : 0.4;
  const callThreshold = isCritical ? -0.4 : -0.1;

  if (legal.canCheck) {
    if (legal.canBet && perceivedStrength > shoveThreshold) {
      return { type: "bet", amount: legal.maxTo };
    }
    return { type: "check" };
  }
  if (legal.canRaise && perceivedStrength > shoveThreshold) {
    return { type: "raise", amount: legal.maxTo };
  }
  // Фолдить с коротким стеком почти бессмысленно — блайнды съедят его и так,
  // поэтому порог колла заметно ниже, чем при глубоком стеке (и почти
  // отсутствует на критическом стеке).
  if (legal.canCall && perceivedStrength > potOdds + callThreshold) {
    return { type: "call" };
  }
  if (legal.canFold && !isCritical) return { type: "fold" };
  if (legal.canCall) return { type: "call" };
  if (legal.canFold) return { type: "fold" };
  return { type: "fold" };
}
