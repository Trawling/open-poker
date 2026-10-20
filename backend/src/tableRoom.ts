import { randomUUID } from "node:crypto";
import { PokerTable, TableError } from "@open-poker/engine";
import type { ActionInput, TableConfig } from "@open-poker/engine";
import type { Server } from "socket.io";
import { decideBotAction } from "./bot.js";
import { generateBotNickname, type Lang } from "./names.js";
import type {
  ChatMessage,
  ClientToServerEvents,
  HandHistoryEntry,
  ServerToClientEvents,
  SocketData,
  TournamentWinner,
} from "./protocol.js";
import { statsStore } from "./stats.js";
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
const MAX_CHAT_HISTORY = 50;
const MAX_CHAT_MESSAGE_LENGTH = 240;

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
  /** Чат стола — не переживает перезапуск сервера, как и история раздач. */
  private chatHistory: ChatMessage[] = [];

  constructor(
    id: string,
    config: TableConfig,
    io: AppServer,
    isPublic: boolean,
    isTournament = false,
    private readonly lang: Lang = "ru",
  ) {
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

  /**
   * Турнир считается уже "начавшимся", как только сыграна хотя бы одна
   * раздача — даже если формально остаются пустые места (maxSeats у
   * турнирного стола больше минимума для старта, чтобы в приватном
   * турнире друзья могли подсаживаться до его начала). Без этой проверки
   * подбор "быстрого турнира" мог бы годами переиспользовать один и тот
   * же стол, подсаживая новых игроков прямо в разгар чужого турнира со
   * свежим стеком — это ломает инвариант "один закрытый состав игроков
   * до победителя" и было реальной причиной зависания турнирного теста
   * в CI (см. историю коммитов).
   */
  hasTournamentStarted(): boolean {
    return this.table.handNumber > 0;
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
      this.emitError(playerId, "REBUY_TOURNAMENT_ELIMINATED");
      return;
    }
    try {
      this.table.rebuy(playerId, this.table.config.startingStack);
    } catch (err) {
      const code = err instanceof TableError ? err.code : "REBUY_UNAVAILABLE";
      const params = err instanceof TableError ? err.params : undefined;
      this.emitError(playerId, code, params);
      return;
    }
    this.broadcast();
    this.tryStartHand();
  }

  /** Чат за столом: только живые игроки, текст обрезается и ограничен по длине. */
  sendChat(playerId: string, rawText: string): void {
    const text = rawText.trim().slice(0, MAX_CHAT_MESSAGE_LENGTH);
    if (!text) return;
    const conn = this.connections.get(playerId);
    if (!conn || conn.isBot) return;
    const seatIndex = this.table.seats.findIndex((s) => s?.id === playerId);
    const message: ChatMessage = {
      id: randomUUID(),
      seatIndex: seatIndex === -1 ? null : seatIndex,
      nickname: conn.nickname,
      text,
      timestamp: Date.now(),
    };
    this.chatHistory.push(message);
    if (this.chatHistory.length > MAX_CHAT_HISTORY) {
      this.chatHistory.shift();
    }
    for (const c of this.connections.values()) {
      if (c.socketId) this.io.to(c.socketId).emit("table:chat", message);
    }
  }

  addBot(): void {
    if (!this.hasFreeSeat()) return;
    const usedNames = new Set([...this.connections.values()].map((c) => c.nickname));
    const nickname = generateBotNickname(usedNames, this.lang);
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
    // НЕ просто broadcast()+scheduleNextActor(): startHand() сам может
    // мгновенно и полностью доиграть раздачу синхронно (если блайнды сразу
    // загоняют кого-то в ва-банк и действовать может от силы 1 игрок —
    // см. PokerTable.maybeFastForwardAllIns()), и тогда handInProgress уже
    // false ещё ДО того, как мы дошли до этой строки. scheduleNextActor()
    // в таком случае ничего не делает (никто не ходит — раздача же уже
    // кончилась), и scheduleAutoStart() для следующей раздачи никогда не
    // вызывается — стол зависает навсегда с показанным клиентам финальным
    // состоянием, но без дальнейшего прогресса (настоящая находка из CI,
    // см. историю коммитов). Единая точка afterAction() уже умеет корректно
    // обработать оба случая.
    this.afterAction();
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
      const code = err instanceof TableError ? err.code : "INVALID_ACTION";
      const params = err instanceof TableError ? err.params : undefined;
      this.emitError(playerId, code, params);
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
   *
   * Каждый шаг обёрнут отдельно: если где-то внутри бросится непредвиденное
   * исключение (найдена реальная причина зависания стола в CI — см. историю
   * коммитов), это не должно оставить раздачу/турнир замороженными навсегда
   * без единого лога. Рассылка состояния и планирование следующего шага
   * гарантированы в любом случае — это важнее, чем временно пропущенная
   * запись истории или статистики.
   */
  private afterAction(): void {
    try {
      if (!this.table.handInProgress) {
        this.safeStep("recordHandHistory", () => this.recordHandHistory());
        this.safeStep("processPendingLeaves", () => this.processPendingLeaves());
        const tournamentJustFinished = this.isTournament
          ? this.safeStep("checkTournamentFinished", () => this.checkTournamentFinished()) ?? false
          : false;
        this.broadcast();
        if (!tournamentJustFinished) this.scheduleAutoStart();
        return;
      }
      this.broadcast();
      this.scheduleNextActor();
    } catch (err) {
      // Последний рубеж: что бы ни случилось выше, стол не должен повиснуть
      // навсегда. Принудительно завершаем раздачу и пробуем восстановиться.
      console.error(`[TableRoom ${this.id}] непредвиденная ошибка в afterAction, аварийное восстановление:`, err);
      try {
        this.table.forceEndHand();
        this.broadcast();
        this.scheduleAutoStart();
      } catch (err2) {
        console.error(`[TableRoom ${this.id}] аварийное восстановление тоже не удалось:`, err2);
      }
    }
  }

  /** Выполняет шаг восстановления с логированием ошибки вместо падения всего afterAction. */
  private safeStep<T>(label: string, fn: () => T): T | undefined {
    try {
      return fn();
    } catch (err) {
      console.error(`[TableRoom ${this.id}] ошибка на шаге "${label}":`, err);
      return undefined;
    }
  }

  /** Возвращает true, если турнир только что завершился (остался один игрок с фишками). */
  private checkTournamentFinished(): boolean {
    if (this.tournamentWinner) return true;
    if (this.table.activePlayerCount() > 1) return false;
    const winnerSeatIndex = this.table.occupiedSeats().find((i) => this.table.seats[i]!.stack > 0);
    if (winnerSeatIndex === undefined) return false;
    const seat = this.table.seats[winnerSeatIndex]!;
    this.tournamentWinner = { playerId: seat.id, nickname: seat.nickname };

    for (const [playerId, conn] of this.connections.entries()) {
      if (conn.isBot) continue;
      statsStore.recordTournamentPlayed(playerId, conn.nickname);
    }
    if (!seat.isBot) {
      statsStore.recordTournamentWon(seat.id, seat.nickname);
    }
    return true;
  }

  private recordHandHistory(): void {
    this.updateHandStats();
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

  /** Обновляет статистику игроков (не ботов) по только что завершённой раздаче. */
  private updateHandStats(): void {
    for (const seatIndex of this.table.occupiedSeats()) {
      const seat = this.table.seats[seatIndex];
      // sittingOut здесь ещё отражает участие именно в только что завершённой
      // раздаче — сбрасывается только на следующем startHand().
      if (!seat || seat.isBot || seat.sittingOut) continue;
      statsStore.recordHandPlayed(seat.id, seat.nickname);
    }
    for (const winner of this.table.winners ?? []) {
      const seat = this.table.seats[winner.seatIndex];
      if (!seat || seat.isBot) continue;
      statsStore.recordHandWon(seat.id, seat.nickname, winner.amount);
    }
  }

  private scheduleNextActor(): void {
    this.clearTimers();
    const seatIndex = this.table.actingSeatIndex;
    if (seatIndex === null) {
      if (this.table.handInProgress) {
        // Не должно происходить в норме: если раздача идёт, кто-то обязан
        // ходить. Если всё же случилось (непредвиденная ошибка движка,
        // например посреди вскрытия) — не оставляем стол висеть навсегда,
        // а принудительно завершаем раздачу и планируем следующую.
        console.error(
          `[TableRoom ${this.id}] handInProgress=true, но actingSeatIndex=null ` +
            `(street=${this.table.street}, hand=${this.table.handNumber}) — принудительное восстановление`,
        );
        this.table.forceEndHand();
        this.afterAction();
      }
      return;
    }
    const seat = this.table.seats[seatIndex];
    if (!seat) return;
    const conn = this.connections.get(seat.id);
    if (!conn) {
      console.error(
        `[TableRoom ${this.id}] за местом ${seatIndex} нет записи о соединении (id=${seat.id}) — пропускаем ход`,
      );
      return;
    }

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
      } catch (err) {
        console.error(`[TableRoom ${this.id}] ошибка автодействия по таймеру хода:`, err);
      }
      this.afterAction();
    }, this.table.config.turnTimeMs);
  }

  private runBotTurn(playerId: string): void {
    let action: ActionInput;
    try {
      // decideBotAction раньше вызывался вне try/catch — если эвристика бота
      // (эквити/пот-оддсы) бросает исключение на каком-то крайнем случае
      // стола, ход бота никогда не применялся и afterAction() даже не
      // вызывался, из-за чего стол мог зависнуть навсегда без единого лога.
      action = decideBotAction(this.table, playerId);
    } catch (err) {
      console.error(`[TableRoom ${this.id}] ошибка принятия решения ботом (${playerId}), fallback на fold:`, err);
      action = { type: "fold" };
    }
    try {
      this.table.applyAction(playerId, action);
    } catch (err) {
      console.error(`[TableRoom ${this.id}] ошибка хода бота (${playerId}), пробуем fold:`, err);
      try {
        this.table.applyAction(playerId, { type: "fold" });
      } catch (err2) {
        console.error(`[TableRoom ${this.id}] fold тоже не прошёл:`, err2);
      }
    }
    this.afterAction();
  }

  private emitError(playerId: string, code: string, params?: Record<string, string | number>): void {
    const conn = this.connections.get(playerId);
    if (conn?.socketId) {
      this.io.to(conn.socketId).emit("table:error", { code, params });
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
        recentChat: this.chatHistory,
        isTournament: this.isTournament,
        tournamentWinner: this.tournamentWinner,
      });
    }
  }
}
