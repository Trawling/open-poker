import { useState } from "react";
import { useTranslation } from "react-i18next";
import { getBackendOrigin } from "../lib/backend";
import { getGuestId } from "../lib/identity";

interface PlayerStats {
  nickname: string;
  handsPlayed: number;
  handsWon: number;
  chipsWon: number;
  biggestPotWon: number;
  tournamentsPlayed: number;
  tournamentsWon: number;
}

/** Статистика привязана к коду личности (см. IdentityPanel) — не к реальному аккаунту. */
export function StatsPanel() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [stats, setStats] = useState<PlayerStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleOpen() {
    setOpen(true);
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${getBackendOrigin()}/api/stats/${getGuestId()}`);
      if (!res.ok) throw new Error("Failed to load stats");
      const data = (await res.json()) as PlayerStats;
      setStats(data);
    } catch {
      setError(t("stats.loadError"));
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button className="btn btn--ghost btn--small identity-toggle" onClick={handleOpen}>
        {t("stats.toggle")}
      </button>
    );
  }

  return (
    <div className="identity-panel glass">
      {loading && <p className="identity-panel__hint">{t("stats.loading")}</p>}
      {error && <p className="identity-panel__hint">{error}</p>}
      {stats && (
        <ul className="stats-list">
          <li>{t("stats.handsPlayed", { count: stats.handsPlayed })}</li>
          <li>{t("stats.handsWon", { count: stats.handsWon })}</li>
          <li>{t("stats.chipsWon", { count: stats.chipsWon })}</li>
          <li>{t("stats.biggestPot", { amount: stats.biggestPotWon })}</li>
          <li>{t("stats.tournamentsPlayed", { count: stats.tournamentsPlayed })}</li>
          <li>{t("stats.tournamentsWon", { count: stats.tournamentsWon })}</li>
        </ul>
      )}
      <button className="btn btn--ghost btn--small" onClick={() => setOpen(false)}>
        {t("stats.hide")}
      </button>
    </div>
  );
}
