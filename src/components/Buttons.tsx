import type { ReactNode } from "react";

interface PrimaryButtonProps {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
}

/** Tiny faceted key used inside the primary button. */
function KeyGlyph() {
  return (
    <svg className="dusk-btn-key" width="20" height="20" viewBox="0 0 24 24" aria-hidden>
      <path d="M4 15a8 8 0 0 1 16 0z" fill="currentColor" />
      <rect x="2" y="17" width="20" height="2" rx="1" fill="currentColor" />
    </svg>
  );
}

export function PrimaryButton({
  children,
  onClick,
  disabled,
  loading,
}: PrimaryButtonProps) {
  return (
    <span className="dusk-btn-wrap">
      <button
        className="dusk-btn dusk-btn--primary"
        onClick={onClick}
        disabled={disabled}
      >
        {/* Flat cut-gold facets — stretched to the button, no blending. */}
        <svg className="dusk-btn-facets" viewBox="0 0 280 50" preserveAspectRatio="none" aria-hidden>
          <defs>
            <linearGradient id="dusk-btn-g" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#ffc27a" />
              <stop offset="1" stopColor="#ff7a59" />
            </linearGradient>
          </defs>
          <rect width="280" height="50" fill="url(#dusk-btn-g)" />
        </svg>
        <span className="dusk-btn-sheen" aria-hidden />
        {loading ? <span className="dusk-spinner" aria-hidden /> : <KeyGlyph />}
        <span className="dusk-btn-label">{children}</span>
      </button>
      <style>{`
        /* The offset shadow lives on a wrapper: clip-path would cut a
           shadow drawn on the button itself. */
        .dusk-btn-wrap {
          display: block;
          width: 100%;
          filter: drop-shadow(0 4px 0 rgba(0, 0, 0, 0.28));
        }
        .dusk-btn--primary {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 9px;
          width: 100%;
          height: 50px;
          border: none;
          border-radius: 0;
          clip-path: inset(0 round 25px);
          font-family: var(--font-display);
          font-weight: 800;
          font-size: 15px;
          letter-spacing: -0.005em;
          background: transparent;
          color: var(--ink-on-ember);
          transition: transform 120ms ease, filter 160ms ease, opacity 120ms ease;
        }
        .dusk-btn-facets {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
        }
        .dusk-btn-label {
          position: relative;
          z-index: 1;
        }
        .dusk-btn-key {
          position: relative;
          z-index: 1;
          flex-shrink: 0;
          transition: transform 260ms cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .dusk-btn--primary:hover:not(:disabled) .dusk-btn-key {
          transform: rotate(-24deg) scale(1.08);
        }
        /* One solid skewed band sweeping across — hard-edged, no gradient. */
        .dusk-btn-sheen {
          position: absolute;
          top: 0;
          bottom: 0;
          left: 0;
          width: 34px;
          background: rgba(255, 255, 255, 0.38);
          transform: translateX(-80px) skewX(-22deg);
          pointer-events: none;
        }
        .dusk-btn--primary:hover:not(:disabled) .dusk-btn-sheen {
          animation: sheen-sweep 700ms ease;
        }
        @keyframes sheen-sweep {
          to { transform: translateX(340px) skewX(-22deg); }
        }
        .dusk-btn--primary:hover:not(:disabled) {
          filter: brightness(1.06);
        }
        .dusk-btn--primary:active:not(:disabled) {
          transform: translateY(1px);
        }
        .dusk-btn--primary:disabled {
          opacity: 0.7;
          cursor: default;
        }
        .dusk-spinner {
          position: relative;
          z-index: 1;
          width: 15px;
          height: 15px;
          border-radius: 50%;
          border: 2px solid rgba(43, 27, 0, 0.25);
          border-top-color: var(--ink-on-ember);
          animation: spin 700ms linear infinite;
        }
      `}</style>
    </span>
  );
}

interface SecondaryButtonProps {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}

/** Deliberately plain — no fill, no border. Sits below the primary action
    without competing with it for attention. */
export function SecondaryButton({
  children,
  onClick,
  disabled,
}: SecondaryButtonProps) {
  return (
    <button
      className="dusk-btn dusk-btn--secondary"
      onClick={onClick}
      disabled={disabled}
    >
      {children}
      <style>{`
        .dusk-btn--secondary {
          width: 100%;
          height: 36px;
          border: none;
          background: transparent;
          color: var(--ink-muted);
          font-size: 13px;
          font-weight: 500;
          border-radius: 12px;
          transition: color 160ms ease, text-shadow 160ms ease;
        }
        /* No box on hover — the label itself lights up. */
        .dusk-btn--secondary:hover:not(:disabled) {
          color: var(--ember-text);
          text-shadow:
            0 0 6px var(--glow),
            0 0 14px var(--glow);
        }
        .dusk-btn--secondary:disabled {
          opacity: 0.5;
          cursor: default;
        }
      `}</style>
    </button>
  );
}
