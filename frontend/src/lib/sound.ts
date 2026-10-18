// Простые сигналы через Web Audio API — осознанно без аудиофайлов,
// чтобы не тащить лишние ассеты в открытый минималистичный проект.
const SOUND_KEY = "open-poker:sound-enabled";

let audioCtx: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!audioCtx) audioCtx = new Ctor();
  if (audioCtx.state === "suspended") void audioCtx.resume();
  return audioCtx;
}

function beep(frequency: number, durationMs: number, volume = 0.05) {
  if (!isSoundEnabled()) return;
  const ctx = getContext();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.frequency.value = frequency;
  osc.type = "sine";
  gain.gain.value = volume;
  osc.connect(gain);
  gain.connect(ctx.destination);
  const now = ctx.currentTime;
  gain.gain.setValueAtTime(volume, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + durationMs / 1000);
  osc.start(now);
  osc.stop(now + durationMs / 1000);
}

export function isSoundEnabled(): boolean {
  return localStorage.getItem(SOUND_KEY) === "1";
}

export function setSoundEnabled(enabled: boolean): void {
  localStorage.setItem(SOUND_KEY, enabled ? "1" : "0");
}

export function playYourTurnSound(): void {
  beep(660, 120);
}

export function playActionSound(): void {
  beep(440, 70, 0.04);
}

export function playWinSound(): void {
  beep(523, 100);
  setTimeout(() => beep(659, 100), 110);
  setTimeout(() => beep(784, 160), 220);
}

export function playChatSound(): void {
  beep(880, 50, 0.03);
}
