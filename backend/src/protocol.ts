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
}

/** События, которые клиент отправляет серверу. */
export interface ClientToServerEvents {
  "table:quick-play": (payload: { nickname?: string; stakes?: string }) => void;
  "table:create": (payload: { nickname?: string; stakes?: string }) => void;
  "table:quick-tournament": (payload: { nickname?: string }) => void;
  "table:join": (payload: { tableId: string; nickname?: string }) => void;
  "table:action": (payload: ActionInput) => void;
  "table:add-bot": () => void;
  "table:rebuy": () => void;
  "table:leave": () => void;
}

/** События, которые сервер отправляет клиенту. */
export interface ServerToClientEvents {
  "table:joined": (payload: { tableId: string; playerId: string; seatIndex: number }) => void;
  "table:state": (payload: PersonalTableState) => void;
  "table:error": (payload: { message: string }) => void;
}

export interface SocketData {
  guestId: string;
  nickname: string;
  tableId: string | null;
}
