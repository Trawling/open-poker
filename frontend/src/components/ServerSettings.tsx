import { Capacitor } from "@capacitor/core";
import { useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { getBackendOverride, setBackendOverride } from "../lib/backend";

/**
 * Настройка адреса сервера — нужна ТОЛЬКО в нативном Android-приложении
 * (см. docs/05-android.md). У обычного веба есть origin/VITE_BACKEND_URL,
 * а голый WebView в APK не привязан ни к какому конкретному серверу —
 * это сознательное решение: Open Poker self-hosted, любой может поднять
 * свой сервер (см. docs/04-deploy.md) и играть со своими друзьями именно
 * на нём, не завися от чьего-то одного центрального инстанса.
 */
export function ServerSettings() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(getBackendOverride());
  const [saved, setSaved] = useState(false);

  if (!Capacitor.isNativePlatform()) return null;

  function handleSave() {
    setBackendOverride(value);
    setSaved(true);
    setTimeout(() => window.location.reload(), 600);
  }

  if (!open) {
    return (
      <button className="btn btn--ghost server-settings__toggle" onClick={() => setOpen(true)} type="button">
        {t("server.toggle")}
      </button>
    );
  }

  return (
    <div className="server-settings glass">
      <h3 className="server-settings__title">{t("server.title")}</h3>
      <p className="server-settings__hint">
        <Trans
          i18nKey="server.hint"
          values={{ example: "https://poker.example.com" }}
          components={{ code: <code /> }}
        />
      </p>
      <input
        className="server-settings__input"
        placeholder="https://poker.example.com"
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      <div className="server-settings__actions">
        <button className="btn btn--primary" onClick={handleSave} type="button">
          {saved ? t("server.saved") : t("server.save")}
        </button>
        <button className="btn btn--ghost" onClick={() => setOpen(false)} type="button">
          {t("server.cancel")}
        </button>
      </div>
    </div>
  );
}
