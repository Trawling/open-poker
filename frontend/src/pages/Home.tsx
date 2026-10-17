import { useState } from "react";
import { IdentityPanel } from "../components/IdentityPanel";
import { getNickname, setNickname } from "../lib/identity";
import { DEFAULT_STAKES_ID, STAKES_LEVELS } from "../lib/stakes";

export function Home({
  onQuickPlay,
  onCreateTable,
  onQuickTournament,
}: {
  onQuickPlay: (nickname: string, stakes: string) => void;
  onCreateTable: (nickname: string, stakes: string) => void;
  onQuickTournament: (nickname: string) => void;
}) {
  const [nickname, setNicknameInput] = useState(getNickname());
  const [stakes, setStakes] = useState(DEFAULT_STAKES_ID);

  function handleNicknameBlur() {
    setNickname(nickname.trim());
  }

  return (
    <div className="home">
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

        <div className="home__stakes">
          <span className="home__stakes-label">Ставки:</span>
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
          <span className="home__stakes-hint">
            Это просто разные "режимы" — фишки в любом случае виртуальные и бесплатные.
          </span>
        </div>

        <div className="home__actions">
          <button className="btn btn--primary btn--big" onClick={() => onQuickPlay(nickname, stakes)}>
            Быстрая игра
          </button>
          <button className="btn btn--big" onClick={() => onCreateTable(nickname, stakes)}>
            Создать стол для друзей
          </button>
          <button className="btn btn--big" onClick={() => onQuickTournament(nickname)}>
            🏆 Турнир (без докупки, блайнды растут)
          </button>
        </div>

        <p className="home__note">
          Без регистрации. Фишки виртуальные и ничего не стоят — это просто игра.
        </p>

        <IdentityPanel />
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
