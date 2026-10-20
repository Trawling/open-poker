import { useState } from "react";
import { Brand } from "../components/Brand";
import { IdentityPanel } from "../components/IdentityPanel";
import { ServerSettings } from "../components/ServerSettings";
import { StatsPanel } from "../components/StatsPanel";
import { getNickname, setNickname } from "../lib/identity";
import { DEFAULT_STAKES_ID, STAKES_LEVELS } from "../lib/stakes";

export function Home({
  onQuickPlay,
  onCreateTable,
  onQuickTournament,
  onCreateTournament,
}: {
  onQuickPlay: (nickname: string, stakes: string) => void;
  onCreateTable: (nickname: string, stakes: string) => void;
  onQuickTournament: (nickname: string) => void;
  onCreateTournament: (nickname: string) => void;
}) {
  const [nickname, setNicknameInput] = useState(getNickname());
  const [stakes, setStakes] = useState(DEFAULT_STAKES_ID);

  function handleNicknameBlur() {
    setNickname(nickname.trim());
  }

  return (
    <div className="home">
      <header className="home__topbar">
        <Brand />
      </header>

      <div className="home__body">
        <div className="home__card">
          <h1 className="home__title">Open Poker</h1>
          <p className="home__subtitle">
            Бесплатный покер без рекламы и без денег. Открытый код. Зашёл — и сразу играешь.
          </p>

          <input
            className="home__nickname"
            placeholder="Ваш ник (необязательно)"
            value={nickname}
            maxLength={24}
            onChange={(e) => setNicknameInput(e.target.value)}
            onBlur={handleNicknameBlur}
          />

          <section className="home__section glass">
            <h2 className="home__section-title">Кэш-игра</h2>
            <div className="home__stakes">
              <div className="home__stakes-options">
                {STAKES_LEVELS.map((level) => (
                  <button
                    key={level.id}
                    className={`chip ${stakes === level.id ? "chip--active" : ""}`}
                    onClick={() => setStakes(level.id)}
                    type="button"
                  >
                    {level.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="home__actions">
              <button className="btn btn--primary btn--big" onClick={() => onQuickPlay(nickname, stakes)}>
                Быстрая игра
              </button>
              <button className="btn btn--ghost btn--big" onClick={() => onCreateTable(nickname, stakes)}>
                Создать стол для друзей
              </button>
            </div>
          </section>

          <section className="home__section glass">
            <h2 className="home__section-title">🏆 Турнир</h2>
            <p className="home__section-hint">Без докупки, блайнды растут — игра до последнего.</p>
            <div className="home__actions">
              <button className="btn btn--ghost btn--big" onClick={() => onQuickTournament(nickname)}>
                Быстрый турнир
              </button>
              <button className="btn btn--ghost btn--big" onClick={() => onCreateTournament(nickname)}>
                Турнир для друзей
              </button>
            </div>
          </section>

          <p className="home__note">
            Без регистрации. Фишки виртуальные и ничего не стоят — это просто игра.
          </p>

          <div className="home__meta-row">
            <StatsPanel />
            <IdentityPanel />
          </div>
          <ServerSettings />
        </div>
      </div>

      <footer className="home__footer">
        <a href="https://github.com/Trawling/open-poker" target="_blank" rel="noreferrer">
          Исходный код на GitHub
        </a>
        <span>·</span>
        <span>AGPL-3.0 · бесплатно и без рекламы навсегда</span>
      </footer>
    </div>
  );
}
