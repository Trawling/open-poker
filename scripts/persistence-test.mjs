// Проверяет, что стеки игроков переживают перезапуск backend-процесса:
// 1) играем раздачу, 2) посылаем SIGINT (как при graceful shutdown),
// 3) поднимаем backend заново с тем же DATA_DIR, 4) тот же guestId видит
// тот же стек на том же месте, а не сброшенный стартовый стек.
import { spawn } from "node:child_process";
import { rmSync } from "node:fs";
import { io } from "socket.io-client";

const PORT = 4100;
const DATA_DIR = "/tmp/open-poker-persistence-test";
const BACKEND_URL = `http://localhost:${PORT}`;

rmSync(DATA_DIR, { recursive: true, force: true });

function startBackend() {
  const child = spawn("node", ["backend/dist/server.js"], {
    env: { ...process.env, PORT: String(PORT), DATA_DIR, FRONTEND_ORIGIN: "http://localhost:5173" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  return child;
}

function waitForLog(child, pattern) {
  return new Promise((resolve) => {
    const onData = (data) => {
      if (pattern.test(data.toString())) {
        child.stdout.off("data", onData);
        resolve();
      }
    };
    child.stdout.on("data", onData);
  });
}

function waitFor(socket, event) {
  return new Promise((resolve) => socket.once(event, resolve));
}

async function run() {
  console.log("1) Стартуем backend...");
  let backend = startBackend();
  await waitForLog(backend, /слушает на/);

  const alice = io(BACKEND_URL, { auth: { guestId: "persist-alice", nickname: "Alice" } });
  const bob = io(BACKEND_URL, { auth: { guestId: "persist-bob", nickname: "Bob" } });
  await Promise.all([waitFor(alice, "connect"), waitFor(bob, "connect")]);

  let aliceFinalStack = null;
  let handEndedResolve;
  const handEnded = new Promise((resolve) => (handEndedResolve = resolve));

  for (const [name, socket, trackStack] of [["Alice", alice, true], ["Bob", bob, false]]) {
    let lastActedKey = null;
    socket.on("table:state", (state) => {
      if (trackStack) {
        const mySeat = state.seats.find((s) => s.seatIndex === state.yourSeatIndex);
        if (mySeat) aliceFinalStack = mySeat.stack;
      }
      if (state.winners && state.winners.length > 0) handEndedResolve();
      const key = `${state.handNumber}:${state.street}:${state.actingSeatIndex}`;
      if (key === lastActedKey) return;
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
  const joined = await waitFor(alice, "table:joined");
  const tableId = joined.tableId;
  bob.emit("table:join", { tableId, nickname: "Bob" });
  await waitFor(bob, "table:joined");

  console.log("2) Играем раздачу...");
  await Promise.race([
    handEnded,
    new Promise((_, reject) => setTimeout(() => reject(new Error("раздача не завершилась за 20с")), 20000)),
  ]);
  console.log(`   Стек Alice после раздачи: ${aliceFinalStack}`);

  alice.close();
  bob.close();

  console.log("3) Останавливаем backend (SIGINT, как при деплое)...");
  const exited = new Promise((resolve) => backend.once("exit", resolve));
  backend.kill("SIGINT");
  await exited;

  console.log("4) Поднимаем backend заново с тем же DATA_DIR...");
  backend = startBackend();
  await waitForLog(backend, /слушает на/);

  const aliceAgain = io(BACKEND_URL, { auth: { guestId: "persist-alice", nickname: "Alice" } });
  await waitFor(aliceAgain, "connect");
  const statePromise = waitFor(aliceAgain, "table:state");
  aliceAgain.emit("table:join", { tableId, nickname: "Alice" });
  const restoredState = await statePromise;
  const restoredSeat = restoredState.seats.find((s) => s.seatIndex === restoredState.yourSeatIndex);

  console.log(`   Стек Alice после перезапуска сервера: ${restoredSeat?.stack}`);

  aliceAgain.close();
  backend.kill("SIGKILL");

  if (restoredSeat?.stack !== aliceFinalStack) {
    throw new Error(
      `Стек не совпал после перезапуска: было ${aliceFinalStack}, стало ${restoredSeat?.stack}`,
    );
  }

  console.log("✅ Персистентность работает: стек пережил перезапуск backend-процесса");
  process.exit(0);
}

run().catch((err) => {
  console.error("❌ Тест персистентности провален:", err);
  process.exit(1);
});
