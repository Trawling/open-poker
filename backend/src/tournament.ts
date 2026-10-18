/**
 * Турнирный формат (Sit & Go в упрощённом виде): без докупки, блайнды
 * растут со временем, игра продолжается, пока не останется один игрок
 * с фишками. Это честно НЕ полноценный турнир с зафиксированным составом
 * и призовой сеткой (такой начинается только когда заполнены все места) —
 * просто формат "без права на ошибку", который можно начать прямо сейчас
 * в одиночку с ботами, не дожидаясь полного стола. См. docs/03-implementation-notes.md.
 */

export const TOURNAMENT_HANDS_PER_LEVEL = 2;

export interface BlindLevel {
  smallBlind: number;
  bigBlind: number;
}

export const TOURNAMENT_BLIND_LEVELS: BlindLevel[] = [
  { smallBlind: 10, bigBlind: 20 },
  { smallBlind: 15, bigBlind: 30 },
  { smallBlind: 25, bigBlind: 50 },
  { smallBlind: 50, bigBlind: 100 },
  { smallBlind: 75, bigBlind: 150 },
  { smallBlind: 100, bigBlind: 200 },
  { smallBlind: 150, bigBlind: 300 },
  { smallBlind: 200, bigBlind: 400 },
  { smallBlind: 300, bigBlind: 600 },
  { smallBlind: 500, bigBlind: 1000 },
];

// Турбо-формат: стартуем с умеренным стеком (50 больших блайндов), чтобы
// турнир с ботами не растягивался на десятки минут — цель "без гемора"
// важнее имитации долгого "взрослого" турнира.
export const TOURNAMENT_STARTING_STACK = 1000;
export const TOURNAMENT_MAX_SEATS = 6;

/** Уровень блайндов для раздачи с данным номером (1-based). */
export function blindLevelForHand(handNumber: number): BlindLevel {
  const levelIndex = Math.min(
    Math.floor(Math.max(0, handNumber - 1) / TOURNAMENT_HANDS_PER_LEVEL),
    TOURNAMENT_BLIND_LEVELS.length - 1,
  );
  return TOURNAMENT_BLIND_LEVELS[levelIndex];
}
