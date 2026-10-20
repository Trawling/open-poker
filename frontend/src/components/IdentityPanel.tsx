import { useState } from "react";
import { useTranslation } from "react-i18next";
import { getGuestId, setGuestId } from "../lib/identity";

/**
 * Лёгкая замена аккаунту без паролей и почты: код = ваша личность.
 * Введя тот же код в другом браузере, вы продолжаете с тем же стеком
 * на тех же столах. Это удобство, а не защита — код не секретнее ссылки.
 */
export function IdentityPanel() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [importValue, setImportValue] = useState("");
  const [copied, setCopied] = useState(false);
  const code = getGuestId();

  function handleCopy() {
    navigator.clipboard?.writeText(code).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      },
      () => undefined,
    );
  }

  function handleImport() {
    const trimmed = importValue.trim();
    if (!trimmed) return;
    setGuestId(trimmed);
    window.location.reload();
  }

  if (!open) {
    return (
      <button className="btn btn--ghost btn--small identity-toggle" onClick={() => setOpen(true)}>
        {t("identity.toggle")}
      </button>
    );
  }

  return (
    <div className="identity-panel glass">
      <div className="identity-panel__row">
        <code className="identity-panel__code">{code}</code>
        <button className="btn btn--ghost btn--small" onClick={handleCopy}>
          {copied ? t("identity.copied") : t("identity.copy")}
        </button>
      </div>
      <p className="identity-panel__hint">{t("identity.hint")}</p>
      <div className="identity-panel__row">
        <input
          className="identity-panel__input"
          placeholder={t("identity.importPlaceholder") ?? undefined}
          value={importValue}
          onChange={(e) => setImportValue(e.target.value)}
        />
        <button className="btn btn--small" onClick={handleImport}>
          {t("identity.importButton")}
        </button>
      </div>
    </div>
  );
}
