import { useState } from "react";
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
      if (!res.ok) throw new Error("Не удалось загрузить статистику");
      const data = (await res.json()) as PlayerStats;
      setStats(data);
    } catch {
      setError("Не удалось загрузить статистику. Попробуйте позже.");
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button className="btn btn--ghost btn--small identity-toggle" onClick={handleOpen}>
        Моя статистика
      </button>
    );
  }

  return (
    <div className="identity-panel">
      {loading && <p className="identity-panel__hint">Загружаем…</p>}
      {error && <p className="identity-panel__hint">{error}</p>}
      {stats && (
        <ul className="stats-list">
          <li>Раздач сыграно: {stats.handsPlayed}</li>
          <li>Раздач выиграно: {stats.handsWon}</li>
          <li>Выиграно фишек всего: {stats.chipsWon}</li>
          <li>Самый большой банк: {stats.biggestPotWon}</li>
          <li>Турниров сыграно: {stats.tournamentsPlayed}</li>
          <li>Турниров выиграно: {stats.tournamentsWon}</li>
        </ul>
      )}
      <button className="btn btn--ghost btn--small" onClick={() => setOpen(false)}>
        Скрыть
      </button>
    </div>
  );
}
