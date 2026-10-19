import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { notifyFlagsChanged } from "../flagEvents";

interface Profile {
  name: string;
  count: number;
}

/** Named snapshots of the whole flag set: save the current one, load or delete later. */
export function FFlagProfilesSection() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [name, setName] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = () =>
    invoke<Profile[]>("list_fflag_profiles").then(setProfiles).catch((err) => setError(String(err)));
  useEffect(() => {
    refresh();
  }, []);

  async function run(cmd: string, args: Record<string, unknown>, done: string, changesFlags = false) {
    setMessage(null);
    setError(null);
    try {
      await invoke(cmd, args);
      setMessage(done);
      if (changesFlags) notifyFlagsChanged();
    } catch (err) {
      setError(String(err));
    }
    refresh();
  }

  return (
    <section className="appearance-block">
      <h3>Flag profiles</h3>
      <div className="field-column">
        <p className="appearance-hint">Save the flags above as a profile, then bring them back with one click.</p>
        <div className="appearance-row">
          <input
            className="flag-input"
            style={{ flex: 1 }}
            placeholder="Profile name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button
            className="apply-btn"
            disabled={!name.trim()}
            onClick={() => run("save_fflag_profile", { name }, `Saved “${name.trim()}”.`).then(() => setName(""))}
          >
            Save
          </button>
        </div>
        {profiles.map((p) => (
          <div className="profile-row" key={p.name}>
            <span className="field-label">
              {p.name} <span className="appearance-hint">· {p.count} flags</span>
            </span>
            <span className="profile-actions">
              <button className="apply-btn" onClick={() => run("load_fflag_profile", { name: p.name }, `Loaded “${p.name}”.`, true)}>
                Load
              </button>
              <button className="apply-btn" onClick={() => run("delete_fflag_profile", { name: p.name }, `Deleted “${p.name}”.`)}>
                Delete
              </button>
            </span>
          </div>
        ))}
        {message && <p className="appearance-hint">{message}</p>}
        {error && <p className="flag-error">{error}</p>}
      </div>
      <style>{`
        .profile-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 6px 0; }
        .profile-actions { display: flex; gap: 6px; }
      `}</style>
    </section>
  );
}
