import type { CSSProperties } from "react";
import type { PublicSeatView } from "../lib/protocol";
import { Avatar } from "./Avatar";
import { PlayingCard } from "./Card";

const ACTION_LABEL: Record<string, string> = {
  fold: "Фолд",
  check: "Чек",
  call: "Колл",
  bet: "Ставка",
  raise: "Рейз",
};

export function Seat({
  seat,
  isYou,
  isWinner,
  style,
}: {
  seat: PublicSeatView;
  isYou: boolean;
  isWinner?: boolean;
  style?: CSSProperties;
}) {
  if (!seat.id) {
    return (
      <div className="seat seat--empty" style={style}>
        <span>свободно</span>
      </div>
    );
  }

  const showFaceUp = seat.holeCards !== null;

  return (
    <div
      className={[
        "seat",
        seat.isActing ? "seat--active" : "",
        seat.folded ? "seat--folded" : "",
        seat.sittingOut ? "seat--sitting-out" : "",
        isWinner ? "seat--winner" : "",
      ].join(" ")}
      style={style}
    >
      <div className="seat__cards">
        {seat.hasHoleCards && !seat.folded ? (
          <>
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
          </>
        ) : null}
      </div>
      <Avatar seed={seat.id} nickname={seat.nickname ?? "?"} />
      <div className="seat__info">
        <div className="seat__name-row">
          <span className="seat__name">
            {seat.nickname}
            {isYou ? " (вы)" : ""}
          </span>
          {seat.isDealer && <span className="badge badge--dealer">D</span>}
          {seat.isSmallBlind && <span className="badge">SB</span>}
          {seat.isBigBlind && <span className="badge">BB</span>}
          {seat.isBot && <span className="badge badge--bot">бот</span>}
        </div>
        <div className="seat__stack">{seat.stack} фишек</div>
        {seat.lastAction && !seat.sittingOut && (
          <div className="seat__action">{ACTION_LABEL[seat.lastAction] ?? seat.lastAction}</div>
        )}
      </div>
      {seat.contributedStreet > 0 && <div className="seat__bet">{seat.contributedStreet}</div>}
    </div>
  );
}
