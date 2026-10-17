// Простой сквозной smoke-тест: поднятый backend должен позволить двум гостям
// зайти в «быструю игру» и доиграть хотя бы одну раздачу до конца.
// Запуск: BACKEND_URL=http://localhost:4000 node scripts/smoke-test.mjs
import { io } from "socket.io-client";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:4000";

function makeClient(name) {
  return io(BACKEND_URL, {
    auth: { guestId: `smoke-${name}-${Date.now()}`, nickname: name },
  });
}

function waitFor(socket, event) {
  return new Promise((resolve) => socket.once(event, resolve));
}

async function run() {
  console.log(`Подключаемся к ${BACKEND_URL} ...`);
  const alice = makeClient("Alice");
  const bob = makeClient("Bob");

  await Promise.all([waitFor(alice, "connect"), waitFor(bob, "connect")]);
  console.log("Оба клиента подключены");

  let handEndedResolve;
  const handEnded = new Promise((resolve) => (handEndedResolve = resolve));

  for (const [name, socket] of [["Alice", alice], ["Bob", bob]]) {
    let lastActedKey = null;
    socket.on("table:error", (e) => console.error(`[${name}] ошибка:`, e.message));
    socket.on("table:state", (state) => {
      if (state.winners && state.winners.length > 0) {
        console.log(`[${name}] раздача №${state.handNumber} завершена, победители:`, state.winners);
        handEndedResolve(state);
      }
      const key = `${state.handNumber}:${state.street}:${state.actingSeatIndex}`;
      if (key === lastActedKey) return; // уже действовали в этот момент раздачи
      if (state.yourLegalActions?.canCheck) {
        lastActedKey = key;
        socket.emit("table:action", { type: "check" });
      } else if (state.yourLegalActions?.canCall) {
        lastActedKey = key;
        socket.emit("table:action", { type: "call" });
      }
    });
  }

  alice.emit("table:quick-play", { nickname: "Alice" });
  const joinedAlice = await waitFor(alice, "table:joined");
  console.log("Alice села за стол", joinedAlice.tableId);

  bob.emit("table:join", { tableId: joinedAlice.tableId, nickname: "Bob" });
  await waitFor(bob, "table:joined");
  console.log("Bob присоединился к тому же столу");

  const finalState = await Promise.race([
    handEnded,
    new Promise((_, reject) => setTimeout(() => reject(new Error("таймаут: раздача не завершилась за 20с")), 20000)),
  ]);

  console.log("✅ Smoke-тест пройден: раздача разыграна от начала до конца");
  console.log("Банк:", finalState.pots);
  alice.close();
  bob.close();
  process.exit(0);
}

run().catch((err) => {
  console.error("❌ Smoke-тест провален:", err);
  process.exit(1);
});
