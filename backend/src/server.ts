import { createServer } from "node:http";
import cors from "cors";
import express from "express";
import { nanoid } from "nanoid";
import { Server, type Socket } from "socket.io";
import { generateGuestNickname } from "./names.js";
import { loadSnapshot, saveSnapshot } from "./persistence.js";
import type { ClientToServerEvents, ServerToClientEvents, SocketData } from "./protocol.js";
import { RoomManager } from "./roomManager.js";

const PORT = Number(process.env.PORT ?? 4000);
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN ?? "http://localhost:5173";

const app = express();
app.use(cors({ origin: FRONTEND_ORIGIN }));
app.get("/health", (_req, res) => {
  res.json({ ok: true, tables: roomManager.tableCount });
});

const httpServer = createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>(
  httpServer,
  { cors: { origin: FRONTEND_ORIGIN, methods: ["GET", "POST"] } },
);

const roomManager = new RoomManager(io);

function sanitizeNickname(raw: string | undefined): string {
  const trimmed = (raw ?? "").trim().slice(0, 24);
  return trimmed.length > 0 ? trimmed : generateGuestNickname();
}

type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

io.on("connection", (socket: AppSocket) => {
  const guestId = (socket.handshake.auth?.guestId as string | undefined) || nanoid(12);
  const nickname = sanitizeNickname(socket.handshake.auth?.nickname as string | undefined);
  socket.data = { guestId, nickname, tableId: null };

  function joinRoom(tableId: string) {
    const room = roomManager.get(tableId);
    if (!room) {
      socket.emit("table:error", { message: "Стол не найден. Возможно, он уже закрылся." });
      return;
    }
    if (!room.hasFreeSeat() && !room.table.seats.some((s) => s?.id === guestId)) {
      socket.emit("table:error", { message: "За столом нет свободных мест." });
      return;
    }
    socket.data.tableId = tableId;
    const seatIndex = room.getOrAddHuman(guestId, socket.data.nickname, socket.id);
    socket.emit("table:joined", { tableId, playerId: guestId, seatIndex });
    room.broadcast();
    room.tryStartHand();
  }

  socket.on("table:quick-play", ({ nickname: nick } = {}) => {
    if (nick) socket.data.nickname = sanitizeNickname(nick);
    const room = roomManager.findOrCreateQuickTable();
    joinRoom(room.id);
  });

  socket.on("table:create", ({ nickname: nick } = {}) => {
    if (nick) socket.data.nickname = sanitizeNickname(nick);
    const room = roomManager.createPrivateTable();
    joinRoom(room.id);
  });

  socket.on("table:join", ({ tableId, nickname: nick }) => {
    if (nick) socket.data.nickname = sanitizeNickname(nick);
    joinRoom(tableId);
  });

  socket.on("table:action", (action) => {
    const room = socket.data.tableId ? roomManager.get(socket.data.tableId) : undefined;
    if (!room) {
      socket.emit("table:error", { message: "Вы не за столом." });
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
      socket.emit("table:error", { message: "Вы не за столом." });
      return;
    }
    room.rebuy(guestId);
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
}, 30_000).unref();

async function shutdown(signal: string) {
  console.log(`Получен ${signal}, сохраняем состояние столов и выходим...`);
  try {
    await saveSnapshot(roomManager.snapshot());
  } catch (err) {
    console.error("Не удалось сохранить снимок при выходе:", err);
  }
  httpServer.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 2000).unref();
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

loadSnapshot()
  .then((snapshot) => {
    if (snapshot.length > 0) {
      roomManager.restore(snapshot);
      console.log(`Восстановлено столов из снимка: ${snapshot.length}`);
    }
  })
  .catch((err) => console.error("Не удалось загрузить снимок столов:", err))
  .finally(() => {
    httpServer.listen(PORT, () => {
      console.log(`Open Poker backend слушает на http://localhost:${PORT}`);
    });
  });
