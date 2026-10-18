import { useEffect, useRef, useState, type CSSProperties } from "react";
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
const CENTER = { left: 50, top: 50 };

interface Point {
  left: number;
  top: number;
}

function seatPoint(seatIndex: number, youIndex: number, n: number, radiusX: number, radiusY: number): Point {
  const p = (seatIndex - youIndex + n) % n;
  const angle = Math.PI / 2 + (2 * Math.PI * p) / n;
  return { left: 50 + radiusX * Math.cos(angle), top: 50 + radiusY * Math.sin(angle) };
}

interface FlyingChip {
  id: string;
  from: Point;
  to: Point;
}

/** Анимированная фишка, летящая от одной точки стола к другой (ставка → банк, банк → победитель). */
function FlyingChipDot({ from, to }: { from: Point; to: Point }) {
  const [pos, setPos] = useState(from);
  useEffect(() => {
    const raf1 = requestAnimationFrame(() => {
      requestAnimationFrame(() => setPos(to));
    });
    return () => cancelAnimationFrame(raf1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="flying-chip" style={{ left: `${pos.left}%`, top: `${pos.top}%` }}>
      <ChipIcon size={14} />
    </div>
  );
}

export function PokerTable({ state }: { state: PersonalTableState }) {
  const n = state.seats.length;
  const youIndex = state.yourSeatIndex ?? 0;

  const totalPot = state.pots.reduce((sum, p) => sum + p.amount, 0);
  const winnerSeatIndexes = new Set((state.winners ?? []).map((w) => w.seatIndex));

  const [flyingChips, setFlyingChips] = useState<FlyingChip[]>([]);
  const prevContributed = useRef<Map<number, number>>(new Map());
  const prevHadWinners = useRef(false);

  useEffect(() => {
    const newChips: FlyingChip[] = [];

    for (const seat of state.seats) {
      if (!seat.id) continue;
      const prev = prevContributed.current.get(seat.seatIndex) ?? 0;
      if (seat.contributedStreet > prev) {
        const from = seatPoint(seat.seatIndex, youIndex, n, SEAT_RADIUS_X, SEAT_RADIUS_Y);
        newChips.push({ id: `bet-${seat.seatIndex}-${Date.now()}-${Math.random()}`, from, to: CENTER });
      }
      prevContributed.current.set(seat.seatIndex, seat.contributedStreet);
    }

    const hasWinnersNow = !!(state.winners && state.winners.length > 0);
    if (hasWinnersNow && !prevHadWinners.current) {
      for (const w of state.winners ?? []) {
        const to = seatPoint(w.seatIndex, youIndex, n, SEAT_RADIUS_X, SEAT_RADIUS_Y);
        newChips.push({ id: `win-${w.seatIndex}-${Date.now()}-${Math.random()}`, from: CENTER, to });
      }
    }
    prevHadWinners.current = hasWinnersNow;

    if (newChips.length > 0) {
      setFlyingChips((old) => [...old, ...newChips]);
      const ids = new Set(newChips.map((c) => c.id));
      setTimeout(() => {
        setFlyingChips((old) => old.filter((c) => !ids.has(c.id)));
      }, 650);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.seats, state.winners, state.handNumber]);

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
        const seatPos = seatPoint(seat.seatIndex, youIndex, n, SEAT_RADIUS_X, SEAT_RADIUS_Y);
        const seatStyle: CSSProperties = { left: `${seatPos.left}%`, top: `${seatPos.top}%` };
        const showFaceUp = seat.holeCards !== null;
        const cardsPos = seatPoint(seat.seatIndex, youIndex, n, CARDS_RADIUS_X, CARDS_RADIUS_Y);
        const cardsStyle: CSSProperties = { left: `${cardsPos.left}%`, top: `${cardsPos.top}%` };

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

      {flyingChips.map((chip) => (
        <FlyingChipDot key={chip.id} from={chip.from} to={chip.to} />
      ))}
    </div>
  );
}
