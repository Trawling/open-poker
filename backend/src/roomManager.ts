import type { TableConfig } from "@open-poker/engine";
import { nanoid } from "nanoid";
import type { Server } from "socket.io";
import { resolveStakes } from "./stakes.js";
import { TableRoom, type TableSnapshot } from "./tableRoom.js";
import type { ClientToServerEvents, ServerToClientEvents, SocketData } from "./protocol.js";

type AppServer = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

const BASE_CONFIG: Pick<TableConfig, "maxSeats" | "turnTimeMs"> = {
  maxSeats: 6,
  turnTimeMs: 20000,
};

/** Через сколько мс после открытия быстрого стола добавить бота, если второй живой игрок ещё не пришёл. */
const QUICK_PLAY_FILL_DELAY_MS = 6000;
const QUICK_PLAY_MIN_PLAYERS = 2;

function buildConfig(tableId: string, stakesId: string | undefined): TableConfig {
  const stakes = resolveStakes(stakesId);
  return {
    ...BASE_CONFIG,
    tableId,
    smallBlind: stakes.smallBlind,
    bigBlind: stakes.bigBlind,
    startingStack: stakes.startingStack,
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
    const room = new TableRoom(id, buildConfig(id, stakesId), this.io, false);
    this.tables.set(id, room);
    return room;
  }

  findOrCreateQuickTable(stakesId?: string): TableRoom {
    const stakes = resolveStakes(stakesId);
    for (const room of this.tables.values()) {
      if (
        room.isPublic &&
        room.hasFreeSeat() &&
        room.table.config.smallBlind === stakes.smallBlind &&
        room.table.config.bigBlind === stakes.bigBlind
      ) {
        return room;
      }
    }
    const id = `quick-${nanoid(6)}`;
    const room = new TableRoom(id, buildConfig(id, stakesId), this.io, true);
    this.tables.set(id, room);
    setTimeout(() => {
      if (room.humanCount > 0 && room.seatedCount < QUICK_PLAY_MIN_PLAYERS) {
        room.addBot();
        room.broadcast();
      }
      room.tryStartHand();
    }, QUICK_PLAY_FILL_DELAY_MS);
    return room;
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
