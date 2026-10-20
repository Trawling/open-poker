import { createServer } from "node:http";
import cors from "cors";
import express from "express";
import { nanoid } from "nanoid";
import { Server, type Socket } from "socket.io";
import { generateGuestNickname, type Lang } from "./names.js";
import { loadSnapshot, loadStats, saveSnapshot, saveStats } from "./persistence.js";
import type { ClientToServerEvents, ServerToClientEvents, SocketData } from "./protocol.js";
import { RoomManager } from "./roomManager.js";
import { statsStore } from "./stats.js";

const PORT = Number(process.env.PORT ?? 4000);

/**
 * FRONTEND_ORIGIN может быть списком через запятую — self-hosted сервер
 * обычно обслуживает сразу и веб (свой домен), и нативное Android-приложение
 * (см. docs/05-android.md). У нативного приложения origin фиксированный
 * (Capacitor отдаёт собственные ассеты с http://localhost или
 * https://localhost в зависимости от настройки androidScheme) и не зависит
 * от домена вашего сервера — поэтому эти два origin'а разрешены всегда,
 * без дополнительной настройки, а FRONTEND_ORIGIN нужен только для вашего
 * веб-домена.
 */
const NATIVE_APP_ORIGINS = ["http://localhost", "https://localhost", "capacitor://localhost"];
const configuredOrigins = (process.env.FRONTEND_ORIGIN ?? "http://localhost:5173")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);
const allowedOrigins = new Set([...configuredOrigins, ...NATIVE_APP_ORIGINS]);

function corsOriginCheck(origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
  if (!origin || allowedOrigins.has(origin)) callback(null, true);
  else callback(new Error(`Origin не разрешён: ${origin}`));
}

const app = express();
app.use(cors({ origin: corsOriginCheck }));
app.get("/health", (_req, res) => {
  res.json({ ok: true, tables: roomManager.tableCount });
});
app.get("/api/stats/:guestId", (req, res) => {
  const stats = statsStore.get(req.params.guestId);
  res.json(
    stats ?? {
      nickname: "",
      handsPlayed: 0,
      handsWon: 0,
      chipsWon: 0,
      biggestPotWon: 0,
      tournamentsPlayed: 0,
      tournamentsWon: 0,
    },
  );
});

const httpServer = createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>(
  httpServer,
  { cors: { origin: corsOriginCheck, methods: ["GET", "POST"] } },
);

const roomManager = new RoomManager(io);

function sanitizeNickname(raw: string | undefined, lang: Lang): string {
  const trimmed = (raw ?? "").trim().slice(0, 24);
  return trimmed.length > 0 ? trimmed : generateGuestNickname(lang);
}

type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

io.on("connection", (socket: AppSocket) => {
  const guestId = (socket.handshake.auth?.guestId as string | undefined) || nanoid(12);
  // Только для автосгенерированных ников (гостя, ботов) — см. names.ts.
  // Выбранный игроком ник передаётся как есть и никогда не переводится.
  const lang: Lang = socket.handshake.auth?.lang === "en" ? "en" : "ru";
  const nickname = sanitizeNickname(socket.handshake.auth?.nickname as string | undefined, lang);
  socket.data = { guestId, nickname, tableId: null };

  function joinRoom(tableId: string) {
    const room = roomManager.get(tableId);
    if (!room) {
      socket.emit("table:error", { code: "TABLE_NOT_FOUND" });
      return;
    }
    if (!room.hasFreeSeat() && !room.table.seats.some((s) => s?.id === guestId)) {
      socket.emit("table:error", { code: "NO_FREE_SEAT" });
      return;
    }
    socket.data.tableId = tableId;
    const seatIndex = room.getOrAddHuman(guestId, socket.data.nickname, socket.id);
    socket.emit("table:joined", { tableId, playerId: guestId, seatIndex });
    room.broadcast();
    room.tryStartHand();
  }

  socket.on("table:quick-play", ({ nickname: nick, stakes } = {}) => {
    if (nick) socket.data.nickname = sanitizeNickname(nick, lang);
    const room = roomManager.findOrCreateQuickTable(stakes, lang);
    joinRoom(room.id);
  });

  socket.on("table:create", ({ nickname: nick, stakes } = {}) => {
    if (nick) socket.data.nickname = sanitizeNickname(nick, lang);
    const room = roomManager.createPrivateTable(stakes, lang);
    joinRoom(room.id);
  });

  socket.on("table:quick-tournament", ({ nickname: nick } = {}) => {
    if (nick) socket.data.nickname = sanitizeNickname(nick, lang);
    const room = roomManager.findOrCreateQuickTournament(lang);
    joinRoom(room.id);
  });

  socket.on("table:create-tournament", ({ nickname: nick } = {}) => {
    if (nick) socket.data.nickname = sanitizeNickname(nick, lang);
    const room = roomManager.createPrivateTournament(lang);
    joinRoom(room.id);
  });

  socket.on("table:join", ({ tableId, nickname: nick }) => {
    if (nick) socket.data.nickname = sanitizeNickname(nick, lang);
    joinRoom(tableId);
  });

  socket.on("table:action", (action) => {
    const room = socket.data.tableId ? roomManager.get(socket.data.tableId) : undefined;
    if (!room) {
      socket.emit("table:error", { code: "NOT_AT_TABLE" });
      return;
    }
    room.applyHumanAction(guestId, action);
  });

  socket.on("table:add-bot", () => {
    const room = socket.data.tableId ? roomManager.get(socket.data.tableId) : undefined;
    if (!room) return;
    room.addBot();
    room.broadcast();
    room.tryStartHand();
  });

  socket.on("table:rebuy", () => {
    const room = socket.data.tableId ? roomManager.get(socket.data.tableId) : undefined;
    if (!room) {
      socket.emit("table:error", { code: "NOT_AT_TABLE" });
      return;
    }
    room.rebuy(guestId);
  });

  socket.on("table:chat-send", ({ text }) => {
    const room = socket.data.tableId ? roomManager.get(socket.data.tableId) : undefined;
    room?.sendChat(guestId, text ?? "");
  });

  socket.on("table:leave", () => {
    const room = socket.data.tableId ? roomManager.get(socket.data.tableId) : undefined;
    room?.leave(guestId);
    socket.data.tableId = null;
    room?.broadcast();
  });

  socket.on("disconnect", () => {
    const room = socket.data.tableId ? roomManager.get(socket.data.tableId) : undefined;
    room?.markDisconnected(socket.id);
  });
});

setInterval(() => roomManager.sweepEmptyTables(), 60_000).unref();
setInterval(() => {
  saveSnapshot(roomManager.snapshot()).catch((err) => console.error("Не удалось сохранить снимок столов:", err));
  saveStats(statsStore.exportAll()).catch((err) => console.error("Не удалось сохранить статистику:", err));
}, 30_000).unref();

async function shutdown(signal: string) {
  console.log(`Получен ${signal}, сохраняем состояние столов и выходим...`);
  try {
    await Promise.all([saveSnapshot(roomManager.snapshot()), saveStats(statsStore.exportAll())]);
  } catch (err) {
    console.error("Не удалось сохранить снимок при выходе:", err);
  }
  httpServer.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 2000).unref();
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

Promise.all([loadSnapshot(), loadStats()])
  .then(([snapshot, stats]) => {
    if (snapshot.length > 0) {
      roomManager.restore(snapshot);
      console.log(`Восстановлено столов из снимка: ${snapshot.length}`);
    }
    statsStore.importAll(stats);
  })
  .catch((err) => console.error("Не удалось загрузить сохранённое состояние:", err))
  .finally(() => {
    httpServer.listen(PORT, () => {
      console.log(`Open Poker backend слушает на http://localhost:${PORT}`);
    });
  });
