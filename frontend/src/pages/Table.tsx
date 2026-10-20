import { Link2, LogOut, MessageCircle, UserPlus, Volume2, VolumeX } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { ActionBar } from "../components/ActionBar";
import { ChatPanel } from "../components/ChatPanel";
import { ChipIcon } from "../components/ChipIcon";
import { HandHistory } from "../components/HandHistory";
import { LanguageSwitcher } from "../components/LanguageSwitcher";
import { PokerTable } from "../components/PokerTable";
import { getNickname } from "../lib/identity";
import type { ActionInput, ChatMessage, PersonalTableState } from "../lib/protocol";
import { getSocket } from "../lib/socket";
import { isSoundEnabled, playActionSound, playChatSound, playWinSound, playYourTurnSound, setSoundEnabled } from "../lib/sound";

export type TableIntent =
  | { type: "quick"; stakes: string }
  | { type: "create"; stakes: string }
  | { type: "tournament" }
  | { type: "create-tournament" }
  | { type: "join"; tableId: string };

function mergeChatMessages(existing: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  const byId = new Map(existing.map((m) => [m.id, m]));
  for (const m of incoming) byId.set(m.id, m);
  return [...byId.values()].sort((a, b) => a.timestamp - b.timestamp);
}

export function Table({ intent, onLeave }: { intent: TableIntent; onLeave: () => void }) {
  const { t } = useTranslation();
  const [state, setState] = useState<PersonalTableState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [soundOn, setSoundOn] = useState(isSoundEnabled());
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatOpen, setChatOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const startedRef = useRef(false);
  const wasYourTurnRef = useRef(false);
  const lastAnnouncedHandRef = useRef<number | null>(null);
  const chatOpenRef = useRef(chatOpen);
  chatOpenRef.current = chatOpen;

  useEffect(() => {
    const socket = getSocket();
    const nickname = getNickname();

    function handleState(payload: PersonalTableState) {
      setState(payload);
      if (payload.recentChat?.length) {
        setChatMessages((prev) => mergeChatMessages(prev, payload.recentChat));
      }
    }
    function handleChat(message: ChatMessage) {
      setChatMessages((prev) => mergeChatMessages(prev, [message]));
      if (!chatOpenRef.current) {
        setUnreadCount((n) => n + 1);
        playChatSound();
      }
    }
    function handleError(payload: { code: string; params?: Record<string, string | number> }) {
      const key = `errors.${payload.code}`;
      const text = t(key, payload.params);
      setError(text === key ? t("errors.unknown") : text);
      setTimeout(() => setError(null), 4000);
    }
    function handleJoined(payload: { tableId: string }) {
      window.history.replaceState({}, "", `/table/${payload.tableId}`);
    }

    socket.on("table:state", handleState);
    socket.on("table:chat", handleChat);
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
      socket.off("table:chat", handleChat);
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

  function handleToggleChat() {
    setChatOpen((v) => !v);
    setUnreadCount(0);
  }

  function handleSendChat(text: string) {
    getSocket().emit("table:chat-send", { text });
  }

  if (!state) {
    return <div className="table-page table-page--loading">{t("table.connecting")}</div>;
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
          <button className="btn btn--ghost btn--icon" onClick={handleLeave} title={t("table.leaveTitle") ?? undefined}>
            <LogOut size={16} />
          </button>
          <span className="badge-pill glass">
            {state.isTournament ? t("table.tournamentPrefix") : ""}
            {t("table.blinds", { small: state.config.smallBlind, big: state.config.bigBlind })}
          </span>
        </div>
        <div className="table-header__right">
          {mySeat && (
            <div className="balance-pill glass">
              <ChipIcon size={20} />
              <div className="balance-pill__text">
                <span className="balance-pill__amount">{mySeat.stack}</span>
                <span className="balance-pill__label">{t("table.yourStack")}</span>
              </div>
            </div>
          )}
          <LanguageSwitcher />
          <button className="btn btn--ghost btn--icon" onClick={handleToggleSound} title={t("table.soundTitle") ?? undefined}>
            {soundOn ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>
          <button className="btn btn--ghost btn--icon" onClick={handleCopyLink} title={t("table.copyLinkTitle") ?? undefined}>
            <Link2 size={16} />
          </button>
          <button className="btn btn--ghost btn--icon" onClick={handleAddBot} title={t("table.addBotTitle") ?? undefined}>
            <UserPlus size={16} />
          </button>
          <button
            className="btn btn--ghost btn--icon icon-badge"
            onClick={handleToggleChat}
            title={t("chat.title") ?? undefined}
          >
            <MessageCircle size={16} />
            {unreadCount > 0 && <span className="icon-badge__dot" />}
          </button>
        </div>
      </header>

      <div className="table-body">
        {error && <div className="toast glass">{error}</div>}

        <PokerTable state={state} />

        {isYourTurn && secondsLeft !== null && (
          <div className="turn-timer">{t("table.timeLeft", { seconds: secondsLeft })}</div>
        )}

        {state.tournamentWinner ? (
          <div className="rebuy-banner rebuy-banner--gold glass">
            <p>
              <Trans
                i18nKey="table.tournamentFinished"
                values={{ nickname: state.tournamentWinner.nickname }}
                components={{ strong: <strong /> }}
              />
            </p>
            <button className="btn btn--primary btn--big" onClick={handleLeave}>
              {t("table.backToHome")}
            </button>
          </div>
        ) : isEliminated ? (
          <div className="rebuy-banner glass">
            <p>{t("table.eliminatedMessage")}</p>
            <button className="btn btn--ghost btn--big" onClick={handleLeave}>
              {t("table.backToHome")}
            </button>
          </div>
        ) : canRebuy ? (
          <div className="rebuy-banner glass">
            <p>{t("table.bustedOutMessage")}</p>
            <button className="btn btn--primary btn--big" onClick={handleRebuy}>
              {t("table.rebuyButton", { amount: state.config.startingStack })}
            </button>
          </div>
        ) : (
          <ActionBar legalActions={state.yourLegalActions} potSize={totalPot} onAction={handleAction} />
        )}

        <HandHistory hands={state.recentHands} />
        <FairnessFooter state={state} />
      </div>

      {chatOpen && (
        <ChatPanel
          messages={chatMessages}
          mySeatIndex={state.yourSeatIndex}
          onClose={() => setChatOpen(false)}
          onSend={handleSendChat}
        />
      )}
    </div>
  );
}

function FairnessFooter({ state }: { state: PersonalTableState }) {
  const { t } = useTranslation();
  return (
    <details className="panel-collapsible glass">
      <summary>{t("table.fairness.summary", { number: state.handNumber })}</summary>
      <div className="fairness__body">
        <p>
          <Trans i18nKey="table.fairness.hashIntro" components={{ strong: <strong /> }} />
        </p>
        <code>{state.serverSeedHash}</code>
        {state.revealedServerSeed && (
          <>
            <p>{t("table.fairness.seedRevealed")}</p>
            <code>{state.revealedServerSeed}</code>
          </>
        )}
        <p>
          {t("table.fairness.clientSeed")} <code>{state.clientSeed}</code>
        </p>
      </div>
    </details>
  );
}
