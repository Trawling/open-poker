// Проверяет чат за столом: сообщение доходит до другого игрока почти
// мгновенно отдельным событием table:chat, а история чата присутствует
// в table:state (нужно для переподключения).
import { io } from "socket.io-client";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:4000";

function makeClient(name) {
  return io(BACKEND_URL, { auth: { guestId: `chat-${name}-${Date.now()}`, nickname: name } });
}

function waitFor(socket, event) {
  return new Promise((resolve) => socket.once(event, resolve));
}

async function run() {
  console.log(`Подключаемся к ${BACKEND_URL} ...`);
  const alice = makeClient("Alice");
  const bob = makeClient("Bob");
  await Promise.all([waitFor(alice, "connect"), waitFor(bob, "connect")]);

  let chatFoundInState = false;
  let resolveChatInState;
  const chatInStatePromise = new Promise((resolve) => (resolveChatInState = resolve));

  // Оба игрока сразу же реагируют на свой ход (чтобы раздача не зависала
  // в ожидании хода того, кого никто не контролирует) и заодно следят,
  // не появилось ли наше сообщение в recentChat.
  for (const socket of [alice, bob]) {
    socket.on("table:state", (state) => {
      if (!chatFoundInState && state.recentChat?.some((m) => m.text === "Привет из теста!")) {
        chatFoundInState = true;
        resolveChatInState();
      }
      const legal = state.yourLegalActions;
      if (legal?.canCheck) socket.emit("table:action", { type: "check" });
      else if (legal?.canCall) socket.emit("table:action", { type: "call" });
    });
  }

  alice.emit("table:create", { nickname: "Alice" });
  const joined = await waitFor(alice, "table:joined");
  bob.emit("table:join", { tableId: joined.tableId, nickname: "Bob" });
  await waitFor(bob, "table:joined");
  await new Promise((r) => setTimeout(r, 500));

  const bobReceived = waitFor(bob, "table:chat");
  alice.emit("table:chat-send", { text: "Привет из теста!" });
  const msg = await Promise.race([
    bobReceived,
    new Promise((_, reject) => setTimeout(() => reject(new Error("Bob не получил сообщение за 5с")), 5000)),
  ]);

  if (msg.text !== "Привет из теста!" || msg.nickname !== "Alice") {
    throw new Error(`Неожиданное сообщение: ${JSON.stringify(msg)}`);
  }
  console.log("✅ Сообщение доставлено мгновенно:", msg.nickname, "->", msg.text);

  await Promise.race([
    chatInStatePromise,
    new Promise((_, reject) => setTimeout(() => reject(new Error("recentChat не появился в table:state за 10с")), 10000)),
  ]);
  console.log("✅ История чата присутствует в table:state");

  alice.close();
  bob.close();
  process.exit(0);
}

run().catch((err) => {
  console.error("❌ Тест чата провален:", err);
  process.exit(1);
});
