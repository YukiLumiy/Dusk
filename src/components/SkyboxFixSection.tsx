import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ToggleSwitch } from "./ToggleSwitch";

interface FixStatus {
  present: number;
  total: number;
}

/** Applies / removes the skybox fix and optionally re-applies it on every launch. */
export function SkyboxFixSection() {
  const [status, setStatus] = useState<FixStatus | null>(null);
  const [onLaunch, setOnLaunch] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    try {
      setStatus(await invoke<FixStatus>("get_skybox_fix_status"));
    } catch (err) {
      setError(String(err));
    }
  }

  useEffect(() => {
    refresh();
    invoke<{ skybox_fix_on_launch?: boolean }>("get_settings")
      .then((s) => setOnLaunch(Boolean(s.skybox_fix_on_launch)))
      .catch(() => undefined);
  }, []);

  async function run(cmd: "apply_skybox_fix" | "remove_skybox_fix", done: (n: number) => string) {
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      setMessage(done(await invoke<number>(cmd)));
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
      refresh();
    }
  }

  async function toggleOnLaunch(enabled: boolean) {
    setOnLaunch(enabled);
    try {
      await invoke("set_skybox_fix_on_launch", { enabled });
    } catch (err) {
      setOnLaunch(!enabled);
      setError(String(err));
    }
  }

  const summary =
    status === null
      ? "…"
      : status.present === status.total
        ? `Applied — all ${status.total} files are in place.`
        : status.present > 0
          ? `Partly applied — ${status.present} of ${status.total} files.`
          : "Not applied.";

  return (
    <section className="appearance-block">
      <h3>Skybox fix</h3>

      <div className="field-column">
        <p className="appearance-hint">
          Replaces Roblox's cached default sky textures so your custom skybox is the one that shows.
        </p>
        <p className="appearance-hint">{summary}</p>
        <div className="appearance-row">
          <button
            className="apply-btn"
            style={{ flex: 1 }}
            disabled={busy}
            onClick={() => run("apply_skybox_fix", (n) => `Applied ${n} files.`)}
          >
            {busy ? "Working…" : "Apply fix"}
          </button>
          <button
            className="apply-btn"
            style={{ flex: 1 }}
            disabled={busy}
            onClick={() => run("remove_skybox_fix", (n) => `Removed ${n} files.`)}
          >
            Remove
          </button>
        </div>
        {message && <p className="appearance-hint">{message}</p>}
        {error && <p className="flag-error">{error}</p>}
      </div>

      <div className="field-row">
        <div className="field-text">
          <span className="field-label">Apply on every launch</span>
          <p className="appearance-hint">
            Clearing the cache removes the fix, so this puts it back just before Roblox starts.
          </p>
        </div>
        <ToggleSwitch
          checked={onLaunch}
          label="Toggle applying the skybox fix on launch"
          onChange={toggleOnLaunch}
        />
      </div>
    </section>
  );
}
