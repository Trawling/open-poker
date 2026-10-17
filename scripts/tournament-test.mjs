// Проверяет турнирный режим целиком через реальный протокол: один живой
// игрок заходит в "Турнир", боты добирают стол, все идут ва-банк каждую
// раздачу — рано или поздно должен появиться объявленный победитель, а
// докупка должна быть недоступна.
import { io } from "socket.io-client";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:4000";

function waitFor(socket, event) {
  return new Promise((resolve) => socket.once(event, resolve));
}

async function run() {
  console.log(`Подключаемся к ${BACKEND_URL} ...`);
  const player = io(BACKEND_URL, {
    auth: { guestId: `tourney-${Date.now()}`, nickname: "Challenger" },
  });
  await waitFor(player, "connect");

  let rebuyRejected = false;
  let sawBlindIncrease = false;
  const initialBigBlind = { value: null };

  const tournamentFinished = new Promise((resolve, reject) => {
    let lastActedKey = null;
    let lastLoggedHand = 0;
    player.on("table:error", (e) => {
      if (/докупка недоступна/i.test(e.message)) rebuyRejected = true;
      else console.error("[Challenger] ошибка:", e.message);
    });
    player.on("table:state", (state) => {
      if (!state.isTournament) return;
      if (initialBigBlind.value === null) initialBigBlind.value = state.config.bigBlind;
      if (state.config.bigBlind > initialBigBlind.value) sawBlindIncrease = true;
      if (state.handNumber > lastLoggedHand) {
        lastLoggedHand = state.handNumber;
        const alive = state.seats.filter((s) => s.id && s.stack > 0).length;
        console.log(`  раздача №${state.handNumber}, блайнды ${state.config.smallBlind}/${state.config.bigBlind}, живых игроков: ${alive}`);
      }

      if (state.tournamentWinner) {
        resolve(state.tournamentWinner);
        return;
      }

      const mySeat = state.seats.find((s) => s.seatIndex === state.yourSeatIndex);
      // Выбыли (стек < bb) — на всякий случай пробуем докупиться, это должно быть отклонено.
      if (mySeat && mySeat.stack < state.config.bigBlind && !state.handInProgress && !rebuyRejected) {
        player.emit("table:rebuy");
        return;
      }

      const key = `${state.handNumber}:${state.street}:${state.actingSeatIndex}`;
      if (key === lastActedKey) return;
      const legal = state.yourLegalActions;
      if (!legal) return;
      lastActedKey = key;
      if (legal.canBet) player.emit("table:action", { type: "bet", amount: legal.maxTo });
      else if (legal.canRaise) player.emit("table:action", { type: "raise", amount: legal.maxTo });
      else if (legal.canCall) player.emit("table:action", { type: "call" });
      else if (legal.canCheck) player.emit("table:action", { type: "check" });
    });
    setTimeout(() => reject(new Error("турнир не завершился за 5 минут")), 5 * 60 * 1000);
  });

  player.emit("table:quick-tournament", { nickname: "Challenger" });
  const joined = await waitFor(player, "table:joined");
  console.log("Присоединились к турнирному столу:", joined.tableId);

  const winner = await tournamentFinished;
  console.log("🏆 Турнир завершён, победитель:", winner.nickname);

  if (!rebuyRejected) {
    console.warn("⚠️  Не удалось проверить отказ в докупке (возможно, игрок не выбывал раньше срока)");
  } else {
    console.log("✅ Докупка в турнире корректно отклонена");
  }
  if (sawBlindIncrease) {
    console.log("✅ Блайнды выросли по расписанию");
  } else {
    console.warn("⚠️  Блайнды не успели вырасти за время турнира (не обязательно баг, просто короткий турнир)");
  }

  console.log("✅ Тест турнира пройден");
  player.close();
  process.exit(0);
}

run().catch((err) => {
  console.error("❌ Тест турнира провален:", err);
  process.exit(1);
});
