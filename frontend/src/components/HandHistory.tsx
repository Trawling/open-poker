import { useTranslation } from "react-i18next";
import type { HandHistoryEntry } from "../lib/protocol";
import { PlayingCard } from "./Card";

export function HandHistory({ hands }: { hands: HandHistoryEntry[] }) {
  const { t } = useTranslation();
  if (hands.length === 0) return null;

  return (
    <details className="panel-collapsible glass">
      <summary>{t("table.handHistory.summary", { count: hands.length })}</summary>
      <div className="history__list">
        {hands.map((hand) => (
          <div key={hand.handNumber} className="history__item">
            <div className="history__header">
              <span>{t("table.handHistory.handNumber", { number: hand.handNumber })}</span>
              <span className="history__pot">{t("table.handHistory.pot", { amount: hand.potTotal })}</span>
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
                  {t("table.handHistory.winnerLine", { nickname: w.nickname, amount: w.amount })}
                  {w.handDescription ? ` (${t(`hand.${w.handDescription}`)})` : ""}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </details>
  );
}
