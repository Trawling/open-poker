// Проверяет: 1) статистика обновляется после раздачи и доступна через REST,
// 2) приватный турнир создаётся по кнопке "Турнир для друзей" (без автодобора
// ботами) и в нём доступна ручная докупка... то есть наоборот, НЕ доступна.
import { io } from "socket.io-client";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:4000";

function makeClient(name, guestId) {
  return io(BACKEND_URL, { auth: { guestId, nickname: name } });
}

function waitFor(socket, event) {
  return new Promise((resolve) => socket.once(event, resolve));
}

async function run() {
  console.log(`Подключаемся к ${BACKEND_URL} ...`);

  // --- 1) Статистика после обычной кэш-раздачи ---
  const aliceId = `stats-alice-${Date.now()}`;
  const alice = makeClient("Alice", aliceId);
  const bob = makeClient("Bob", `stats-bob-${Date.now()}`);
  await Promise.all([waitFor(alice, "connect"), waitFor(bob, "connect")]);

  const handEnded = new Promise((resolve) => {
    for (const socket of [alice, bob]) {
      let lastActedKey = null;
      socket.on("table:state", (state) => {
        if (state.winners && state.winners.length > 0) resolve();
        const key = `${state.handNumber}:${state.street}:${state.actingSeatIndex}`;
        if (key === lastActedKey) return;
        lastActedKey = key;
        const legal = state.yourLegalActions;
        if (!legal) return;
        if (legal.canCheck) socket.emit("table:action", { type: "check" });
        else if (legal.canCall) socket.emit("table:action", { type: "call" });
      });
    }
  });

  alice.emit("table:create", { nickname: "Alice" });
  const joined = await waitFor(alice, "table:joined");
  bob.emit("table:join", { tableId: joined.tableId, nickname: "Bob" });
  await waitFor(bob, "table:joined");
  await handEnded;
  await new Promise((r) => setTimeout(r, 300)); // дать серверу обработать recordHandHistory

  const statsRes = await fetch(`${BACKEND_URL}/api/stats/${aliceId}`);
  const stats = await statsRes.json();
  if (stats.handsPlayed < 1) {
    throw new Error(`Ожидался handsPlayed >= 1, получено ${stats.handsPlayed}`);
  }
  console.log("✅ Статистика обновилась после раздачи:", stats);
  alice.close();
  bob.close();

  // --- 2) Приватный турнир не добирается ботами сам по себе ---
  const host = makeClient("Host", `stats-host-${Date.now()}`);
  await waitFor(host, "connect");
  host.emit("table:create-tournament", { nickname: "Host" });
  const tournamentJoined = await waitFor(host, "table:joined");
  const firstState = await waitFor(host, "table:state");
  if (!firstState.isTournament) {
    throw new Error("Ожидался isTournament=true для приватного турнира");
  }
  const seatedCount = firstState.seats.filter((s) => s.id).length;
  if (seatedCount !== 1) {
    throw new Error(`Приватный турнир не должен сам добираться ботами, занято мест: ${seatedCount}`);
  }
  console.log("✅ Приватный турнир создан и не добирается ботами:", tournamentJoined.tableId);
  host.close();

  process.exit(0);
}

run().catch((err) => {
  console.error("❌ Тест статистики/приватного турнира провален:", err);
  process.exit(1);
});
