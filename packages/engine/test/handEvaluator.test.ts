import { describe, expect, it } from "vitest";
import { compareHandScores, evaluate5, evaluate7 } from "../src/handEvaluator.js";

describe("evaluate5", () => {
  it("распознаёт стрит-флеш", () => {
    const score = evaluate5(["9h", "8h", "7h", "6h", "5h"]);
    expect(score[0]).toBe(8);
  });

  it("распознаёт каре", () => {
    const score = evaluate5(["9h", "9d", "9c", "9s", "5h"]);
    expect(score[0]).toBe(7);
  });

  it("распознаёт фулл-хаус", () => {
    const score = evaluate5(["9h", "9d", "9c", "5s", "5h"]);
    expect(score[0]).toBe(6);
  });

  it("распознаёт колёсный стрит A-2-3-4-5", () => {
    const score = evaluate5(["Ah", "2d", "3c", "4s", "5h"]);
    expect(score[0]).toBe(4);
    expect(score[1]).toBe(5);
  });

  it("сравнивает две пары с одинаковой старшей парой по кикеру", () => {
    const a = evaluate5(["Ah", "Ad", "Kc", "Ks", "2h"]);
    const b = evaluate5(["Ah", "Ad", "Kc", "Ks", "3h"]);
    expect(compareHandScores(b, a)).toBeGreaterThan(0);
  });

  it("флеш старше стрита", () => {
    const flush = evaluate5(["2h", "5h", "9h", "Jh", "Kh"]);
    const straight = evaluate5(["5h", "6d", "7c", "8s", "9h"]);
    expect(compareHandScores(flush, straight)).toBeGreaterThan(0);
  });
});

describe("evaluate7", () => {
  it("находит лучшую комбинацию из 7 карт", () => {
    // 2 карманные + 5 общих, где флеш собирается только с учётом общих карт
    const score = evaluate7(["Ah", "Kh", "Qh", "Jh", "Th", "2c", "3d"]);
    expect(score[0]).toBe(8); // стрит-флеш (роял)
  });

  it("не путает флеш и отдельные старшие карты разных мастей", () => {
    const score = evaluate7(["2h", "7d", "9c", "Jh", "Kh", "4h", "Ah"]);
    expect(score[0]).toBe(5); // флеш по червям
  });
});
