import { getCurrentWindow } from "@tauri-apps/api/window";
import logo from "../assets/logo.png";

export function TitleBar() {
  const appWindow = getCurrentWindow();

  return (
    <div data-tauri-drag-region className="titlebar">
      <div className="titlebar-left">
        <img src={logo} alt="" className="titlebar-logo" />
        <span className="titlebar-name">Dusk</span>
      </div>

      <div className="titlebar-right">
        <div className="titlebar-controls">
          <button
            aria-label="Minimize"
            className="titlebar-btn"
            onClick={() => appWindow.minimize()}
          >
            <svg width="10" height="1.2" viewBox="0 0 10 1.2">
              <rect width="10" height="1.2" fill="currentColor" />
            </svg>
          </button>
          <button
            aria-label="Close"
            className="titlebar-btn titlebar-btn--close"
            onClick={() => appWindow.close()}
          >
            <svg width="10" height="10" viewBox="0 0 10 10">
              <path
                d="M0 0 L10 10 M10 0 L0 10"
                stroke="currentColor"
                strokeWidth="1.2"
              />
            </svg>
          </button>
        </div>
      </div>

      <style>{`
        .titlebar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          height: 56px;
          padding: 0 16px 0 20px;
          flex-shrink: 0;
        }
        .titlebar-left {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .titlebar-logo {
          width: 26px;
          height: 26px;
          border-radius: 11px;
          display: block;
          filter: drop-shadow(0 0 6px var(--glow-soft));
          transition: transform 220ms cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .titlebar-left:hover .titlebar-logo {
          transform: rotate(-10deg) scale(1.1);
          filter: drop-shadow(0 0 8px var(--glow));
        }
        .titlebar-name {
          font-family: var(--font-display);
          font-weight: 700;
          font-size: 15px;
          letter-spacing: -0.01em;
        }
        .titlebar-right {
          display: flex;
          align-items: center;
          gap: 18px;
        }
        .titlebar-user {
          font-size: 13px;
          color: var(--ink-muted);
        }
        .titlebar-controls {
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .titlebar-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 30px;
          height: 30px;
          border: none;
          background: transparent;
          color: var(--ink-muted);
          border-radius: 12px;
          transition: background 120ms ease, color 120ms ease;
        }
        .titlebar-btn:hover {
          background: var(--bg-surface-hover);
          color: var(--ink);
        }
        .titlebar-btn--close:hover {
          background: #3a2226;
          color: #ff8f8f;
        }
      `}</style>
    </div>
  );
}
