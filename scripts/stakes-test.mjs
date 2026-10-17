// Проверяет: 1) выбранный уровень ставок реально применяется к столу,
// 2) быстрая игра на разных ставках не сводит игроков за один стол.
import { io } from "socket.io-client";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:4000";

function makeClient(name) {
  return io(BACKEND_URL, { auth: { guestId: `stakes-${name}-${Date.now()}`, nickname: name } });
}

function waitFor(socket, event) {
  return new Promise((resolve) => socket.once(event, resolve));
}

async function run() {
  console.log(`Подключаемся к ${BACKEND_URL} ...`);

  // 1) Стол с высокими ставками реально получает блайнды 200/400.
  const high = makeClient("High");
  await waitFor(high, "connect");
  high.emit("table:create", { nickname: "High", stakes: "high" });
  const highJoined = await waitFor(high, "table:joined");
  const highState = await waitFor(high, "table:state");
  if (highState.config.bigBlind !== 400 || highState.config.startingStack !== 20000) {
    throw new Error(
      `Ожидались высокие ставки (bb=400, stack=20000), получено: bb=${highState.config.bigBlind}, stack=${highState.config.startingStack}`,
    );
  }
  console.log("✅ Высокие ставки применились к столу:", highJoined.tableId);
  high.close();

  // 2) Быстрая игра на низких и высоких ставках не пересекается.
  const low1 = makeClient("Low1");
  const highQuick = makeClient("HighQuick");
  await Promise.all([waitFor(low1, "connect"), waitFor(highQuick, "connect")]);
  low1.emit("table:quick-play", { nickname: "Low1", stakes: "low" });
  highQuick.emit("table:quick-play", { nickname: "HighQuick", stakes: "high" });
  const [lowJoined, highQuickJoined] = await Promise.all([
    waitFor(low1, "table:joined"),
    waitFor(highQuick, "table:joined"),
  ]);
  if (lowJoined.tableId === highQuickJoined.tableId) {
    throw new Error("Быстрая игра на разных ставках свела игроков за один стол");
  }
  console.log("✅ Быстрая игра на разных ставках разводит игроков по разным столам");
  low1.close();
  highQuick.close();

  process.exit(0);
}

run().catch((err) => {
  console.error("❌ Тест ставок провален:", err);
  process.exit(1);
});
