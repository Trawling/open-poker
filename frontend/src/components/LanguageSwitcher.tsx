import { useTranslation } from "react-i18next";
import { SUPPORTED_LANGUAGES, setLanguage, type SupportedLanguage } from "../i18n";

const LABEL: Record<SupportedLanguage, string> = { ru: "RU", en: "EN" };

export function LanguageSwitcher() {
  const { t, i18n } = useTranslation();
  const current = (i18n.resolvedLanguage ?? "ru") as SupportedLanguage;

  return (
    <div className="lang-switcher" title={t("lang.toggleTitle")}>
      {SUPPORTED_LANGUAGES.map((lang) => (
        <button
          key={lang}
          type="button"
          className={`lang-switcher__btn ${lang === current ? "lang-switcher__btn--active" : ""}`}
          onClick={() => setLanguage(lang)}
        >
          {LABEL[lang]}
        </button>
      ))}
    </div>
  );
}
