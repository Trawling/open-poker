// Зеркало backend/src/stakes.ts — держим в синхроне вручную, как и protocol.ts.
// Названий уровней тут больше нет: они переводятся в компоненте через i18n
// (ключи stakes.<id>, см. frontend/src/i18n) по smallBlind/bigBlind.
export interface StakesLevel {
  id: string;
  smallBlind: number;
  bigBlind: number;
  startingStack: number;
}

export const STAKES_LEVELS: StakesLevel[] = [
  { id: "low", smallBlind: 10, bigBlind: 20, startingStack: 1000 },
  { id: "mid", smallBlind: 50, bigBlind: 100, startingStack: 5000 },
  { id: "high", smallBlind: 200, bigBlind: 400, startingStack: 20000 },
];

export const DEFAULT_STAKES_ID = "low";
