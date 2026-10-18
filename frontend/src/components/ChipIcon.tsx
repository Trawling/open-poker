export function ChipIcon({ size = 14, color = "var(--accent)" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="7" fill={color} />
      <circle cx="8" cy="8" r="7" stroke="rgba(0,0,0,0.25)" strokeWidth="1" />
      <circle cx="8" cy="8" r="3.4" fill="none" stroke="rgba(255,255,255,0.65)" strokeWidth="1.1" />
    </svg>
  );
}
