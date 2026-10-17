import { io, type Socket } from "socket.io-client";
import { getGuestId, getNickname } from "./identity";
import type { ClientToServerEvents, ServerToClientEvents } from "./protocol";

// В проде по умолчанию подключаемся к тому же origin, с которого отдан сам
// фронтенд (nginx проксирует /socket.io/ на backend, см. frontend/nginx.conf
// и docs/04-deploy.md) — тогда никакой отдельный URL не нужен и не возникает
// проблем с CORS. В dev-режиме по умолчанию бьём в localhost:4000.
const envBackendUrl = import.meta.env.VITE_BACKEND_URL;
const BACKEND_URL = envBackendUrl && envBackendUrl.length > 0
  ? envBackendUrl
  : import.meta.env.DEV
    ? "http://localhost:4000"
    : undefined;

type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: AppSocket | null = null;

export function getSocket(): AppSocket {
  if (!socket) {
    socket = io(BACKEND_URL, {
      autoConnect: true,
      auth: {
        guestId: getGuestId(),
        nickname: getNickname(),
      },
    });
  }
  return socket;
}
