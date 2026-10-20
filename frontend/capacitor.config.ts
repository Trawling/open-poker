import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "io.github.trawling.openpoker",
  appName: "Open Poker",
  webDir: "dist",
  // По умолчанию Capacitor отдаёт локальные ассеты по https://localhost —
  // тогда WebView блокирует любой http:// (не https/wss) запрос к серверу
  // как "Mixed Content", даже если usesCleartextTraffic=true. Но Open Poker
  // self-hosted: сервер может быть поднят без TLS (особенно для игры в
  // локальной сети без реверс-прокси) — см. docs/05-android.md. Поэтому
  // отдаём сами ассеты тоже по http://localhost: тогда http-бэкенд
  // подключается нормально, а https/wss — как upgrade, тоже без проблем.
  server: {
    androidScheme: "http",
  },
};

export default config;
