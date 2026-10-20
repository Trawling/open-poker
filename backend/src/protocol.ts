import type { ActionInput, LegalActions, PublicTableState } from "@open-poker/engine";

export interface HandHistoryWinner {
  seatIndex: number;
  nickname: string;
  amount: number;
  handDescription?: string;
}

export interface HandHistoryEntry {
  handNumber: number;
  timestamp: number;
  communityCards: string[];
  potTotal: number;
  winners: HandHistoryWinner[];
}

export interface TournamentWinner {
  playerId: string;
  nickname: string;
}

export interface ChatMessage {
  id: string;
  seatIndex: number | null;
  nickname: string;
  text: string;
  timestamp: number;
}

export interface PersonalTableState extends PublicTableState {
  /** Разрешённые действия для получателя этого сообщения (null, если он не за столом). */
  yourLegalActions: LegalActions | null;
  yourSeatIndex: number | null;
  /** Последние завершённые раздачи за этим столом (не переживает перезапуск сервера). */
  recentHands: HandHistoryEntry[];
  /** Турнир (Sit & Go): без докупки, блайнды растут по расписанию. */
  isTournament: boolean;
  /** Заполняется, когда турнир завершён — новые раздачи больше не стартуют. */
  tournamentWinner: TournamentWinner | null;
  /** История чата стола — присылается целиком при входе/переподключении. */
  recentChat: ChatMessage[];
}

/** События, которые клиент отправляет серверу. */
export interface ClientToServerEvents {
  "table:quick-play": (payload: { nickname?: string; stakes?: string }) => void;
  "table:create": (payload: { nickname?: string; stakes?: string }) => void;
  "table:quick-tournament": (payload: { nickname?: string }) => void;
  "table:create-tournament": (payload: { nickname?: string }) => void;
  "table:join": (payload: { tableId: string; nickname?: string }) => void;
  "table:action": (payload: ActionInput) => void;
  "table:add-bot": () => void;
  "table:rebuy": () => void;
  "table:leave": () => void;
  "table:chat-send": (payload: { text: string }) => void;
}

/** События, которые сервер отправляет клиенту. */
export interface ServerToClientEvents {
  "table:joined": (payload: { tableId: string; playerId: string; seatIndex: number }) => void;
  "table:state": (payload: PersonalTableState) => void;
  /**
   * `code` — машинно-читаемый ключ, по которому фронтенд ищет перевод
   * (см. frontend/src/i18n, ключи errors.<code>); `params` — значения для
   * подстановки (например, минимальная сумма ставки). Намеренно без
   * готового текста — сервер не должен решать, на каком языке говорит клиент.
   */
  "table:error": (payload: { code: string; params?: Record<string, string | number> }) => void;
  /** Новое сообщение чата — рассылается сразу, не дожидаясь следующего table:state. */
  "table:chat": (payload: ChatMessage) => void;
}

export interface SocketData {
  guestId: string;
  nickname: string;
  tableId: string | null;
}
