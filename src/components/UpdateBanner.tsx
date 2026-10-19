import { installUpdate, useUpdateState } from "../updater";

/** A small pill under the title bar when a new version is waiting. */
export function UpdateBanner() {
  const s = useUpdateState();
  if (s.kind !== "available" && s.kind !== "downloading") return null;
  const busy = s.kind === "downloading";

  return (
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
      <style>{`
        .update-banner {
          position: fixed; top: 50px; left: 50%; transform: translateX(-50%); z-index: 20;
          display: flex; align-items: center; gap: 10px; overflow: hidden;
          padding: 5px 6px 5px 16px; border-radius: var(--radius-pill);
          background: var(--bg-surface); border: 1px solid var(--line-strong);
          font-size: 12px; font-weight: 600; color: var(--ink); white-space: nowrap;
          box-shadow: 0 10px 30px -12px var(--glow);
          animation: reveal-up 420ms cubic-bezier(0.16, 1, 0.3, 1) both;
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
