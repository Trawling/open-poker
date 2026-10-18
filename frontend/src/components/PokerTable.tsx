import type { CSSProperties } from "react";
import type { PersonalTableState } from "../lib/protocol";
import { ChipIcon } from "./ChipIcon";
import { PlayingCard } from "./Card";
import { Seat } from "./Seat";

const STREET_LABEL: Record<string, string> = {
  preflop: "Префлоп",
  flop: "Флоп",
  turn: "Тёрн",
  river: "Ривер",
  showdown: "Вскрытие",
};

const SEAT_RADIUS_X = 43;
const SEAT_RADIUS_Y = 39;
/** Карты лежат ближе к центру стола, чем аватар игрока — как в реальной раздаче. */
const CARDS_RADIUS_X = 29;
const CARDS_RADIUS_Y = 25;

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
        <div className="pot-pill glass">
          <ChipIcon size={13} />
          Банк: {totalPot}
        </div>
        {state.winners && state.winners.length > 0 && (
          <div className="felt__winners glass">
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
        const seatStyle: CSSProperties = {
          left: `${50 + SEAT_RADIUS_X * Math.cos(angle)}%`,
          top: `${50 + SEAT_RADIUS_Y * Math.sin(angle)}%`,
        };
        const showFaceUp = seat.holeCards !== null;
        const cardsStyle: CSSProperties = {
          left: `${50 + CARDS_RADIUS_X * Math.cos(angle)}%`,
          top: `${50 + CARDS_RADIUS_Y * Math.sin(angle)}%`,
        };

        return (
          <div key={seat.seatIndex}>
            <Seat
              seat={seat}
              isYou={seat.seatIndex === state.yourSeatIndex}
              isWinner={winnerSeatIndexes.has(seat.seatIndex)}
              style={seatStyle}
            />
            {seat.hasHoleCards && !seat.folded && (
              <div className="hole-cards" style={cardsStyle}>
                <PlayingCard
                  key={`h0-${showFaceUp ? seat.holeCards?.[0] : "back"}`}
                  card={showFaceUp ? seat.holeCards?.[0] : undefined}
                  faceDown={!showFaceUp}
                  small
                />
                <PlayingCard
                  key={`h1-${showFaceUp ? seat.holeCards?.[1] : "back"}`}
                  card={showFaceUp ? seat.holeCards?.[1] : undefined}
                  faceDown={!showFaceUp}
                  small
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
