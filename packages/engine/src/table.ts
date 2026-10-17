import { createDeck, generateServerSeed, hashServerSeed, shuffleDeck } from "./deck.js";
import { compareHandScores, describeHandScore, evaluate7 } from "./handEvaluator.js";
import type {
  ActionInput,
  Card,
  HandEvent,
  LegalActions,
  Pot,
  PublicSeatView,
  PublicTableState,
  SeatPlayer,
  StreetName,
  TableConfig,
  WinnerInfo,
} from "./types.js";

function emptySeatPlayer(): null {
  return null;
}

/** Внутреннее, "приватное" состояние раздачи — хранится только на сервере. */
export class PokerTable {
  readonly config: TableConfig;
  seats: (SeatPlayer | null)[];
  dealerSeatIndex = -1;
  street: StreetName = "preflop";
  communityCards: Card[] = [];
  deck: Card[] = [];
  deckPointer = 0;
  currentBetStreet = 0;
  minRaiseIncrement: number;
  toActOrder: number[] = [];
  handNumber = 0;
  smallBlindSeatIndex: number | null = null;
  bigBlindSeatIndex: number | null = null;
  serverSeed: string | null = null;
  serverSeedHash: string | null = null;
  revealedServerSeed: string | null = null;
  clientSeed: string | null = null;
  handInProgress = false;
  winners: WinnerInfo[] | null = null;
  pots: Pot[] = [];
  turnDeadline: number | null = null;
  events: HandEvent[] = [];

  constructor(config: TableConfig) {
    this.config = config;
    this.minRaiseIncrement = config.bigBlind;
    this.seats = Array.from({ length: config.maxSeats }, emptySeatPlayer);
  }

  private log(event: HandEvent) {
    this.events.push(event);
  }

  // ---------------------------------------------------------------------
  // Управление местами
  // ---------------------------------------------------------------------

  findFreeSeat(): number | null {
    const idx = this.seats.findIndex((s) => s === null);
    return idx === -1 ? null : idx;
  }

  sitDown(params: { id: string; nickname: string; isBot?: boolean; seatIndex?: number }): number {
    const seatIndex = params.seatIndex ?? this.findFreeSeat();
    if (seatIndex === null) throw new Error("Нет свободных мест за столом");
    if (this.seats[seatIndex] !== null) throw new Error("Место уже занято");
    this.seats[seatIndex] = {
      id: params.id,
      nickname: params.nickname,
      stack: this.config.startingStack,
      isBot: params.isBot ?? false,
      holeCards: [],
      folded: false,
      allIn: false,
      contributedTotal: 0,
      contributedStreet: 0,
      sittingOut: this.handInProgress, // подключится со следующей раздачи
      lastAction: undefined,
    };
    this.log({ type: "player-joined", seatIndex, id: params.id });
    return seatIndex;
  }

  /**
   * Восстанавливает игрока на конкретном месте с заданным стеком —
   * используется при восстановлении стола после перезапуска сервера
   * (см. backend/src/persistence.ts). Не трогает состояние текущей
   * раздачи, вызывать только пока раздача не идёт.
   */
  restoreSeat(seatIndex: number, params: { id: string; nickname: string; stack: number; isBot: boolean }) {
    if (this.seats[seatIndex] !== null) throw new Error("Место уже занято");
    this.seats[seatIndex] = {
      id: params.id,
      nickname: params.nickname,
      stack: params.stack,
      isBot: params.isBot,
      holeCards: [],
      folded: false,
      allIn: false,
      contributedTotal: 0,
      contributedStreet: 0,
      sittingOut: true,
      lastAction: undefined,
    };
  }

  /**
   * Докупка фишек. Без этого игрок, проигравший весь стек, навечно
   * застревает за столом с 0 фишками — это прямое нарушение принципа
   * "без гемора". Safe вызывать в любой момент (даже во время чужой
   * активной раздачи): севший за стол с 0 фишками игрок уже помечен
   * sittingOut и не участвует в текущей раздаче, рубай влияет только
   * на следующую.
   */
  rebuy(playerId: string, stack: number): void {
    const seatIndex = this.seats.findIndex((s) => s?.id === playerId);
    if (seatIndex === -1) throw new Error("Игрок не за этим столом");
    const seat = this.seats[seatIndex]!;
    if (seat.stack >= this.config.bigBlind) {
      throw new Error("Докупка доступна только когда фишек недостаточно для игры");
    }
    seat.stack = stack;
    seat.sittingOut = false;
  }

  standUp(playerId: string) {
    const seatIndex = this.seats.findIndex((s) => s?.id === playerId);
    if (seatIndex === -1) return;
    this.seats[seatIndex] = null;
    this.log({ type: "player-left", seatIndex, id: playerId });
  }

  occupiedSeats(): number[] {
    const out: number[] = [];
    this.seats.forEach((s, i) => {
      if (s) out.push(i);
    });
    return out;
  }

  private participatingSeats(): number[] {
    return this.occupiedSeats().filter((i) => {
      const s = this.seats[i]!;
      return !s.sittingOut && s.stack > 0;
    });
  }

  canStartHand(): boolean {
    return this.participatingSeats().length >= 2;
  }

  private nextSeatFrom(from: number, predicate: (i: number) => boolean): number {
    const n = this.config.maxSeats;
    for (let step = 1; step <= n; step++) {
      const idx = (from + step) % n;
      if (predicate(idx)) return idx;
    }
    throw new Error("Не найдено подходящее место");
  }

  // ---------------------------------------------------------------------
  // Старт раздачи
  // ---------------------------------------------------------------------

  startHand(): void {
    if (!this.canStartHand()) {
      throw new Error("Недостаточно игроков для начала раздачи");
    }
    this.handNumber += 1;
    this.winners = null;
    this.pots = [];
    this.communityCards = [];
    this.events = [];
    this.revealedServerSeed = null;

    const participants = this.participatingSeats();
    for (const i of this.occupiedSeats()) {
      const s = this.seats[i]!;
      if (participants.includes(i)) {
        s.folded = false;
        s.allIn = false;
        s.contributedTotal = 0;
        s.contributedStreet = 0;
        s.holeCards = [];
        s.lastAction = undefined;
        s.revealedHoleCards = undefined;
        s.sittingOut = false;
      } else {
        s.sittingOut = true;
      }
    }

    // Сдвигаем дилера на следующее участвующее место.
    if (this.dealerSeatIndex === -1 || !participants.includes(this.dealerSeatIndex)) {
      this.dealerSeatIndex = participants[0];
    } else {
      this.dealerSeatIndex = this.nextSeatFrom(this.dealerSeatIndex, (i) =>
        participants.includes(i),
      );
    }

    const isHeadsUp = participants.length === 2;
    if (isHeadsUp) {
      this.smallBlindSeatIndex = this.dealerSeatIndex;
      this.bigBlindSeatIndex = this.nextSeatFrom(this.dealerSeatIndex, (i) =>
        participants.includes(i),
      );
    } else {
      this.smallBlindSeatIndex = this.nextSeatFrom(this.dealerSeatIndex, (i) =>
        participants.includes(i),
      );
      this.bigBlindSeatIndex = this.nextSeatFrom(this.smallBlindSeatIndex, (i) =>
        participants.includes(i),
      );
    }

    // Честная тасовка: фиксируем server seed, публикуем его хэш заранее.
    this.serverSeed = generateServerSeed();
    this.serverSeedHash = hashServerSeed(this.serverSeed);
    this.clientSeed = `${this.config.tableId}:${this.handNumber}`;
    this.deck = shuffleDeck(createDeck(), this.serverSeed, this.clientSeed, 0);
    this.deckPointer = 0;

    // Раздаём по 2 карты, начиная с малого блайнда, по кругу.
    for (let round = 0; round < 2; round++) {
      let seat = this.smallBlindSeatIndex;
      for (let n = 0; n < participants.length; n++) {
        const player = this.seats[seat]!;
        player.holeCards.push(this.deck[this.deckPointer++]);
        seat = this.nextSeatFrom(seat, (i) => participants.includes(i));
      }
    }

    this.postBlind(this.smallBlindSeatIndex, this.config.smallBlind);
    this.postBlind(this.bigBlindSeatIndex, this.config.bigBlind);

    this.currentBetStreet = this.seats[this.bigBlindSeatIndex]!.contributedStreet;
    this.minRaiseIncrement = this.config.bigBlind;
    this.street = "preflop";
    this.handInProgress = true;

    const firstToAct = isHeadsUp
      ? this.smallBlindSeatIndex
      : this.nextSeatFrom(this.bigBlindSeatIndex, (i) => participants.includes(i));

    this.buildToActOrder(firstToAct);
    this.log({ type: "hand-started", handNumber: this.handNumber, dealerSeatIndex: this.dealerSeatIndex });
    this.maybeFastForwardAllIns();
  }

  private postBlind(seatIndex: number, amount: number) {
    const player = this.seats[seatIndex]!;
    const paid = Math.min(amount, player.stack);
    player.stack -= paid;
    player.contributedStreet += paid;
    player.contributedTotal += paid;
    if (player.stack === 0) player.allIn = true;
    this.log({ type: "post-blind", seatIndex, amount: paid });
  }

  private ableToAct(seatIndex: number): boolean {
    const s = this.seats[seatIndex];
    return !!s && !s.sittingOut && !s.folded && !s.allIn && s.stack >= 0;
  }

  private notFolded(seatIndex: number): boolean {
    const s = this.seats[seatIndex];
    return !!s && !s.sittingOut && !s.folded;
  }

  private buildToActOrder(startSeat: number) {
    const order: number[] = [];
    const candidates = this.occupiedSeats().filter((i) => this.ableToAct(i));
    if (candidates.length === 0) {
      this.toActOrder = [];
      return;
    }
    let seat = startSeat;
    if (!this.ableToAct(seat)) {
      seat = this.nextSeatFrom(seat, (i) => this.ableToAct(i));
    }
    for (let n = 0; n < candidates.length; n++) {
      order.push(seat);
      const rest = candidates.filter((i) => i !== seat && !order.includes(i));
      if (rest.length === 0) break;
      seat = this.nextSeatFrom(seat, (i) => this.ableToAct(i) && !order.includes(i));
    }
    this.toActOrder = order;
  }

  // ---------------------------------------------------------------------
  // Публичное состояние / разрешённые действия
  // ---------------------------------------------------------------------

  get actingSeatIndex(): number | null {
    return this.toActOrder.length > 0 ? this.toActOrder[0] : null;
  }

  getLegalActions(playerId: string): LegalActions {
    const seatIndex = this.seats.findIndex((s) => s?.id === playerId);
    const notYourTurn: LegalActions = {
      canFold: false,
      canCheck: false,
      canCall: false,
      callAmount: 0,
      canBet: false,
      canRaise: false,
      minBet: this.config.bigBlind,
      minRaiseTo: this.currentBetStreet + this.minRaiseIncrement,
      maxTo: 0,
    };
    if (seatIndex === -1 || this.actingSeatIndex !== seatIndex) return notYourTurn;
    const player = this.seats[seatIndex]!;
    const toCall = this.currentBetStreet - player.contributedStreet;
    const maxTo = player.contributedStreet + player.stack;
    return {
      canFold: toCall > 0,
      canCheck: toCall === 0,
      canCall: toCall > 0,
      callAmount: Math.min(toCall, player.stack),
      canBet: this.currentBetStreet === 0 && player.stack > 0,
      canRaise: this.currentBetStreet > 0 && player.stack > toCall,
      minBet: Math.min(this.config.bigBlind, player.stack),
      minRaiseTo: Math.min(this.currentBetStreet + this.minRaiseIncrement, maxTo),
      maxTo,
    };
  }

  // ---------------------------------------------------------------------
  // Применение действия игрока
  // ---------------------------------------------------------------------

  applyAction(playerId: string, action: ActionInput): HandEvent[] {
    const seatIndex = this.seats.findIndex((s) => s?.id === playerId);
    if (seatIndex === -1) throw new Error("Игрок не за этим столом");
    if (this.actingSeatIndex !== seatIndex) throw new Error("Сейчас не ваш ход");
    const player = this.seats[seatIndex]!;
    const startEventIndex = this.events.length;

    switch (action.type) {
      case "fold":
        this.handleFold(seatIndex);
        break;
      case "check": {
        const toCall = this.currentBetStreet - player.contributedStreet;
        if (toCall !== 0) throw new Error("Нельзя сделать чек: есть неуравненная ставка");
        player.lastAction = "check";
        this.log({ type: "action", seatIndex, action: "check" });
        this.toActOrder.shift();
        break;
      }
      case "call":
        this.handleCall(seatIndex);
        break;
      case "bet":
        this.handleBetOrRaise(seatIndex, action.amount ?? 0, "bet");
        break;
      case "raise":
        this.handleBetOrRaise(seatIndex, action.amount ?? 0, "raise");
        break;
      default:
        throw new Error(`Неизвестное действие: ${action.type}`);
    }

    this.afterAction();
    return this.events.slice(startEventIndex);
  }

  private handleFold(seatIndex: number) {
    const player = this.seats[seatIndex]!;
    player.folded = true;
    player.lastAction = "fold";
    this.toActOrder = this.toActOrder.filter((i) => i !== seatIndex);
    this.log({ type: "action", seatIndex, action: "fold" });
  }

  private handleCall(seatIndex: number) {
    const player = this.seats[seatIndex]!;
    const toCall = this.currentBetStreet - player.contributedStreet;
    const paid = Math.min(toCall, player.stack);
    player.stack -= paid;
    player.contributedStreet += paid;
    player.contributedTotal += paid;
    if (player.stack === 0) player.allIn = true;
    player.lastAction = "call";
    this.toActOrder.shift();
    this.log({ type: "action", seatIndex, action: "call", amount: paid });
  }

  private handleBetOrRaise(seatIndex: number, amountTo: number, kind: "bet" | "raise") {
    const player = this.seats[seatIndex]!;
    const maxTo = player.contributedStreet + player.stack;
    const isAllIn = amountTo >= maxTo;
    const effectiveTo = isAllIn ? maxTo : amountTo;

    if (kind === "bet" && this.currentBetStreet !== 0) {
      throw new Error("Уже есть ставка на этой улице — используйте raise");
    }
    if (kind === "raise" && this.currentBetStreet === 0) {
      throw new Error("Ставок ещё нет — используйте bet");
    }
    const minTo = kind === "bet"
      ? Math.min(this.config.bigBlind, maxTo)
      : Math.min(this.currentBetStreet + this.minRaiseIncrement, maxTo);
    if (!isAllIn && effectiveTo < minTo) {
      throw new Error(`Минимальная сумма: ${minTo}`);
    }

    const increment = effectiveTo - this.currentBetStreet;
    const paid = effectiveTo - player.contributedStreet;
    player.stack -= paid;
    player.contributedStreet = effectiveTo;
    player.contributedTotal += paid;
    if (player.stack === 0) player.allIn = true;
    player.lastAction = kind;

    if (increment >= this.minRaiseIncrement) {
      this.minRaiseIncrement = increment;
    }
    this.currentBetStreet = effectiveTo;

    // После ставки/рейза все остальные активные игроки должны отреагировать снова.
    const others = this.occupiedSeats().filter(
      (i) => i !== seatIndex && this.ableToAct(i),
    );
    this.toActOrder = this.rotateFromSeat(seatIndex, others);
    this.log({ type: "action", seatIndex, action: kind, amount: effectiveTo });
  }

  private rotateFromSeat(fromSeat: number, candidates: number[]): number[] {
    if (candidates.length === 0) return [];
    const order: number[] = [];
    let seat = fromSeat;
    while (order.length < candidates.length) {
      seat = this.nextSeatFrom(seat, (i) => candidates.includes(i) && !order.includes(i));
      order.push(seat);
    }
    return order;
  }

  // ---------------------------------------------------------------------
  // Переходы между улицами
  // ---------------------------------------------------------------------

  private afterAction() {
    const stillIn = this.occupiedSeats().filter((i) => this.notFolded(i));
    if (stillIn.length === 1) {
      this.finishHandBySingleWinner(stillIn[0]);
      return;
    }
    if (this.toActOrder.length === 0) {
      this.advanceStreet();
    }
  }

  private dealCommunity(count: number) {
    for (let i = 0; i < count; i++) {
      this.communityCards.push(this.deck[this.deckPointer++]);
    }
  }

  private resetStreetContributions() {
    for (const i of this.occupiedSeats()) {
      this.seats[i]!.contributedStreet = 0;
      if (!this.seats[i]!.folded) this.seats[i]!.lastAction = undefined;
    }
    this.currentBetStreet = 0;
    this.minRaiseIncrement = this.config.bigBlind;
  }

  private advanceStreet() {
    if (this.street === "preflop") {
      this.street = "flop";
      this.dealCommunity(3);
    } else if (this.street === "flop") {
      this.street = "turn";
      this.dealCommunity(1);
    } else if (this.street === "turn") {
      this.street = "river";
      this.dealCommunity(1);
    } else if (this.street === "river") {
      this.goToShowdown();
      return;
    }
    this.resetStreetContributions();
    this.log({ type: "street", street: this.street, communityCards: [...this.communityCards] });

    const participants = this.occupiedSeats().filter((i) => this.notFolded(i));
    const firstToAct = this.nextSeatFrom(this.dealerSeatIndex, (i) => participants.includes(i));
    this.buildToActOrder(firstToAct);
    this.maybeFastForwardAllIns();
  }

  /** Если активных (не all-in) игроков <= 1, разыгрываем улицы без торгов до вскрытия. */
  private maybeFastForwardAllIns() {
    const ableToAct = this.occupiedSeats().filter((i) => this.ableToAct(i));
    const stillIn = this.occupiedSeats().filter((i) => this.notFolded(i));
    if (stillIn.length <= 1) return;
    if (ableToAct.length <= 1) {
      this.toActOrder = [];
      this.advanceStreet();
    }
  }

  // ---------------------------------------------------------------------
  // Вскрытие и распределение банка
  // ---------------------------------------------------------------------

  private finishHandBySingleWinner(seatIndex: number) {
    const totalPot = this.occupiedSeats().reduce(
      (sum, i) => sum + this.seats[i]!.contributedTotal,
      0,
    );
    const player = this.seats[seatIndex]!;
    player.stack += totalPot;
    this.winners = [
      {
        seatIndex,
        playerId: player.id,
        amount: totalPot,
        potIndex: 0,
      },
    ];
    this.pots = [{ amount: totalPot, eligibleSeatIndexes: [seatIndex] }];
    this.log({ type: "hand-ended", winners: this.winners, reason: "fold" });
    this.revealServerSeed();
    this.handInProgress = false;
  }

  private goToShowdown() {
    this.street = "showdown";
    const contestants = this.occupiedSeats().filter((i) => this.notFolded(i));

    // Возврат неуравненной части ставки, если верхний взнос никто не смог покрыть.
    const totals = this.occupiedSeats()
      .filter((i) => this.seats[i]!.contributedTotal > 0)
      .map((i) => ({ i, total: this.seats[i]!.contributedTotal }));
    if (totals.length >= 1) {
      const topTotal = Math.max(...totals.map((t) => t.total));
      const tiedAtTop = totals.filter((t) => t.total === topTotal);
      // Возврат возможен только если ровно один игрок держит уникальный максимум —
      // иначе кто-то другой уравнял его ставку, и возвращать нечего.
      if (tiedAtTop.length === 1) {
        const top = tiedAtTop[0];
        const nextTotal = Math.max(
          0,
          ...totals.filter((t) => t.total < topTotal).map((t) => t.total),
        );
        const refund = top.total - nextTotal;
        if (refund > 0) {
          this.seats[top.i]!.stack += refund;
          this.seats[top.i]!.contributedTotal -= refund;
          this.log({ type: "uncalled-bet-returned", seatIndex: top.i, amount: refund });
        }
      }
    }

    this.pots = this.computeSidePots();
    this.winners = [];

    for (let potIndex = 0; potIndex < this.pots.length; potIndex++) {
      const pot = this.pots[potIndex];
      const eligible = pot.eligibleSeatIndexes.filter((i) => contestants.includes(i));
      if (eligible.length === 0) continue;
      let bestScore: number[] | null = null;
      let winnerSeats: number[] = [];
      for (const seatIndex of eligible) {
        const player = this.seats[seatIndex]!;
        const score = evaluate7([...player.holeCards, ...this.communityCards]);
        player.revealedHoleCards = [...player.holeCards];
        if (bestScore === null || compareHandScores(score, bestScore) > 0) {
          bestScore = score;
          winnerSeats = [seatIndex];
        } else if (compareHandScores(score, bestScore) === 0) {
          winnerSeats.push(seatIndex);
        }
      }
      const share = Math.floor(pot.amount / winnerSeats.length);
      let remainder = pot.amount - share * winnerSeats.length;
      for (const seatIndex of winnerSeats) {
        const bonus = remainder > 0 ? 1 : 0;
        remainder -= bonus;
        const amount = share + bonus;
        this.seats[seatIndex]!.stack += amount;
        const score = evaluate7([
          ...this.seats[seatIndex]!.holeCards,
          ...this.communityCards,
        ]);
        this.winners.push({
          seatIndex,
          playerId: this.seats[seatIndex]!.id,
          amount,
          potIndex,
          handRank: score,
          handDescription: describeHandScore(score),
        });
      }
    }

    this.log({ type: "hand-ended", winners: this.winners, reason: "showdown" });
    this.revealServerSeed();
    this.handInProgress = false;
  }

  private computeSidePots(): Pot[] {
    const contributors = this.occupiedSeats()
      .map((i) => ({ i, total: this.seats[i]!.contributedTotal }))
      .filter((c) => c.total > 0);
    const levels = [...new Set(contributors.map((c) => c.total))].sort((a, b) => a - b);
    const pots: Pot[] = [];
    let prevLevel = 0;
    for (const level of levels) {
      const increment = level - prevLevel;
      const payers = contributors.filter((c) => c.total >= level);
      const amount = increment * payers.length;
      const eligible = payers.filter((c) => this.notFolded(c.i)).map((c) => c.i);
      if (amount > 0) {
        pots.push({ amount, eligibleSeatIndexes: eligible });
      }
      prevLevel = level;
    }
    return pots;
  }

  private revealServerSeed() {
    this.revealedServerSeed = this.serverSeed;
  }

  // ---------------------------------------------------------------------
  // Сериализация в публичное состояние (для отправки клиентам)
  // ---------------------------------------------------------------------

  getPublicState(forPlayerId: string | null): PublicTableState {
    const seats: PublicSeatView[] = this.seats.map((s, seatIndex) => {
      if (!s) {
        return {
          seatIndex,
          id: null,
          nickname: null,
          stack: 0,
          isBot: false,
          folded: false,
          allIn: false,
          contributedStreet: 0,
          contributedTotal: 0,
          sittingOut: true,
          lastAction: null,
          isDealer: false,
          isSmallBlind: false,
          isBigBlind: false,
          isActing: false,
          holeCards: null,
          hasHoleCards: false,
        };
      }
      const isSelf = s.id === forPlayerId;
      const showCards = isSelf || !!s.revealedHoleCards;
      return {
        seatIndex,
        id: s.id,
        nickname: s.nickname,
        stack: s.stack,
        isBot: s.isBot,
        folded: s.folded,
        allIn: s.allIn,
        contributedStreet: s.contributedStreet,
        contributedTotal: s.contributedTotal,
        sittingOut: s.sittingOut,
        lastAction: s.lastAction ?? null,
        isDealer: seatIndex === this.dealerSeatIndex,
        isSmallBlind: seatIndex === this.smallBlindSeatIndex,
        isBigBlind: seatIndex === this.bigBlindSeatIndex,
        isActing: seatIndex === this.actingSeatIndex,
        holeCards: showCards ? (s.revealedHoleCards ?? s.holeCards) : null,
        hasHoleCards: s.holeCards.length > 0,
      };
    });

    return {
      tableId: this.config.tableId,
      street: this.street,
      communityCards: [...this.communityCards],
      pots: this.pots.length > 0
        ? this.pots.map((p) => ({ amount: p.amount }))
        : [{ amount: this.currentPotEstimate() }],
      seats,
      handNumber: this.handNumber,
      actingSeatIndex: this.actingSeatIndex,
      turnDeadline: this.turnDeadline,
      serverSeedHash: this.serverSeedHash,
      revealedServerSeed: this.revealedServerSeed,
      clientSeed: this.clientSeed,
      winners: this.winners,
      config: this.config,
    };
  }

  private currentPotEstimate(): number {
    return this.occupiedSeats().reduce((sum, i) => sum + this.seats[i]!.contributedTotal, 0);
  }
}
