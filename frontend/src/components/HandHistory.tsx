import type { HandHistoryEntry } from "../lib/protocol";
import { PlayingCard } from "./Card";

export function HandHistory({ hands }: { hands: HandHistoryEntry[] }) {
  if (hands.length === 0) return null;

  return (
    <details className="history">
      <summary>История раздач ({hands.length})</summary>
      <div className="history__list">
        {hands.map((hand) => (
          <div key={hand.handNumber} className="history__item">
            <div className="history__header">
              <span>Раздача №{hand.handNumber}</span>
              <span className="history__pot">банк {hand.potTotal}</span>
            </div>
            {hand.communityCards.length > 0 && (
              <div className="history__cards">
                {hand.communityCards.map((card, i) => (
                  <PlayingCard key={i} card={card} small />
                ))}
              </div>
            )}
            <div className="history__winners">
              {hand.winners.map((w, i) => (
                <div key={i}>
                  {w.nickname} +{w.amount}
                  {w.handDescription ? ` (${w.handDescription})` : ""}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </details>
  );
}
