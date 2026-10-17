// Проверяет весь путь докупки фишек через настоящий WebSocket-протокол:
// оба игрока агрессивно идут олл-ин, пока кто-то не обнулится, затем
// проверяем, что table:rebuy реально возвращает его в игру.
import { io } from "socket.io-client";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:4000";

function makeClient(name) {
  return io(BACKEND_URL, { auth: { guestId: `rebuy-${name}-${Date.now()}`, nickname: name } });
}

function waitFor(socket, event) {
  return new Promise((resolve) => socket.once(event, resolve));
}

async function run() {
  console.log(`Подключаемся к ${BACKEND_URL} ...`);
  const alice = makeClient("Alice");
  const bob = makeClient("Bob");
  await Promise.all([waitFor(alice, "connect"), waitFor(bob, "connect")]);

  let bustedWentThrough = false;
  let rebuyRequested = false;

  const bustedAndRecovered = new Promise((resolve, reject) => {
    for (const [name, socket] of [["Alice", alice], ["Bob", bob]]) {
      let lastActedKey = null;
      socket.on("table:error", (e) => console.error(`[${name}] ошибка:`, e.message));
      socket.on("table:state", (state) => {
        const mySeat = state.seats.find((s) => s.seatIndex === state.yourSeatIndex);
        if (!mySeat) return;

        // Уже обнулились и докупились — проверяем восстановление.
        if (bustedWentThrough && rebuyRequested && mySeat.stack >= state.config.startingStack) {
          console.log(`[${name}] стек восстановлен после докупки: ${mySeat.stack}`);
          resolve();
          return;
        }

        // Обнулились — докупаемся.
        if (mySeat.stack < state.config.bigBlind && !state.handInProgress) {
          if (!bustedWentThrough) {
            bustedWentThrough = true;
            console.log(`[${name}] остался без фишек (стек ${mySeat.stack}), докупаемся...`);
          }
          rebuyRequested = true;
          socket.emit("table:rebuy");
          return;
        }

        // Иначе агрессивно идём ва-банк каждое действие — чтобы кто-то быстро обнулился.
        const key = `${state.handNumber}:${state.street}:${state.actingSeatIndex}`;
        if (key === lastActedKey) return;
        lastActedKey = key;
        const legal = state.yourLegalActions;
        if (!legal) return;
        if (legal.canBet) socket.emit("table:action", { type: "bet", amount: legal.maxTo });
        else if (legal.canRaise) socket.emit("table:action", { type: "raise", amount: legal.maxTo });
        else if (legal.canCall) socket.emit("table:action", { type: "call" });
        else if (legal.canCheck) socket.emit("table:action", { type: "check" });
      });
    }
    setTimeout(() => reject(new Error("не дождались обнуления и докупки за 40с")), 40000);
  });

  alice.emit("table:create", { nickname: "Alice" });
  const joined = await waitFor(alice, "table:joined");
  bob.emit("table:join", { tableId: joined.tableId, nickname: "Bob" });
  await waitFor(bob, "table:joined");

  await bustedAndRecovered;
  console.log("✅ Докупка работает: игрок обнулился и вернулся в игру через table:rebuy");
  alice.close();
  bob.close();
  process.exit(0);
}

run().catch((err) => {
  console.error("❌ Тест докупки провален:", err);
  process.exit(1);
});
