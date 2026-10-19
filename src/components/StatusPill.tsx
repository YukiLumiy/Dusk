import type { ReactNode } from "react";

interface StatusPillProps {
  children: ReactNode;
  tone?: "neutral" | "live";
}

export function StatusPill({ children, tone = "neutral" }: StatusPillProps) {
  return (
    <span className={`status-pill status-pill--${tone}`}>
      {tone === "live" && <span className="status-pill-dot" />}
      {children}

      <style>{`
        .status-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          border-radius: var(--radius-pill);
          font-size: 12px;
          font-weight: 500;
          background: var(--bg-surface);
          color: var(--ink-muted);
          border: 1px solid var(--line);
        }
        .status-pill--live {
          color: var(--ink);
          border-color: var(--line-strong);
        }
        .status-pill-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--accent-live);
          animation: pulse-dot 2.4s ease-in-out infinite;
        }
      `}</style>
    </span>
  );
}
