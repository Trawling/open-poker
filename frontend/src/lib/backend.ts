// В проде по умолчанию используем тот же origin, с которого отдан сам
// фронтенд (nginx проксирует /socket.io/ и /api/ на backend — см.
// frontend/nginx.conf и docs/04-deploy.md). В dev-режиме по умолчанию
// бьём в localhost:4000, если не задан VITE_BACKEND_URL явно.
export function getBackendOrigin(): string {
  const envBackendUrl = import.meta.env.VITE_BACKEND_URL;
  if (envBackendUrl && envBackendUrl.length > 0) return envBackendUrl;
  if (import.meta.env.DEV) return "http://localhost:4000";
  return "";
}
