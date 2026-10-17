import type { TableConfig } from "@open-poker/engine";
import { nanoid } from "nanoid";
import type { Server } from "socket.io";
import { resolveStakes } from "./stakes.js";
import { TableRoom, type TableSnapshot } from "./tableRoom.js";
import { TOURNAMENT_BLIND_LEVELS, TOURNAMENT_MAX_SEATS, TOURNAMENT_STARTING_STACK } from "./tournament.js";
import type { ClientToServerEvents, ServerToClientEvents, SocketData } from "./protocol.js";

type AppServer = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

const BASE_CONFIG: Pick<TableConfig, "maxSeats" | "turnTimeMs"> = {
  maxSeats: 6,
  turnTimeMs: 20000,
};

/** Через сколько мс после открытия быстрого стола добавить ботов, если живых игроков не хватает. */
const QUICK_PLAY_FILL_DELAY_MS = 6000;
const QUICK_PLAY_MIN_PLAYERS = 2;
/** Турнир ощущается турниром только с несколькими соперниками — добираем ботами до этого числа. */
const TOURNAMENT_MIN_PLAYERS = 4;

function buildCashConfig(tableId: string, stakesId: string | undefined): TableConfig {
  const stakes = resolveStakes(stakesId);
  return {
    ...BASE_CONFIG,
    tableId,
    smallBlind: stakes.smallBlind,
    bigBlind: stakes.bigBlind,
    startingStack: stakes.startingStack,
  };
}

function buildTournamentConfig(tableId: string): TableConfig {
  const firstLevel = TOURNAMENT_BLIND_LEVELS[0];
  return {
    maxSeats: TOURNAMENT_MAX_SEATS,
    turnTimeMs: BASE_CONFIG.turnTimeMs,
    tableId,
    smallBlind: firstLevel.smallBlind,
    bigBlind: firstLevel.bigBlind,
    startingStack: TOURNAMENT_STARTING_STACK,
  };
}

export class RoomManager {
  private readonly tables = new Map<string, TableRoom>();

  constructor(private readonly io: AppServer) {}

  get(tableId: string): TableRoom | undefined {
    return this.tables.get(tableId);
  }

  createPrivateTable(stakesId?: string): TableRoom {
    const id = nanoid(8);
    const room = new TableRoom(id, buildCashConfig(id, stakesId), this.io, false);
    this.tables.set(id, room);
    return room;
  }

  /**
   * Приватный турнир по ссылке — в отличие от быстрого турнира, ботами
   * автоматически НЕ добирается: это стол для конкретной компании друзей,
   * которые сами решают, когда начинать (и могут вручную добавить ботов
   * через уже существующую кнопку "+ Добавить бота", если кого-то не хватает).
   */
  createPrivateTournament(): TableRoom {
    const id = nanoid(8);
    const room = new TableRoom(id, buildTournamentConfig(id), this.io, false, true);
    this.tables.set(id, room);
    return room;
  }

  findOrCreateQuickTable(stakesId?: string): TableRoom {
    const stakes = resolveStakes(stakesId);
    for (const room of this.tables.values()) {
      if (
        room.isPublic &&
        !room.isTournament &&
        room.hasFreeSeat() &&
        room.table.config.smallBlind === stakes.smallBlind &&
        room.table.config.bigBlind === stakes.bigBlind
      ) {
        return room;
      }
    }
    const id = `quick-${nanoid(6)}`;
    const room = new TableRoom(id, buildCashConfig(id, stakesId), this.io, true);
    this.tables.set(id, room);
    this.scheduleAutoFill(room, QUICK_PLAY_MIN_PLAYERS);
    return room;
  }

  findOrCreateQuickTournament(): TableRoom {
    for (const room of this.tables.values()) {
      if (room.isPublic && room.isTournament && room.hasFreeSeat() && !room.table.handInProgress) {
        return room;
      }
    }
    const id = `tournament-${nanoid(6)}`;
    const room = new TableRoom(id, buildTournamentConfig(id), this.io, true, true);
    this.tables.set(id, room);
    this.scheduleAutoFill(room, TOURNAMENT_MIN_PLAYERS);
    return room;
  }

  /** Добирает стол ботами до minPlayers, если живых игроков не набралось за отведённое время. */
  private scheduleAutoFill(room: TableRoom, minPlayers: number): void {
    setTimeout(() => {
      if (room.humanCount === 0) return; // никто не пришёл — нет смысла заполнять пустой стол
      while (room.seatedCount < minPlayers && room.hasFreeSeat()) {
        room.addBot();
      }
      room.broadcast();
      room.tryStartHand();
    }, QUICK_PLAY_FILL_DELAY_MS);
  }

  sweepEmptyTables(): void {
    for (const [id, room] of this.tables.entries()) {
      if (room.seatedCount === 0) {
        this.tables.delete(id);
      }
    }
  }

  get tableCount(): number {
    return this.tables.size;
  }

  /** Снимок всех непустых столов — для сохранения между перезапусками сервера. */
  snapshot(): TableSnapshot[] {
    return [...this.tables.values()]
      .map((room) => room.snapshot())
      .filter((s) => s.seats.length > 0);
  }

  restore(snapshots: TableSnapshot[]): void {
    for (const snapshot of snapshots) {
      const room = TableRoom.fromSnapshot(snapshot, this.io);
      this.tables.set(room.id, room);
    }
  }
}
