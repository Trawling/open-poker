import { useState } from "react";
import { getGuestId, setGuestId } from "../lib/identity";

/**
 * Лёгкая замена аккаунту без паролей и почты: код = ваша личность.
 * Введя тот же код в другом браузере, вы продолжаете с тем же стеком
 * на тех же столах. Это удобство, а не защита — код не секретнее ссылки.
 */
export function IdentityPanel() {
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
        Мой код для входа с другого устройства
      </button>
    );
  }

  return (
    <div className="identity-panel">
      <div className="identity-panel__row">
        <code className="identity-panel__code">{code}</code>
        <button className="btn btn--ghost btn--small" onClick={handleCopy}>
          {copied ? "Скопировано" : "Копировать"}
        </button>
      </div>
      <p className="identity-panel__hint">
        Введите этот код на другом устройстве, чтобы продолжить с тем же стеком.
        Это не пароль — храните как ссылку-приглашение, не как секрет.
      </p>
      <div className="identity-panel__row">
        <input
          className="identity-panel__input"
          placeholder="Вставить код с другого устройства"
          value={importValue}
          onChange={(e) => setImportValue(e.target.value)}
        />
        <button className="btn btn--small" onClick={handleImport}>
          Войти
        </button>
      </div>
    </div>
  );
}
