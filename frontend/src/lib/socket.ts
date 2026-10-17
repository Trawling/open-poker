import { io, type Socket } from "socket.io-client";
import { getGuestId, getNickname } from "./identity";
import type { ClientToServerEvents, ServerToClientEvents } from "./protocol";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL ?? "http://localhost:4000";

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
