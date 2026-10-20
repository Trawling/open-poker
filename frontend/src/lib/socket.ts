import { io, type Socket } from "socket.io-client";
import i18n from "../i18n";
import { getBackendOrigin } from "./backend";
import { getGuestId, getNickname } from "./identity";
import type { ClientToServerEvents, ServerToClientEvents } from "./protocol";

const BACKEND_URL = getBackendOrigin() || undefined;

type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: AppSocket | null = null;

export function getSocket(): AppSocket {
  if (!socket) {
    socket = io(BACKEND_URL, {
      autoConnect: true,
      auth: {
        guestId: getGuestId(),
        nickname: getNickname(),
        // Только для автосгенерированных ботов/гостевых ников на сервере
        // (см. backend/src/names.ts) — не влияет на перевод самого UI.
        lang: i18n.resolvedLanguage,
      },
    });
  }
  return socket;
}
