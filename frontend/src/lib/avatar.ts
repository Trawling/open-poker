function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/** Детерминированный цвет аватара по id/нику — без внешних картинок и загрузок. */
export function avatarColor(seed: string): string {
  const hue = hashString(seed) % 360;
  return `hsl(${hue}, 55%, 42%)`;
}

export function avatarInitial(nickname: string): string {
  const trimmed = nickname.trim();
  return trimmed.length > 0 ? trimmed[0].toUpperCase() : "?";
}
