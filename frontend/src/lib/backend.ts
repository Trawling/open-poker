const OVERRIDE_KEY = "openpoker.backendUrlOverride";

/**
 * В нативном Android-приложении (см. docs/05-android.md) нет общего origin
 * с бэкендом — это не nginx-прокси, а голый WebView, который может
 * открываться с любым (самостоятельно развёрнутым) сервером. Поэтому адрес
 * сервера там — настройка пользователя, а не что-то зашитое в сборку.
 * Для обычного веба это не используется (там работает origin/VITE_BACKEND_URL).
 */
export function getBackendOverride(): string {
  try {
    return localStorage.getItem(OVERRIDE_KEY) ?? "";
  } catch {
    return "";
  }
}

export function setBackendOverride(url: string): void {
  try {
    const trimmed = url.trim().replace(/\/+$/, "");
    if (trimmed) localStorage.setItem(OVERRIDE_KEY, trimmed);
    else localStorage.removeItem(OVERRIDE_KEY);
  } catch {
    // localStorage недоступен (приватный режим и т.п.) — просто не сохраняем
  }
}

// В проде по умолчанию используем тот же origin, с которого отдан сам
// фронтенд (nginx проксирует /socket.io/ и /api/ на backend — см.
// frontend/nginx.conf и docs/04-deploy.md). В dev-режиме по умолчанию
// бьём в localhost:4000, если не задан VITE_BACKEND_URL явно. В нативном
// приложении (Capacitor, см. docs/05-android.md) сначала смотрим на ручную
// настройку пользователя — там нет общего origin с сервером.
export function getBackendOrigin(): string {
  const override = getBackendOverride();
  if (override) return override;
  const envBackendUrl = import.meta.env.VITE_BACKEND_URL;
  if (envBackendUrl && envBackendUrl.length > 0) return envBackendUrl;
  if (import.meta.env.DEV) return "http://localhost:4000";
  return "";
}
