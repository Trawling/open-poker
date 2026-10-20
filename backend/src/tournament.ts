/**
 * Турнирный формат (Sit & Go в упрощённом виде): без докупки, блайнды
 * растут со временем, игра продолжается, пока не останется один игрок
 * с фишками. Это честно НЕ полноценный турнир с зафиксированным составом
 * и призовой сеткой (такой начинается только когда заполнены все места) —
 * просто формат "без права на ошибку", который можно начать прямо сейчас
 * в одиночку с ботами, не дожидаясь полного стола. См. docs/03-implementation-notes.md.
 */

// Было 2 — уменьшено до 1 после находки в CI: с уровнем на 2 раздачи
// затяжной хедз-ап/трёхсторонняя раздача между примерно равными ботами
// иногда не укладывалась даже в 8-минутный лимит тестового скрипта
// (это настоящая дисперсия, не баг — см. историю коммитов). Более
// быстрый рост блайндов и так в духе уже заявленного "турбо"-формата.
export const TOURNAMENT_HANDS_PER_LEVEL = 1;

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

/**
 * Уровень блайндов для раздачи с данным номером (1-based). За пределами
 * таблицы блайнды продолжают удваиваться каждые два уровня, а не
 * замирают на последнем значении.
 *
 * Это не только корректнее по духу турнира (иначе затяжной хедз-ап между
 * двумя примерно равными стеками мог бы стоять на месте бесконечно —
 * оставшиеся игроки забирают фишки выбывших, и соотношение стек/блайнд
 * остаётся комфортным, даже когда блайнды "вроде бы" растут), но и
 * реальная находка из CI: `scripts/tournament-test.mjs` однажды упёрся
 * в таймаут именно на затянувшемся хедз-апе на фиксированных верхних
 * блайндах — см. историю коммитов.
 */
export function blindLevelForHand(handNumber: number): BlindLevel {
  const levelIndex = Math.floor(Math.max(0, handNumber - 1) / TOURNAMENT_HANDS_PER_LEVEL);
  if (levelIndex < TOURNAMENT_BLIND_LEVELS.length) {
    return TOURNAMENT_BLIND_LEVELS[levelIndex];
  }
  const last = TOURNAMENT_BLIND_LEVELS[TOURNAMENT_BLIND_LEVELS.length - 1];
  const extraLevels = levelIndex - TOURNAMENT_BLIND_LEVELS.length + 1;
  const doublings = Math.ceil(extraLevels / 2);
  const factor = 2 ** doublings;
  return { smallBlind: last.smallBlind * factor, bigBlind: last.bigBlind * factor };
}
