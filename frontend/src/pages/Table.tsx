import { Link2, LogOut, UserPlus, Volume2, VolumeX } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ActionBar } from "../components/ActionBar";
import { ChipIcon } from "../components/ChipIcon";
import { HandHistory } from "../components/HandHistory";
import { PokerTable } from "../components/PokerTable";
import { getNickname } from "../lib/identity";
import type { ActionInput, PersonalTableState } from "../lib/protocol";
import { getSocket } from "../lib/socket";
import { isSoundEnabled, playActionSound, playWinSound, playYourTurnSound, setSoundEnabled } from "../lib/sound";

export type TableIntent =
  | { type: "quick"; stakes: string }
  | { type: "create"; stakes: string }
  | { type: "tournament" }
  | { type: "create-tournament" }
  | { type: "join"; tableId: string };

export function Table({ intent, onLeave }: { intent: TableIntent; onLeave: () => void }) {
  const [state, setState] = useState<PersonalTableState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [soundOn, setSoundOn] = useState(isSoundEnabled());
  const startedRef = useRef(false);
  const wasYourTurnRef = useRef(false);
  const lastAnnouncedHandRef = useRef<number | null>(null);

  useEffect(() => {
    const socket = getSocket();
    const nickname = getNickname();

    function handleState(payload: PersonalTableState) {
      setState(payload);
    }
    function handleError(payload: { message: string }) {
      setError(payload.message);
      setTimeout(() => setError(null), 4000);
    }
    function handleJoined(payload: { tableId: string }) {
      window.history.replaceState({}, "", `/table/${payload.tableId}`);
    }

    socket.on("table:state", handleState);
    socket.on("table:error", handleError);
    socket.on("table:joined", handleJoined);

    if (!startedRef.current) {
      startedRef.current = true;
      if (intent.type === "quick") socket.emit("table:quick-play", { nickname, stakes: intent.stakes });
      else if (intent.type === "create") socket.emit("table:create", { nickname, stakes: intent.stakes });
      else if (intent.type === "tournament") socket.emit("table:quick-tournament", { nickname });
      else if (intent.type === "create-tournament") socket.emit("table:create-tournament", { nickname });
      else socket.emit("table:join", { tableId: intent.tableId, nickname });
    }

    return () => {
      socket.off("table:state", handleState);
      socket.off("table:error", handleError);
      socket.off("table:joined", handleJoined);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!state) return;
    const isYourTurnNow = state.actingSeatIndex !== null && state.actingSeatIndex === state.yourSeatIndex;
    if (isYourTurnNow && !wasYourTurnRef.current) {
      playYourTurnSound();
    }
    wasYourTurnRef.current = isYourTurnNow;

    if (state.winners && state.winners.length > 0 && lastAnnouncedHandRef.current !== state.handNumber) {
      lastAnnouncedHandRef.current = state.handNumber;
      playWinSound();
    }
  }, [state]);

  function handleAction(action: ActionInput) {
    playActionSound();
    getSocket().emit("table:action", action);
  }

  function handleToggleSound() {
    const next = !soundOn;
    setSoundOn(next);
    setSoundEnabled(next);
  }

  function handleLeave() {
    getSocket().emit("table:leave");
    window.history.replaceState({}, "", "/");
    onLeave();
  }

  function handleAddBot() {
    getSocket().emit("table:add-bot");
  }

  function handleRebuy() {
    getSocket().emit("table:rebuy");
  }

  function handleCopyLink() {
    navigator.clipboard?.writeText(window.location.href).catch(() => undefined);
  }

  if (!state) {
    return <div className="table-page table-page--loading">Подключаемся к столу…</div>;
  }

  const secondsLeft = state.turnDeadline ? Math.max(0, Math.ceil((state.turnDeadline - now) / 1000)) : null;
  const isYourTurn = state.actingSeatIndex !== null && state.actingSeatIndex === state.yourSeatIndex;
  const totalPot = state.pots.reduce((sum, p) => sum + p.amount, 0);
  const mySeat = state.seats.find((s) => s.seatIndex === state.yourSeatIndex) ?? null;
  const isBustedOut = !!mySeat && mySeat.stack < state.config.bigBlind;
  const canRebuy = isBustedOut && !state.isTournament;
  const isEliminated = isBustedOut && state.isTournament;

  return (
    <div className="table-page">
      <header className="table-header">
        <div className="table-header__left">
          <button className="btn btn--ghost btn--icon" onClick={handleLeave} title="Выйти">
            <LogOut size={16} />
          </button>
          <span className="badge-pill glass">
            {state.isTournament ? "🏆 Турнир · " : ""}
            блайнды {state.config.smallBlind}/{state.config.bigBlind}
          </span>
        </div>
        <div className="table-header__right">
          {mySeat && (
            <div className="balance-pill glass">
              <ChipIcon size={20} />
              <div className="balance-pill__text">
                <span className="balance-pill__amount">{mySeat.stack}</span>
                <span className="balance-pill__label">Ваш стек</span>
              </div>
            </div>
          )}
          <button className="btn btn--ghost btn--icon" onClick={handleToggleSound} title="Звук">
            {soundOn ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>
          <button className="btn btn--ghost btn--icon" onClick={handleCopyLink} title="Скопировать ссылку на стол">
            <Link2 size={16} />
          </button>
          <button className="btn btn--ghost btn--icon" onClick={handleAddBot} title="Добавить бота">
            <UserPlus size={16} />
          </button>
        </div>
      </header>

      <div className="table-body">
        {error && <div className="toast glass">{error}</div>}

        <PokerTable state={state} />

        {isYourTurn && secondsLeft !== null && (
          <div className="turn-timer">Осталось {secondsLeft} с на ход</div>
        )}

        {state.tournamentWinner ? (
          <div className="rebuy-banner rebuy-banner--gold glass">
            <p>
              🏆 Турнир завершён! Победитель: <strong>{state.tournamentWinner.nickname}</strong>
            </p>
            <button className="btn btn--primary btn--big" onClick={handleLeave}>
              Вернуться на главную
            </button>
          </div>
        ) : isEliminated ? (
          <div className="rebuy-banner glass">
            <p>Вы выбыли из турнира — в этом формате без докупки. Удачи в следующий раз!</p>
            <button className="btn btn--ghost btn--big" onClick={handleLeave}>
              Вернуться на главную
            </button>
          </div>
        ) : canRebuy ? (
          <div className="rebuy-banner glass">
            <p>Фишки закончились — это не страшно, они виртуальные и бесплатные.</p>
            <button className="btn btn--primary btn--big" onClick={handleRebuy}>
              Докупить {state.config.startingStack} фишек
            </button>
          </div>
        ) : (
          <ActionBar legalActions={state.yourLegalActions} potSize={totalPot} onAction={handleAction} />
        )}

        <HandHistory hands={state.recentHands} />
        <FairnessFooter state={state} />
      </div>
    </div>
  );
}

function FairnessFooter({ state }: { state: PersonalTableState }) {
  return (
    <details className="panel-collapsible glass">
      <summary>Честность раздачи №{state.handNumber}</summary>
      <div className="fairness__body">
        <p>
          Хэш server seed опубликован <strong>до</strong> раздачи — его нельзя подменить задним числом:
        </p>
        <code>{state.serverSeedHash}</code>
        {state.revealedServerSeed && (
          <>
            <p>Server seed раскрыт после завершения раздачи для проверки:</p>
            <code>{state.revealedServerSeed}</code>
          </>
        )}
        <p>Client seed: <code>{state.clientSeed}</code></p>
      </div>
    </details>
  );
}
