import { Send, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ChatMessage } from "../lib/protocol";

export function ChatPanel({
  messages,
  mySeatIndex,
  onClose,
  onSend,
}: {
  messages: ChatMessage[];
  mySeatIndex: number | null;
  onClose: () => void;
  onSend: (text: string) => void;
}) {
  const [text, setText] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  function handleSend() {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setText("");
  }

  return (
    <div className="chat-panel glass">
      <div className="chat-panel__header">
        <span>Чат стола</span>
        <button className="btn btn--ghost btn--icon" onClick={onClose} aria-label="Закрыть чат">
          <X size={15} />
        </button>
      </div>
      <div className="chat-panel__list" ref={listRef}>
        {messages.length === 0 && <p className="chat-panel__empty">Пока тихо — напишите первым.</p>}
        {messages.map((m) => (
          <div
            key={m.id}
            className={`chat-message ${m.seatIndex === mySeatIndex ? "chat-message--own" : ""}`}
          >
            <span className="chat-message__author">{m.nickname}</span>
            <span className="chat-message__text">{m.text}</span>
          </div>
        ))}
      </div>
      <div className="chat-panel__input-row">
        <input
          className="chat-panel__input"
          placeholder="Сообщение…"
          value={text}
          maxLength={240}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSend();
          }}
        />
        <button className="btn btn--primary btn--icon" onClick={handleSend} aria-label="Отправить">
          <Send size={15} />
        </button>
      </div>
    </div>
  );
}
