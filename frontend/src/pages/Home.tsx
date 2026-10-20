import { useTranslation } from "react-i18next";
import { useState } from "react";
import { Brand } from "../components/Brand";
import { IdentityPanel } from "../components/IdentityPanel";
import { LanguageSwitcher } from "../components/LanguageSwitcher";
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
  const { t } = useTranslation();
  const [nickname, setNicknameInput] = useState(getNickname());
  const [stakes, setStakes] = useState(DEFAULT_STAKES_ID);

  function handleNicknameBlur() {
    setNickname(nickname.trim());
  }

  return (
    <div className="home">
      <header className="home__topbar">
        <Brand />
        <LanguageSwitcher />
      </header>

      <div className="home__body">
        <div className="home__card">
          <h1 className="home__title">Open Poker</h1>
          <p className="home__subtitle">{t("home.subtitle")}</p>

          <input
            className="home__nickname"
            placeholder={t("home.nicknamePlaceholder") ?? undefined}
            value={nickname}
            maxLength={24}
            onChange={(e) => setNicknameInput(e.target.value)}
            onBlur={handleNicknameBlur}
          />

          <section className="home__section glass">
            <h2 className="home__section-title">{t("home.cashGameTitle")}</h2>
            <div className="home__stakes">
              <div className="home__stakes-options">
                {STAKES_LEVELS.map((level) => (
                  <button
                    key={level.id}
                    className={`chip ${stakes === level.id ? "chip--active" : ""}`}
                    onClick={() => setStakes(level.id)}
                    type="button"
                  >
                    {t(`stakes.${level.id}`, { small: level.smallBlind, big: level.bigBlind })}
                  </button>
                ))}
              </div>
            </div>
            <div className="home__actions">
              <button className="btn btn--primary btn--big" onClick={() => onQuickPlay(nickname, stakes)}>
                {t("home.quickPlay")}
              </button>
              <button className="btn btn--ghost btn--big" onClick={() => onCreateTable(nickname, stakes)}>
                {t("home.createTable")}
              </button>
            </div>
          </section>

          <section className="home__section glass">
            <h2 className="home__section-title">{t("home.tournamentTitle")}</h2>
            <p className="home__section-hint">{t("home.tournamentHint")}</p>
            <div className="home__actions">
              <button className="btn btn--ghost btn--big" onClick={() => onQuickTournament(nickname)}>
                {t("home.quickTournament")}
              </button>
              <button className="btn btn--ghost btn--big" onClick={() => onCreateTournament(nickname)}>
                {t("home.createTournament")}
              </button>
            </div>
          </section>

          <p className="home__note">{t("home.note")}</p>

          <div className="home__meta-row">
            <StatsPanel />
            <IdentityPanel />
          </div>
          <ServerSettings />
        </div>
      </div>

      <footer className="home__footer">
        <a href="https://github.com/Trawling/open-poker" target="_blank" rel="noreferrer">
          {t("home.sourceLink")}
        </a>
        <span>·</span>
        <span>{t("home.footerTagline")}</span>
      </footer>
    </div>
  );
}
