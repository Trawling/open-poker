/**
 * Карта кодируется строкой из 2 символов: ранг + масть.
 * Ранги: 2 3 4 5 6 7 8 9 T J Q K A, масти: s h d c.
 * Пример: "As" — туз пик, "Td" — десятка бубен.
 */
export type Card = string;

export type StreetName = "preflop" | "flop" | "turn" | "river" | "showdown";

export type ActionType = "fold" | "check" | "call" | "bet" | "raise";

export interface ActionInput {
  type: ActionType;
  /** Итоговая сумма ставки/рейза на улице (не инкремент). Не нужна для fold/check/call. */
  amount?: number;
}

export interface SeatPlayer {
  id: string;
  nickname: string;
  stack: number;
  isBot: boolean;
  /** Карты в руке, известны только самому игроку и раскрываются на вскрытии. */
  holeCards: Card[];
  folded: boolean;
  allIn: boolean;
  /** Сколько внёс в банк за всю раздачу. */
  contributedTotal: number;
  /** Сколько внёс на текущей улице. */
  contributedStreet: number;
  /** Сидит за столом, но не участвует в текущей раздаче (например, только что сел). */
  sittingOut: boolean;
  lastAction?: ActionType;
  /** Заполняется только на вскрытии/при раскрытии карт. */
  revealedHoleCards?: Card[];
}

export interface Pot {
  amount: number;
  eligibleSeatIndexes: number[];
}

export interface WinnerInfo {
  seatIndex: number;
  playerId: string;
  amount: number;
  potIndex: number;
  handRank?: number[];
  handDescription?: string;
}

export interface TableConfig {
  tableId: string;
  maxSeats: number;
  smallBlind: number;
  bigBlind: number;
  startingStack: number;
  /** Сколько миллисекунд даётся на ход, прежде чем применяется действие по умолчанию. */
  turnTimeMs: number;
}

export interface LegalActions {
  canFold: boolean;
  canCheck: boolean;
  canCall: boolean;
  callAmount: number;
  canBet: boolean;
  canRaise: boolean;
  minBet: number;
  minRaiseTo: number;
  maxTo: number;
}

/** Публичное состояние одного игрока — то, что видно всем за столом. */
export interface PublicSeatView {
  seatIndex: number;
  id: string | null;
  nickname: string | null;
  stack: number;
  isBot: boolean;
  folded: boolean;
  allIn: boolean;
  contributedStreet: number;
  contributedTotal: number;
  sittingOut: boolean;
  lastAction: ActionType | null;
  isDealer: boolean;
  isSmallBlind: boolean;
  isBigBlind: boolean;
  isActing: boolean;
  /** Карты видны только если это сам игрок (на клиенте), либо раскрыты на вскрытии. */
  holeCards: Card[] | null;
  /** Участвует в текущей раздаче и получил карты (для отрисовки рубашек у других игроков). */
  hasHoleCards: boolean;
  connected?: boolean;
}

export interface PublicTableState {
  tableId: string;
  street: StreetName;
  communityCards: Card[];
  pots: { amount: number }[];
  seats: PublicSeatView[];
  handNumber: number;
  actingSeatIndex: number | null;
  turnDeadline: number | null;
  /** Хэш server seed, опубликованный до раздачи — для provably fair проверки. */
  serverSeedHash: string | null;
  /** Раскрывается после завершения раздачи. */
  revealedServerSeed: string | null;
  clientSeed: string | null;
  winners: WinnerInfo[] | null;
  config: TableConfig;
}

export interface HandEvent {
  type: string;
  [key: string]: unknown;
}
