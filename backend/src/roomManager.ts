import type { TableConfig } from "@open-poker/engine";
import { nanoid } from "nanoid";
import type { Server } from "socket.io";
import { TableRoom } from "./tableRoom.js";
import type { ClientToServerEvents, ServerToClientEvents, SocketData } from "./protocol.js";

type AppServer = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

const DEFAULT_CONFIG: Omit<TableConfig, "tableId"> = {
  maxSeats: 6,
  smallBlind: 10,
  bigBlind: 20,
  startingStack: 1000,
  turnTimeMs: 20000,
};

/** Через сколько мс после открытия быстрого стола добавить бота, если второй живой игрок ещё не пришёл. */
const QUICK_PLAY_FILL_DELAY_MS = 6000;
const QUICK_PLAY_MIN_PLAYERS = 2;

export class RoomManager {
  private readonly tables = new Map<string, TableRoom>();

  constructor(private readonly io: AppServer) {}

  get(tableId: string): TableRoom | undefined {
    return this.tables.get(tableId);
  }

  createPrivateTable(): TableRoom {
    const id = nanoid(8);
    const room = new TableRoom(id, { ...DEFAULT_CONFIG, tableId: id }, this.io, false);
    this.tables.set(id, room);
    return room;
  }

  findOrCreateQuickTable(): TableRoom {
    for (const room of this.tables.values()) {
      if (room.isPublic && room.hasFreeSeat()) {
        return room;
      }
    }
    const id = `quick-${nanoid(6)}`;
    const room = new TableRoom(id, { ...DEFAULT_CONFIG, tableId: id }, this.io, true);
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
}
