import { avatarColor, avatarInitial } from "../lib/avatar";

export function Avatar({ seed, nickname }: { seed: string; nickname: string }) {
  return (
    <div className="avatar" style={{ background: avatarColor(seed) }} aria-hidden="true">
      {avatarInitial(nickname)}
    </div>
  );
}
