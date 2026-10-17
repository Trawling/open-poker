// Зеркало backend/src/protocol.ts — держим в синхроне вручную, протокол
// маленький и меняется редко. Типы доменной модели (PublicTableState и т.д.)
// переиспользуются напрямую из @open-poker/engine, чтобы не дублировать их.
import type { ActionInput, LegalActions, PublicTableState } from "@open-poker/engine";

export interface PersonalTableState extends PublicTableState {
  yourLegalActions: LegalActions | null;
  yourSeatIndex: number | null;
}

export interface ClientToServerEvents {
  "table:quick-play": (payload: { nickname?: string }) => void;
  "table:create": (payload: { nickname?: string }) => void;
  "table:join": (payload: { tableId: string; nickname?: string }) => void;
  "table:action": (payload: ActionInput) => void;
  "table:add-bot": () => void;
  "table:leave": () => void;
}

export interface ServerToClientEvents {
  "table:joined": (payload: { tableId: string; playerId: string; seatIndex: number }) => void;
  "table:state": (payload: PersonalTableState) => void;
  "table:error": (payload: { message: string }) => void;
}

export type { ActionInput, ActionType, Card, PublicSeatView } from "@open-poker/engine";
