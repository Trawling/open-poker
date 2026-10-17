import type { CSSProperties } from "react";
import type { PersonalTableState } from "../lib/protocol";
import { PlayingCard } from "./Card";
import { Seat } from "./Seat";

const STREET_LABEL: Record<string, string> = {
  preflop: "Префлоп",
  flop: "Флоп",
  turn: "Тёрн",
  river: "Ривер",
  showdown: "Вскрытие",
};

export function PokerTable({ state }: { state: PersonalTableState }) {
  const n = state.seats.length;
  const youIndex = state.yourSeatIndex ?? 0;

  const totalPot = state.pots.reduce((sum, p) => sum + p.amount, 0);
  const winnerSeatIndexes = new Set((state.winners ?? []).map((w) => w.seatIndex));

  return (
    <div className="felt">
      <div className="felt__center">
        <div className="felt__street">{STREET_LABEL[state.street] ?? state.street}</div>
        <div className="felt__community">
          {Array.from({ length: 5 }).map((_, i) => (
            <PlayingCard
              key={`c${i}-${state.communityCards[i] ?? "empty"}`}
              card={state.communityCards[i]}
              faceDown={false}
              empty={!state.communityCards[i]}
            />
          ))}
        </div>
        <div className="felt__pot">Банк: {totalPot}</div>
        {state.winners && state.winners.length > 0 && (
          <div className="felt__winners">
            {state.winners.map((w, i) => (
              <div key={i}>
                {state.seats.find((s) => s.seatIndex === w.seatIndex)?.nickname} выигрывает {w.amount}
                {w.handDescription ? ` (${w.handDescription})` : ""}
              </div>
            ))}
          </div>
        )}
      </div>

      {state.seats.map((seat) => {
        const p = (seat.seatIndex - youIndex + n) % n;
        const angle = Math.PI / 2 + (2 * Math.PI * p) / n;
        const radiusX = 44;
        const radiusY = 40;
        const left = 50 + radiusX * Math.cos(angle);
        const top = 50 + radiusY * Math.sin(angle);
        const style: CSSProperties = {
          left: `${left}%`,
          top: `${top}%`,
        };
        return (
          <Seat
            key={seat.seatIndex}
            seat={seat}
            isYou={seat.seatIndex === state.yourSeatIndex}
            isWinner={winnerSeatIndexes.has(seat.seatIndex)}
            style={style}
          />
        );
      })}
    </div>
  );
}
