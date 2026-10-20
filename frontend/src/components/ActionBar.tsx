import { ArrowUpCircle, CheckCircle, Minus, Plus, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
  const canAct = legalActions && (legalActions.canBet || legalActions.canRaise || legalActions.canCall || legalActions.canCheck || legalActions.canFold);
  const raiseFloor = legalActions ? (legalActions.canBet ? legalActions.minBet : legalActions.minRaiseTo) : 0;
  const raiseCeil = legalActions?.maxTo ?? 0;

  const [amount, setAmount] = useState(raiseFloor);

  useEffect(() => {
    setAmount(raiseFloor);
  }, [raiseFloor, raiseCeil]);

  if (!canAct || !legalActions) {
    return (
      <div className="action-bar action-bar--idle glass">
        {t("action.waiting")}
      </div>
    );
  }

  const clamp = (v: number) => Math.max(raiseFloor, Math.min(raiseCeil, Math.round(v)));
  const step = Math.max(1, Math.round((legalActions.minRaiseTo - legalActions.minBet) || legalActions.minBet || 1));

  return (
    <div className="action-row">
      <div className="action-bar glass">
        <div className="action-bar__buttons">
          {legalActions.canFold && (
            <button className="action-btn action-btn--fold" onClick={() => onAction({ type: "fold" })}>
              <XCircle size={18} />
              {t("action.fold")}
            </button>
          )}
          {legalActions.canCheck && (
            <button className="action-btn" onClick={() => onAction({ type: "check" })}>
              <CheckCircle size={18} />
              {t("action.check")}
            </button>
          )}
          {legalActions.canCall && (
            <button className="action-btn action-btn--call" onClick={() => onAction({ type: "call" })}>
              <CheckCircle size={18} />
              {t("action.call", { amount: legalActions.callAmount })}
            </button>
          )}
        </div>
      </div>

      {(legalActions.canBet || legalActions.canRaise) && (
        <div className="bet-panel glass">
          <div className="bet-control">
            <span className="bet-control__label">{t("action.betAmountLabel")}</span>
            <div className="bet-control__row">
              <button className="stepper-btn" onClick={() => setAmount((v) => clamp(v - step))} aria-label={t("action.less") ?? undefined}>
                <Minus size={14} />
              </button>
              <input
                type="range"
                min={raiseFloor}
                max={raiseCeil}
                value={amount}
                onChange={(e) => setAmount(clamp(Number(e.target.value)))}
              />
              <button className="stepper-btn" onClick={() => setAmount((v) => clamp(v + step))} aria-label={t("action.more") ?? undefined}>
                <Plus size={14} />
              </button>
              <div className="bet-control__amount">
                <input
                  type="number"
                  min={raiseFloor}
                  max={raiseCeil}
                  value={amount}
                  onChange={(e) => setAmount(clamp(Number(e.target.value)))}
                />
              </div>
            </div>
            <div className="bet-control__minmax">
              <span>{t("action.min", { amount: raiseFloor })}</span>
              <span>{t("action.max", { amount: raiseCeil })}</span>
            </div>
            <div className="action-bar__quick">
              {potSize > 0 && (
                <button className="quick-chip" onClick={() => setAmount(clamp(potSize))}>
                  {t("action.pot")}
                </button>
              )}
              <button className="quick-chip" onClick={() => setAmount(raiseCeil)}>
                {t("action.allIn")}
              </button>
              <button
                className="action-btn action-btn--raise"
                onClick={() => onAction({ type: legalActions.canBet ? "bet" : "raise", amount })}
                style={{ marginLeft: "auto" }}
              >
                <ArrowUpCircle size={18} />
                {t(legalActions.canBet ? "action.bet" : "action.raise", { amount })}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
