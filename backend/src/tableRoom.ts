import { PokerTable } from "@open-poker/engine";
import type { ActionInput, TableConfig } from "@open-poker/engine";
import type { Server } from "socket.io";
import { decideBotAction } from "./bot.js";
import { generateBotNickname } from "./names.js";
import type {
  ClientToServerEvents,
  HandHistoryEntry,
  ServerToClientEvents,
  SocketData,
  TournamentWinner,
} from "./protocol.js";
import { blindLevelForHand } from "./tournament.js";

type AppServer = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

interface Connection {
  nickname: string;
  isBot: boolean;
  socketId: string | null;
}

const NEXT_HAND_DELAY_MS = 4000;
const BOT_MIN_DELAY_MS = 700;
const BOT_MAX_DELAY_MS = 1800;
const MAX_HAND_HISTORY = 20;

export interface TableSnapshot {
  id: string;
  isPublic: boolean;
  isTournament: boolean;
  config: TableConfig;
  seats: { seatIndex: number; id: string; nickname: string; stack: number; isBot: boolean }[];
}

/**
 * Обёртка над чистым PokerTable: таймеры хода, боты, рассылка персонального
 * состояния каждому игроку (свои карты видны только ему) и безопасный выход
 * из-за стола, не ломающий раздачу в процессе.
 */
export class TableRoom {
  readonly id: string;
  readonly isPublic: boolean;
  readonly isTournament: boolean;
  readonly table: PokerTable;
  private readonly io: AppServer;
  private readonly connections = new Map<string, Connection>();
  private readonly pendingLeaves = new Set<string>();
  private turnTimer: NodeJS.Timeout | null = null;
  private nextHandTimer: NodeJS.Timeout | null = null;
  /**
   * Последние завершённые раздачи — только для показа в интерфейсе
   * («история раздач»), не переживает перезапуск сервера (в отличие от
   * стеков, которые сохраняются через TableRoom.snapshot).
   */
  private handHistory: HandHistoryEntry[] = [];
  /** Как только определён победитель турнира, новые раздачи больше не стартуют. */
  private tournamentWinner: TournamentWinner | null = null;

  constructor(id: string, config: TableConfig, io: AppServer, isPublic: boolean, isTournament = false) {
    this.id = id;
    this.table = new PokerTable(config);
    this.io = io;
    this.isPublic = isPublic;
    this.isTournament = isTournament;
  }

  get humanCount(): number {
    return [...this.connections.values()].filter((c) => !c.isBot).length;
  }

  get seatedCount(): number {
    return this.connections.size;
  }

  hasFreeSeat(): boolean {
    return this.table.findFreeSeat() !== null;
  }

  getOrAddHuman(playerId: string, nickname: string, socketId: string): number {
    const existing = this.connections.get(playerId);
    if (existing) {
      existing.socketId = socketId;
      this.pendingLeaves.delete(playerId);
      return this.table.seats.findIndex((s) => s?.id === playerId);
    }
    const seatIndex = this.table.sitDown({ id: playerId, nickname, isBot: false });
    this.connections.set(playerId, { nickname, isBot: false, socketId });
    return seatIndex;
  }

  /** Докупка фишек для игрока, у которого их не осталось — см. PokerTable.rebuy. */
  rebuy(playerId: string): void {
    if (this.isTournament) {
      this.emitError(playerId, "В турнире докупка недоступна — выбыл, значит выбыл.");
      return;
    }
    try {
      this.table.rebuy(playerId, this.table.config.startingStack);
    } catch (err) {
      this.emitError(playerId, err instanceof Error ? err.message : "Докупка недоступна");
      return;
    }
    this.broadcast();
    this.tryStartHand();
  }

  addBot(): void {
    if (!this.hasFreeSeat()) return;
    const usedNames = new Set([...this.connections.values()].map((c) => c.nickname));
    const nickname = generateBotNickname(usedNames);
    const botId = `bot-${Math.random().toString(36).slice(2, 10)}`;
    this.table.sitDown({ id: botId, nickname, isBot: true });
    this.connections.set(botId, { nickname, isBot: true, socketId: null });
  }

  markDisconnected(socketId: string): void {
    for (const conn of this.connections.values()) {
      if (conn.socketId === socketId) conn.socketId = null;
    }
  }

  /** Безопасный выход: если игрок в раздаче, он уходит только после её завершения. */
  leave(playerId: string): void {
    const conn = this.connections.get(playerId);
    if (!conn) return;
    if (this.table.handInProgress && this.table.seats.some((s) => s?.id === playerId)) {
      conn.socketId = null;
      this.pendingLeaves.add(playerId);
    } else {
      this.removePlayer(playerId);
    }
  }

  private removePlayer(playerId: string): void {
    this.connections.delete(playerId);
    this.pendingLeaves.delete(playerId);
    this.table.standUp(playerId);
  }

  private processPendingLeaves(): void {
    for (const id of this.pendingLeaves) {
      this.removePlayer(id);
    }
  }

  private clearTimers(): void {
    if (this.turnTimer) {
      clearTimeout(this.turnTimer);
      this.turnTimer = null;
    }
  }

  tryStartHand(): void {
    if (this.table.handInProgress) return;
    if (this.tournamentWinner) return;
    if (!this.table.canStartHand()) return;
    if (this.isTournament) {
      const level = blindLevelForHand(this.table.handNumber + 1);
      this.table.setBlinds(level.smallBlind, level.bigBlind);
    }
    this.table.startHand();
    this.broadcast();
    this.scheduleNextActor();
  }

  scheduleAutoStart(): void {
    if (this.nextHandTimer) clearTimeout(this.nextHandTimer);
    this.nextHandTimer = setTimeout(() => {
      this.nextHandTimer = null;
      this.tryStartHand();
    }, NEXT_HAND_DELAY_MS);
  }

  applyHumanAction(playerId: string, action: ActionInput): void {
    this.clearTimers();
    try {
      this.table.applyAction(playerId, action);
    } catch (err) {
      this.emitError(playerId, err instanceof Error ? err.message : "Недопустимое действие");
      this.scheduleNextActor();
      return;
    }
    this.afterAction();
  }

  /**
   * Единая точка после любого действия (человека, бота, автофолда по
   * таймеру): сначала фиксируем историю (если раздача завершилась),
   * потом рассылаем состояние — иначе клиенты получают события в
   * неверном порядке (например, победителей без свежей записи в истории).
   */
  private afterAction(): void {
    if (!this.table.handInProgress) {
      this.recordHandHistory();
      this.processPendingLeaves();
      if (this.isTournament && this.checkTournamentFinished()) {
        this.broadcast();
        return;
      }
      this.broadcast();
      this.scheduleAutoStart();
      return;
    }
    this.broadcast();
    this.scheduleNextActor();
  }

  /** Возвращает true, если турнир только что завершился (остался один игрок с фишками). */
  private checkTournamentFinished(): boolean {
    if (this.tournamentWinner) return true;
    if (this.table.activePlayerCount() > 1) return false;
    const winnerSeatIndex = this.table.occupiedSeats().find((i) => this.table.seats[i]!.stack > 0);
    if (winnerSeatIndex === undefined) return false;
    const seat = this.table.seats[winnerSeatIndex]!;
    this.tournamentWinner = { playerId: seat.id, nickname: seat.nickname };
    return true;
  }

  private recordHandHistory(): void {
    const winners = this.table.winners;
    if (!winners || winners.length === 0) return;
    const entry: HandHistoryEntry = {
      handNumber: this.table.handNumber,
      timestamp: Date.now(),
      communityCards: [...this.table.communityCards],
      potTotal: winners.reduce((sum, w) => sum + w.amount, 0),
      winners: winners.map((w) => ({
        seatIndex: w.seatIndex,
        nickname: this.table.seats[w.seatIndex]?.nickname ?? "?",
        amount: w.amount,
        handDescription: w.handDescription,
      })),
    };
    this.handHistory.unshift(entry);
    if (this.handHistory.length > MAX_HAND_HISTORY) {
      this.handHistory.length = MAX_HAND_HISTORY;
    }
  }

  private scheduleNextActor(): void {
    this.clearTimers();
    const seatIndex = this.table.actingSeatIndex;
    if (seatIndex === null) return;
    const seat = this.table.seats[seatIndex];
    if (!seat) return;
    const conn = this.connections.get(seat.id);
    if (!conn) return;

    if (conn.isBot) {
      const delay = BOT_MIN_DELAY_MS + Math.random() * (BOT_MAX_DELAY_MS - BOT_MIN_DELAY_MS);
      this.turnTimer = setTimeout(() => {
        this.turnTimer = null;
        this.runBotTurn(seat.id);
      }, delay);
      return;
    }

    this.table.turnDeadline = Date.now() + this.table.config.turnTimeMs;
    this.broadcast();
    this.turnTimer = setTimeout(() => {
      this.turnTimer = null;
      const legal = this.table.getLegalActions(seat.id);
      const fallback: ActionInput = legal.canCheck ? { type: "check" } : { type: "fold" };
      try {
        this.table.applyAction(seat.id, fallback);
      } catch {
        // ход уже невозможен — раздача продвинулась иначе, просто игнорируем
      }
      this.afterAction();
    }, this.table.config.turnTimeMs);
  }

  private runBotTurn(playerId: string): void {
    const action = decideBotAction(this.table, playerId);
    try {
      this.table.applyAction(playerId, action);
    } catch {
      try {
        this.table.applyAction(playerId, { type: "fold" });
      } catch {
        // раздача уже закрылась иначе — ничего не делаем
      }
    }
    this.afterAction();
  }

  private emitError(playerId: string, message: string): void {
    const conn = this.connections.get(playerId);
    if (conn?.socketId) {
      this.io.to(conn.socketId).emit("table:error", { message });
    }
  }

  /**
   * Снимок для персистентности между перезапусками сервера: только места
   * и стеки между раздачами. Состояние текущей раздачи (карты, улица,
   * банк) намеренно не сохраняется — при перезапуске текущая раздача
   * просто прерывается, а следующая стартует заново с сохранёнными стеками.
   */
  snapshot(): TableSnapshot {
    const seats: TableSnapshot["seats"] = [];
    this.table.seats.forEach((seat, seatIndex) => {
      if (!seat) return;
      seats.push({
        seatIndex,
        id: seat.id,
        nickname: seat.nickname,
        stack: seat.stack,
        isBot: seat.isBot,
      });
    });
    return { id: this.id, isPublic: this.isPublic, isTournament: this.isTournament, config: this.table.config, seats };
  }

  static fromSnapshot(snapshot: TableSnapshot, io: AppServer): TableRoom {
    const room = new TableRoom(snapshot.id, snapshot.config, io, snapshot.isPublic, snapshot.isTournament);
    for (const seat of snapshot.seats) {
      if (seat.stack <= 0) continue; // не восстанавливаем обнулившихся ботов/игроков
      room.table.restoreSeat(seat.seatIndex, seat);
      room.connections.set(seat.id, { nickname: seat.nickname, isBot: seat.isBot, socketId: null });
    }
    return room;
  }

  broadcast(): void {
    for (const [playerId, conn] of this.connections.entries()) {
      if (!conn.socketId) continue;
      const state = this.table.getPublicState(playerId);
      const seatIndex = this.table.seats.findIndex((s) => s?.id === playerId);
      this.io.to(conn.socketId).emit("table:state", {
        ...state,
        yourSeatIndex: seatIndex === -1 ? null : seatIndex,
        yourLegalActions: this.table.handInProgress ? this.table.getLegalActions(playerId) : null,
        recentHands: this.handHistory,
        isTournament: this.isTournament,
        tournamentWinner: this.tournamentWinner,
      });
    }
  }
}
