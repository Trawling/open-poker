import type { Card as CardType } from "../lib/protocol";

const SUIT_SYMBOL: Record<string, string> = {
  s: "♠",
  h: "♥",
  d: "♦",
  c: "♣",
};

const RANK_LABEL: Record<string, string> = {
  T: "10",
};

export function PlayingCard({ card, faceDown, small }: { card?: CardType; faceDown?: boolean; small?: boolean }) {
  const sizeClass = small ? "card card--small" : "card";

  if (faceDown || !card) {
    return <div className={`${sizeClass} card--back`} aria-hidden="true" />;
  }

  const rank = card[0];
  const suit = card[1];
  const isRed = suit === "h" || suit === "d";

  return (
    <div className={`${sizeClass} ${isRed ? "card--red" : "card--black"}`}>
      <span className="card__rank">{RANK_LABEL[rank] ?? rank}</span>
      <span className="card__suit">{SUIT_SYMBOL[suit] ?? suit}</span>
    </div>
  );
}
