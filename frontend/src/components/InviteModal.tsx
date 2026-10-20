import { Check, Copy, X } from "lucide-react";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

/**
 * Приглашение друга за стол: ссылка + QR-код, который можно отсканировать
 * камерой телефона. QR генерируется локально в браузере (библиотека
 * qrcode, без сети) — ссылка никуда не отправляется на сторону, это тот
 * же self-hosted принцип, что и для самого стола.
 */
export function InviteModal({ url, onClose }: { url: string; onClose: () => void }) {
  const { t } = useTranslation();
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(url, { margin: 1, width: 240 }).then((dataUrl) => {
      if (!cancelled) setQrDataUrl(dataUrl);
    });
    return () => {
      cancelled = true;
    };
  }, [url]);

  function handleCopy() {
    navigator.clipboard?.writeText(url).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      },
      () => undefined,
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal glass" onClick={(e) => e.stopPropagation()}>
        <div className="modal__header">
          <h3>{t("invite.title")}</h3>
          <button className="btn btn--ghost btn--icon" onClick={onClose} aria-label={t("invite.closeAria") ?? undefined}>
            <X size={16} />
          </button>
        </div>
        <p className="modal__hint">{t("invite.hint")}</p>
        <div className="invite-qr">
          {qrDataUrl && <img src={qrDataUrl} alt={t("invite.qrAlt") ?? ""} width={240} height={240} />}
        </div>
        <div className="invite-link-row">
          <code className="invite-link-row__url">{url}</code>
          <button className="btn btn--primary btn--icon" onClick={handleCopy} aria-label={t("invite.copyAria") ?? undefined}>
            {copied ? <Check size={15} /> : <Copy size={15} />}
          </button>
        </div>
      </div>
    </div>
  );
}
