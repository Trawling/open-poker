import { describe, expect, it } from "vitest";
import { estimateEquity } from "../src/equity.js";

describe("estimateEquity", () => {
  it("даёт паре тузов преимущество против одного случайного соперника префлоп", () => {
    const equity = estimateEquity({
      holeCards: ["Ah", "Ad"],
      communityCards: [],
      numOpponents: 1,
      iterations: 1500,
    });
    // Известное значение из покерной теории — около 85%, берём запас на дисперсию.
    expect(equity).toBeGreaterThan(0.7);
  });

  it("слабая рука 7-2 оффсьют слабее пары тузов в той же ситуации", () => {
    const strongEquity = estimateEquity({
      holeCards: ["Ah", "Ad"],
      communityCards: [],
      numOpponents: 1,
      iterations: 1500,
    });
    const weakEquity = estimateEquity({
      holeCards: ["7h", "2d"],
      communityCards: [],
      numOpponents: 1,
      iterations: 1500,
    });
    expect(weakEquity).toBeLessThan(strongEquity);
  });

  it("возвращает ~1 на вскрытой доске с недостижимой для одного соперника комбинацией", () => {
    const equity = estimateEquity({
      holeCards: ["Ah", "Kh"],
      communityCards: ["Qh", "Jh", "Th", "2c", "3d"], // готовый роял-флеш у героя
      numOpponents: 1,
      iterations: 500,
    });
    expect(equity).toBeGreaterThan(0.99);
  });
});
