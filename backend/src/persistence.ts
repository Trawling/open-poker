import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { PlayerStats } from "./stats.js";
import type { TableSnapshot } from "./tableRoom.js";

const DATA_DIR = process.env.DATA_DIR ?? path.resolve(process.cwd(), "data");
const SNAPSHOT_PATH = path.join(DATA_DIR, "tables.json");
const STATS_PATH = path.join(DATA_DIR, "stats.json");

/**
 * Намеренно простая персистентность: раз в N секунд и при аккуратном
 * завершении процесса сохраняем только места/стеки столов (см.
 * TableRoom.snapshot). Это не полноценная БД — для play-money сервиса
 * в духе Lichess этого достаточно, чтобы перезапуск сервера не обнулял
 * прогресс игроков. См. docs/03-implementation-notes.md.
 */
export async function loadSnapshot(): Promise<TableSnapshot[]> {
  try {
    const raw = await readFile(SNAPSHOT_PATH, "utf-8");
    return JSON.parse(raw) as TableSnapshot[];
  } catch {
    return [];
  }
}

export async function saveSnapshot(snapshot: TableSnapshot[]): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(SNAPSHOT_PATH, JSON.stringify(snapshot, null, 2), "utf-8");
}

export async function loadStats(): Promise<Record<string, PlayerStats>> {
  try {
    const raw = await readFile(STATS_PATH, "utf-8");
    return JSON.parse(raw) as Record<string, PlayerStats>;
  } catch {
    return {};
  }
}

export async function saveStats(stats: Record<string, PlayerStats>): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(STATS_PATH, JSON.stringify(stats, null, 2), "utf-8");
}
