const GUEST_ID_KEY = "open-poker:guest-id";
const NICKNAME_KEY = "open-poker:nickname";

function randomId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function getGuestId(): string {
  let id = localStorage.getItem(GUEST_ID_KEY);
  if (!id) {
    id = randomId();
    localStorage.setItem(GUEST_ID_KEY, id);
  }
  return id;
}

/**
 * Переносит личность на это устройство/браузер: тот же код — тот же игрок
 * на тех же столах с тем же стеком. Это не пароль и не аккаунт с почтой —
 * просто способ не терять прогресс при смене браузера/устройства, пока нет
 * полноценной системы аккаунтов. См. docs/03-implementation-notes.md.
 */
export function setGuestId(id: string): void {
  localStorage.setItem(GUEST_ID_KEY, id.trim());
}

export function getNickname(): string {
  return localStorage.getItem(NICKNAME_KEY) ?? "";
}

export function setNickname(nickname: string): void {
  localStorage.setItem(NICKNAME_KEY, nickname);
}
