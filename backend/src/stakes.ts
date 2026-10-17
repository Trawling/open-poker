/**
 * Уровни ставок. Фишки виртуальные и ничего не стоят в любом случае —
 * разные уровни нужны только для разнообразия игры (как разный контроль
 * времени в шахматах), а не как разная "цена входа".
 */
export interface StakesLevel {
  id: string;
  label: string;
  smallBlind: number;
  bigBlind: number;
  startingStack: number;
}

export const STAKES_LEVELS: StakesLevel[] = [
  { id: "low", label: "Низкие (10/20)", smallBlind: 10, bigBlind: 20, startingStack: 1000 },
  { id: "mid", label: "Средние (50/100)", smallBlind: 50, bigBlind: 100, startingStack: 5000 },
  { id: "high", label: "Высокие (200/400)", smallBlind: 200, bigBlind: 400, startingStack: 20000 },
];

export const DEFAULT_STAKES_ID = "low";

export function resolveStakes(id: string | undefined): StakesLevel {
  return STAKES_LEVELS.find((s) => s.id === id) ?? STAKES_LEVELS.find((s) => s.id === DEFAULT_STAKES_ID)!;
}
