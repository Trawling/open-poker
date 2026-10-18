import { Github } from "lucide-react";

export function Brand({ withBadge = true }: { withBadge?: boolean }) {
  return (
    <div className="brand">
      <span className="brand__mark" aria-hidden="true">♠</span>
      <span className="brand__name">Open Poker</span>
      {withBadge && (
        <a
          className="badge-pill glass"
          href="https://github.com/Trawling/open-poker"
          target="_blank"
          rel="noreferrer"
        >
          <Github size={13} />
          Open Source
        </a>
      )}
    </div>
  );
}
