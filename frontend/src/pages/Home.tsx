import { useState } from "react";
import { IdentityPanel } from "../components/IdentityPanel";
import { getNickname, setNickname } from "../lib/identity";

export function Home({
  onQuickPlay,
  onCreateTable,
}: {
  onQuickPlay: (nickname: string) => void;
  onCreateTable: (nickname: string) => void;
}) {
  const [nickname, setNicknameInput] = useState(getNickname());

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

        <div className="home__actions">
          <button className="btn btn--primary btn--big" onClick={() => onQuickPlay(nickname)}>
            Быстрая игра
          </button>
          <button className="btn btn--big" onClick={() => onCreateTable(nickname)}>
            Создать стол для друзей
          </button>
        </div>

        <p className="home__note">
          Без регистрации. Фишки виртуальные и ничего не стоят — это просто игра.
        </p>

        <IdentityPanel />
      </div>

      <footer className="home__footer">
        <a href="https://github.com" target="_blank" rel="noreferrer">
          Исходный код на GitHub
        </a>
        <span>·</span>
        <span>AGPL-3.0 · бесплатно и без рекламы навсегда</span>
      </footer>
    </div>
  );
}
