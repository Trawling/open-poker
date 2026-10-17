import { describe, expect, it } from "vitest";
import { PokerTable } from "../src/table.js";
import { verifyShuffle } from "../src/deck.js";
import type { TableConfig } from "../src/types.js";

function makeConfig(overrides: Partial<TableConfig> = {}): TableConfig {
  return {
    tableId: "test-table",
    maxSeats: 6,
    smallBlind: 10,
    bigBlind: 20,
    startingStack: 1000,
    turnTimeMs: 20000,
    ...overrides,
  };
}

function totalChips(table: PokerTable): number {
  return table.occupiedSeats().reduce((sum, i) => sum + table.seats[i]!.stack, 0);
}

describe("PokerTable — героям по-честному", () => {
  it("разыгрывает полную раздачу heads-up до вскрытия с сохранением фишек", () => {
    const table = new PokerTable(makeConfig());
    table.sitDown({ id: "p1", nickname: "Alice" });
    table.sitDown({ id: "p2", nickname: "Bob" });

    const chipsBefore = totalChips(table);
    table.startHand();

    expect(table.actingSeatIndex).toBe(table.smallBlindSeatIndex); // дилер = SB ходит первым heads-up

    const dealerId = table.seats[table.dealerSeatIndex!]!.id;
    const bbId = table.seats[table.bigBlindSeatIndex!]!.id;

    table.applyAction(dealerId, { type: "call" });
    table.applyAction(bbId, { type: "check" });
    expect(table.street).toBe("flop");

    table.applyAction(bbId, { type: "check" });
    table.applyAction(dealerId, { type: "check" });
    expect(table.street).toBe("turn");

    table.applyAction(bbId, { type: "check" });
    table.applyAction(dealerId, { type: "check" });
    expect(table.street).toBe("river");

    table.applyAction(bbId, { type: "check" });
    table.applyAction(dealerId, { type: "check" });

    expect(table.street).toBe("showdown");
    expect(table.communityCards).toHaveLength(5);
    expect(table.winners).not.toBeNull();
    expect(table.handInProgress).toBe(false);
    expect(totalChips(table)).toBe(chipsBefore);

    // честность раздачи проверяема
    const { valid } = verifyShuffle(
      table.serverSeedHash!,
      table.revealedServerSeed!,
      table.clientSeed!,
      0,
    );
    expect(valid).toBe(true);
  });

  it("завершает раздачу сразу, если все, кроме одного, сбросили карты", () => {
    const table = new PokerTable(makeConfig());
    table.sitDown({ id: "p1", nickname: "Alice" });
    table.sitDown({ id: "p2", nickname: "Bob" });
    const chipsBefore = totalChips(table);
    table.startHand();

    const dealerId = table.seats[table.dealerSeatIndex!]!.id;
    table.applyAction(dealerId, { type: "fold" });

    expect(table.handInProgress).toBe(false);
    expect(table.winners).toHaveLength(1);
    expect(table.street).not.toBe("showdown");
    expect(totalChips(table)).toBe(chipsBefore);
  });

  it("корректно считает сайд-поты, когда игроки идут в олл-ин с разными стеками", () => {
    const table = new PokerTable(makeConfig({ maxSeats: 3, smallBlind: 10, bigBlind: 20 }));
    const a = table.sitDown({ id: "a", nickname: "A" });
    const b = table.sitDown({ id: "b", nickname: "B" });
    const c = table.sitDown({ id: "c", nickname: "C" });
    table.seats[a]!.stack = 100;
    table.seats[b]!.stack = 50;
    table.seats[c]!.stack = 200;
    const chipsBefore = totalChips(table);

    table.startHand(); // dealer=a(0), SB=b(1), BB=c(2), первый ход — a (UTG)
    expect(table.actingSeatIndex).toBe(0);

    table.applyAction("a", { type: "raise", amount: 100 }); // олл-ин a
    table.applyAction("b", { type: "call" }); // олл-ин b на 50
    table.applyAction("c", { type: "call" }); // call до 100

    expect(table.street).toBe("showdown");
    expect(table.communityCards).toHaveLength(5);

    // Главный банк 50*3=150 разыгрывается между всеми тремя,
    // сайд-банк (100-50)*2=100 — только между a и c.
    expect(table.pots.map((p) => p.amount).sort((x, y) => x - y)).toEqual([100, 150]);

    const totalAwarded = table.winners!.reduce((sum, w) => sum + w.amount, 0);
    expect(totalAwarded).toBe(250);
    expect(totalChips(table)).toBe(chipsBefore);
  });

  it("возвращает неуравненный излишек ставки, если никто не смог ответить", () => {
    const table = new PokerTable(makeConfig({ maxSeats: 2, smallBlind: 10, bigBlind: 20 }));
    const a = table.sitDown({ id: "a", nickname: "A" });
    const b = table.sitDown({ id: "b", nickname: "B" });
    table.seats[a]!.stack = 500;
    table.seats[b]!.stack = 100;
    const chipsBefore = totalChips(table);

    table.startHand();
    const dealerId = table.seats[table.dealerSeatIndex!]!.id; // heads-up: dealer = SB, ходит первым
    const bbId = table.seats[table.bigBlindSeatIndex!]!.id;

    table.applyAction(dealerId, { type: "call" });
    table.applyAction(bbId, { type: "check" });
    // flop: bbId ходит первым postflop
    table.applyAction(bbId, { type: "bet", amount: 1000 }); // олл-ин всем стеком (капается)
    table.applyAction(dealerId, { type: "call" }); // но у dealer может не хватать — тоже олл-ин

    expect(table.handInProgress).toBe(false);
    expect(totalChips(table)).toBe(chipsBefore);
  });

  it("докупка возвращает выбывшего игрока в игру", () => {
    const table = new PokerTable(makeConfig({ maxSeats: 2 }));
    table.sitDown({ id: "a", nickname: "A" });
    table.sitDown({ id: "b", nickname: "B" });
    table.seats[0]!.stack = 0; // представим, что игрок уже проигрался в прошлой раздаче

    expect(table.canStartHand()).toBe(false); // только один участник с фишками

    table.rebuy("a", 1000);

    expect(table.canStartHand()).toBe(true);
    table.startHand();
    expect(table.seats[0]!.sittingOut).toBe(false);
    expect(table.seats[0]!.stack).toBeGreaterThan(0);
  });

  it("не даёт докупиться, пока фишек ещё достаточно для игры", () => {
    const table = new PokerTable(makeConfig());
    table.sitDown({ id: "a", nickname: "A" });
    expect(() => table.rebuy("a", 1000)).toThrow();
  });

  it("setBlinds меняет блайнды для следующей раздачи (турнирный режим)", () => {
    const table = new PokerTable(makeConfig({ smallBlind: 10, bigBlind: 20 }));
    table.sitDown({ id: "a", nickname: "A" });
    table.sitDown({ id: "b", nickname: "B" });

    table.setBlinds(50, 100);
    table.startHand();

    expect(table.config.smallBlind).toBe(50);
    expect(table.config.bigBlind).toBe(100);
    const bb = table.seats[table.bigBlindSeatIndex!]!;
    expect(bb.contributedStreet).toBe(100);
  });

  it("activePlayerCount считает только игроков с фишками больше нуля", () => {
    const table = new PokerTable(makeConfig({ maxSeats: 3 }));
    table.sitDown({ id: "a", nickname: "A" });
    table.sitDown({ id: "b", nickname: "B" });
    table.sitDown({ id: "c", nickname: "C" });
    table.seats[1]!.stack = 0;

    expect(table.activePlayerCount()).toBe(2);
  });
});
