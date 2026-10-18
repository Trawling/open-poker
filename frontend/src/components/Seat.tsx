import type { CSSProperties } from "react";
import type { PublicSeatView } from "../lib/protocol";
import { Avatar } from "./Avatar";
import { ChipIcon } from "./ChipIcon";

const ACTION_LABEL: Record<string, string> = {
  fold: "Фолд",
  check: "Чек",
  call: "Колл",
  bet: "Ставка",
  raise: "Рейз",
};

export function Seat({ seat, isYou, isWinner, style }: {
  seat: PublicSeatView;
  isYou: boolean;
  isWinner?: boolean;
  style?: CSSProperties;
}) {
  if (!seat.id) {
    return (
      <div className="seat seat--empty glass" style={style}>
        <span>свободно</span>
      </div>
    );
  }

  return (
    <div
      className={[
        "seat",
        "glass",
        seat.isActing ? "seat--active" : "",
        seat.folded ? "seat--folded" : "",
        seat.sittingOut ? "seat--sitting-out" : "",
        isWinner ? "seat--winner" : "",
      ].join(" ")}
      style={style}
    >
      <Avatar seed={seat.id} nickname={seat.nickname ?? "?"} />
      <div className="seat__info">
        <div className="seat__name-row">
          <span>
            {seat.nickname}
            {isYou ? " (вы)" : ""}
          </span>
          {seat.isDealer && <span className="badge badge--dealer">D</span>}
          {seat.isSmallBlind && <span className="badge">SB</span>}
          {seat.isBigBlind && <span className="badge">BB</span>}
          {seat.isBot && <span className="badge badge--bot">бот</span>}
        </div>
        <div className="seat__stack">
          <ChipIcon size={11} />
          {seat.stack}
        </div>
        {seat.lastAction && !seat.sittingOut && (
          <div className="seat__action">{ACTION_LABEL[seat.lastAction] ?? seat.lastAction}</div>
        )}
      </div>
      {seat.contributedStreet > 0 && (
        <div className="seat__bet">
          <ChipIcon size={10} />
          {seat.contributedStreet}
        </div>
      )}
    </div>
  );
}
