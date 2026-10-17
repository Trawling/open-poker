import { createHash, createHmac, randomBytes } from "node:crypto";
import type { Card } from "./types.js";

export const RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "T", "J", "Q", "K", "A"] as const;
export const SUITS = ["s", "h", "d", "c"] as const;

export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const rank of RANKS) {
    for (const suit of SUITS) {
      deck.push(`${rank}${suit}`);
    }
  }
  return deck;
}

export function generateServerSeed(): string {
  return randomBytes(32).toString("hex");
}

export function hashServerSeed(serverSeed: string): string {
  return createHash("sha256").update(serverSeed).digest("hex");
}

/**
 * Провайдер честных байтов: HMAC-SHA256 в режиме счётчика
 * от server seed + client seed + номера раздачи. Детерминирован —
 * любой может пересчитать тасовку, зная оба seed'а и nonce.
 */
function createByteStream(serverSeed: string, clientSeed: string, nonce: number) {
  let counter = 0;
  let buffer = Buffer.alloc(0);
  let pos = 0;
  return function nextByte(): number {
    if (pos >= buffer.length) {
      buffer = createHmac("sha256", serverSeed)
        .update(`${clientSeed}:${nonce}:${counter}`)
        .digest();
      counter += 1;
      pos = 0;
    }
    return buffer[pos++];
  };
}

/**
 * Честная тасовка Fisher–Yates на детерминированном источнике байт.
 * Используется rejection sampling, чтобы избежать смещения по модулю.
 */
export function shuffleDeck(
  deck: Card[],
  serverSeed: string,
  clientSeed: string,
  nonce: number,
): Card[] {
  const result = [...deck];
  const nextByte = createByteStream(serverSeed, clientSeed, nonce);
  for (let i = result.length - 1; i > 0; i--) {
    const range = i + 1;
    const limit = Math.floor(256 / range) * range;
    let r: number;
    do {
      r = nextByte();
    } while (r >= limit);
    const j = r % range;
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Пересчитывает тасовку и сверяет её с опубликованным хэшем server seed.
 * Это и есть "provably fair": любой может вызвать эту функцию после
 * раздачи и убедиться, что порядок карт не подделан задним числом.
 */
export function verifyShuffle(
  expectedHash: string,
  serverSeed: string,
  clientSeed: string,
  nonce: number,
): { valid: boolean; deck: Card[] } {
  const valid = hashServerSeed(serverSeed) === expectedHash;
  const deck = shuffleDeck(createDeck(), serverSeed, clientSeed, nonce);
  return { valid, deck };
}
