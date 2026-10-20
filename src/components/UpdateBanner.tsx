import { installUpdate, useUpdateState } from "../updater";

/** A small pill that floats up from the bottom centre when a new version is waiting. */
export function UpdateBanner() {
  const s = useUpdateState();
  if (s.kind !== "available" && s.kind !== "downloading") return null;
  const busy = s.kind === "downloading";

  return (
    <div className="update-banner-wrap">
      <div className="update-banner" role="status">
        <span>
          {busy
            ? `Updating to ${s.version}${s.percent !== null ? ` · ${s.percent}%` : "…"}`
            : `Dusk ${s.version} is available`}
        </span>
        {!busy && (
          <button className="update-banner-btn" onClick={installUpdate}>
            Update
          </button>
        )}
        {busy && <i className="update-banner-bar" style={{ width: `${s.percent ?? 8}%` }} />}
      </div>
      <style>{`
        /* The wrapper only positions; the pill inside animates. */
        .update-banner-wrap {
          position: fixed; left: 0; right: 0; bottom: 64px; z-index: 20;
          display: flex; justify-content: center; pointer-events: none;
        }
        .update-banner {
          pointer-events: auto; position: relative; overflow: hidden;
          display: flex; align-items: center; gap: 10px;
          padding: 5px 6px 5px 16px; border-radius: var(--radius-pill);
          background: var(--bg-surface); border: 1px solid var(--line-strong);
          font-size: 12px; font-weight: 600; color: var(--ink); white-space: nowrap;
          box-shadow: 0 12px 34px -12px var(--glow);
          /* Rises into place, then keeps drifting up and down very slightly. */
          animation:
            update-rise 700ms cubic-bezier(0.34, 1.35, 0.64, 1) both,
            update-float 4.5s ease-in-out 700ms infinite;
        }
        @keyframes update-rise {
          from { opacity: 0; transform: translateY(34px) scale(0.94); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes update-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-3px); }
        }
        .update-banner-btn {
          border: none; border-radius: var(--radius-pill); padding: 5px 14px; font-size: 12px; font-weight: 700;
          background: var(--ember-gradient); color: var(--ink-on-ember);
        }
        .update-banner-bar { position: absolute; left: 0; bottom: 0; height: 2px; background: var(--ember-gradient); transition: width 300ms ease; }
      `}</style>
    </div>
  );
}
