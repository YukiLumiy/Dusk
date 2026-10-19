import { useEffect, useState } from "react";
import { getVersion } from "@tauri-apps/api/app";
import { ToggleSwitch } from "./ToggleSwitch";
import { autoUpdateEnabled, checkForUpdate, installUpdate, setAutoUpdate, useUpdateState } from "../updater";

/** Shows the installed version, checks GitHub for a newer one, and installs it. */
export function UpdateSection() {
  const s = useUpdateState();
  const [version, setVersion] = useState("");
  const [auto, setAuto] = useState(autoUpdateEnabled());

  useEffect(() => {
    getVersion().then(setVersion).catch(() => undefined);
  }, []);

  const text =
    s.kind === "checking" ? "Checking…"
    : s.kind === "none" ? "You're up to date."
    : s.kind === "available" ? `Version ${s.version} is available.`
    : s.kind === "downloading" ? `Downloading ${s.version}${s.percent !== null ? ` · ${s.percent}%` : "…"}`
    : s.kind === "error" ? "Couldn't check for updates."
    : "";

  return (
    <section className="appearance-block">
      <h3>Updates</h3>
      <div className="field-column">
        <p className="appearance-hint">Dusk {version}</p>
        {text && <p className="appearance-hint">{text}</p>}
        {s.kind === "available" && s.notes && <p className="appearance-hint">{s.notes.slice(0, 240)}</p>}
        {s.kind === "error" && <p className="flag-error">{s.message}</p>}
        <div className="appearance-row">
          {s.kind === "available" ? (
            <button className="apply-btn apply-btn--full" onClick={installUpdate}>
              Update to {s.version}
            </button>
          ) : (
            <button
              className="apply-btn apply-btn--full"
              disabled={s.kind === "checking" || s.kind === "downloading"}
              onClick={checkForUpdate}
            >
              Check for updates
            </button>
          )}
        </div>
      </div>
      <div className="field-row">
        <div className="field-text">
          <span className="field-label">Check on startup</span>
          <p className="appearance-hint">Looks for a new release a few seconds after Dusk opens.</p>
        </div>
        <ToggleSwitch
          checked={auto}
          label="Toggle checking for updates on startup"
          onChange={(on) => {
            setAuto(on);
            setAutoUpdate(on);
          }}
        />
      </div>
    </section>
  );
}
