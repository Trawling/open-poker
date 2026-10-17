import { useEffect, useState } from "react";
import type { ActionInput, LegalActions } from "../lib/protocol";

export function ActionBar({
  legalActions,
  potSize,
  onAction,
}: {
  legalActions: LegalActions | null;
  potSize: number;
  onAction: (action: ActionInput) => void;
}) {
  const canAct = legalActions && (legalActions.canBet || legalActions.canRaise || legalActions.canCall || legalActions.canCheck || legalActions.canFold);
  const raiseFloor = legalActions ? (legalActions.canBet ? legalActions.minBet : legalActions.minRaiseTo) : 0;
  const raiseCeil = legalActions?.maxTo ?? 0;

  const [amount, setAmount] = useState(raiseFloor);

  useEffect(() => {
    setAmount(raiseFloor);
  }, [raiseFloor, raiseCeil]);

  if (!canAct || !legalActions) {
    return <div className="action-bar action-bar--idle">Ожидайте своего хода…</div>;
  }

  const clamp = (v: number) => Math.max(raiseFloor, Math.min(raiseCeil, Math.round(v)));

  return (
    <div className="action-bar">
      <div className="action-bar__buttons">
        {legalActions.canFold && (
          <button className="btn btn--ghost" onClick={() => onAction({ type: "fold" })}>
            Фолд
          </button>
        )}
        {legalActions.canCheck && (
          <button className="btn" onClick={() => onAction({ type: "check" })}>
            Чек
          </button>
        )}
        {legalActions.canCall && (
          <button className="btn btn--primary" onClick={() => onAction({ type: "call" })}>
            Колл {legalActions.callAmount}
          </button>
        )}
      </div>

      {(legalActions.canBet || legalActions.canRaise) && (
        <div className="action-bar__raise">
          <input
            type="range"
            min={raiseFloor}
            max={raiseCeil}
            value={amount}
            onChange={(e) => setAmount(clamp(Number(e.target.value)))}
          />
          <input
            type="number"
            className="action-bar__amount"
            min={raiseFloor}
            max={raiseCeil}
            value={amount}
            onChange={(e) => setAmount(clamp(Number(e.target.value)))}
          />
          <div className="action-bar__quick">
            <button className="btn btn--ghost btn--small" onClick={() => setAmount(raiseFloor)}>
              Мин
            </button>
            {potSize > 0 && (
              <button className="btn btn--ghost btn--small" onClick={() => setAmount(clamp(potSize))}>
                Пот
              </button>
            )}
            <button className="btn btn--ghost btn--small" onClick={() => setAmount(raiseCeil)}>
              Олл-ин
            </button>
          </div>
          <button
            className="btn btn--primary"
            onClick={() => onAction({ type: legalActions.canBet ? "bet" : "raise", amount })}
          >
            {legalActions.canBet ? "Ставка" : "Рейз"} {amount}
          </button>
        </div>
      )}
    </div>
  );
}
