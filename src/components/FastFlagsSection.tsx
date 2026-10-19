import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { notifyFlagsChanged, onFlagsChanged } from "../flagEvents";

type FlagValue = string | number | boolean;
type FlagMap = Record<string, FlagValue>;

export function FastFlagsSection() {
  const [flags, setFlags] = useState<FlagMap>({});
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  // The flag being edited (by its current name) and its draft.
  const [editing, setEditing] = useState<string | null>(null);
  const [draftKey, setDraftKey] = useState("");
  const [draftValue, setDraftValue] = useState("");

  useEffect(() => {
    const load = () =>
      invoke<FlagMap>("get_fast_flags")
        .then((result) => {
          setFlags(result);
          setLoaded(true);
        })
        .catch((err) => setStatus(String(err)));
    load();
    // Presets and profiles change the same file, so reload when they do.
    return onFlagsChanged(load);
  }, []);

  async function persist(next: FlagMap) {
    setFlags(next);
    try {
      await invoke("save_fast_flags", { flags: next });
      setStatus(null);
      notifyFlagsChanged();
    } catch (err) {
      setStatus(String(err));
    }
  }

  function parseValue(raw: string): FlagValue {
    if (raw === "true") return true;
    if (raw === "false") return false;
    if (raw.trim() !== "" && !Number.isNaN(Number(raw))) return Number(raw);
    return raw;
  }

  function addFlag() {
    const key = newKey.trim();
    if (!key) return;
    persist({ ...flags, [key]: parseValue(newValue.trim()) });
    setNewKey("");
    setNewValue("");
  }

  function removeFlag(key: string) {
    const next = { ...flags };
    delete next[key];
    persist(next);
  }

  function startEdit(key: string) {
    setEditing(key);
    setDraftKey(key);
    setDraftValue(String(flags[key]));
    setStatus(null);
  }

  function cancelEdit() {
    setEditing(null);
  }

  /** Saves in place, so a renamed flag keeps its position in the list. */
  function saveEdit() {
    if (editing === null) return;
    const key = draftKey.trim();
    if (!key) {
      setStatus("A flag needs a name.");
      return;
    }
    if (key !== editing && key in flags) {
      setStatus(`"${key}" already exists.`);
      return;
    }
    const next: FlagMap = {};
    for (const [k, v] of Object.entries(flags)) {
      if (k === editing) next[key] = parseValue(draftValue.trim());
      else next[k] = v;
    }
    setEditing(null);
    void persist(next);
  }

  const entries = Object.entries(flags);

  return (
    <section className="appearance-block">
      <h3>FastFlags</h3>
      <p className="appearance-hint">
        Advanced client settings passed straight to Roblox's engine. Wrong
        values can cause instability — when in doubt, leave this empty.
      </p>

      {status && <p className="flag-error">{status}</p>}

      {loaded && entries.length === 0 && (
        <p className="appearance-hint">No flags set.</p>
      )}

      {entries.length > 0 && (
        <ul className="flag-list">
          {entries.map(([key, value]) => (
            <li key={key} className={`flag-row ${editing === key ? "flag-row--editing" : ""}`}>
              {editing === key ? (
                <>
                  <div className="flag-edit-fields">
                    <input
                      className="flag-input"
                      value={draftKey}
                      autoFocus
                      spellCheck={false}
                      aria-label="Flag name"
                      onChange={(e) => setDraftKey(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveEdit();
                        if (e.key === "Escape") cancelEdit();
                      }}
                    />
                    <input
                      className="flag-input"
                      value={draftValue}
                      spellCheck={false}
                      aria-label="Flag value"
                      onChange={(e) => setDraftValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveEdit();
                        if (e.key === "Escape") cancelEdit();
                      }}
                    />
                  </div>
                  <button className="flag-icon" aria-label="Save" title="Save" onClick={saveEdit}>
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3 8.5l3.2 3.2L13 4.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </button>
                  <button className="flag-icon" aria-label="Cancel" title="Cancel" onClick={cancelEdit}>
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
                  </button>
                </>
              ) : (
                <>
                  <span className="flag-key" title={key}>{key}</span>
                  <span className="flag-value" title={String(value)}>{String(value)}</span>
                  <button className="flag-icon" aria-label={`Edit ${key}`} title="Edit" onClick={() => startEdit(key)}>
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M10.5 3.2l2.3 2.3M2.8 13.2l.5-2.9 7.2-7.1 2.3 2.3-7.1 7.2-2.9.5z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round" /></svg>
                  </button>
                  <button
                    className="flag-remove"
                    aria-label={`Remove ${key}`}
                    onClick={() => removeFlag(key)}
                  >
                    ×
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="flag-add-row">
        <input
          className="flag-input flag-input--key"
          placeholder="FFlagSomeName"
          value={newKey}
          onChange={(e) => setNewKey(e.target.value)}
        />
        <div className="flag-add-row-bottom">
          <input
            className="flag-input flag-input--value"
            placeholder="True"
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addFlag()}
          />
          <button className="apply-btn" onClick={addFlag} disabled={!newKey.trim()}>
            Add
          </button>
        </div>
      </div>

      <style>{`
        .flag-error {
          font-size: 11.5px;
          color: #ff8f8f;
          margin: 0 0 10px;
        }
        .flag-list {
          list-style: none;
          margin: 0 0 12px;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .flag-row {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 7px 10px;
          background: var(--bg-canvas);
          border: 1px solid var(--line);
          border-radius: 12px;
          font-size: 12px;
        }
        .flag-key {
          flex: 1;
          min-width: 0;
          font-weight: 600;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .flag-value {
          color: var(--ink-muted);
          max-width: 45%;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .flag-row--editing {
          border-color: var(--ember);
        }
        .flag-edit-fields {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 5px;
        }
        .flag-edit-fields .flag-input {
          width: 100%;
          padding: 6px 9px;
        }
        .flag-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 24px;
          height: 24px;
          flex-shrink: 0;
          border: none;
          border-radius: 11px;
          background: transparent;
          color: var(--ink-faint);
          transition: color 140ms ease, background 140ms ease;
        }
        .flag-icon:hover {
          color: var(--ember-text);
          background: var(--bg-surface-hover);
        }
        .flag-remove {
          border: none;
          background: transparent;
          color: var(--ink-faint);
          font-size: 15px;
          line-height: 1;
          padding: 0 2px;
        }
        .flag-remove:hover {
          color: #ff8f8f;
        }
        .flag-add-row {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .flag-add-row-bottom {
          display: flex;
          gap: 6px;
          min-width: 0;
        }
        .flag-input {
          min-width: 0;
          border-radius: 12px;
          border: 1px solid var(--line-strong);
          background: var(--bg-canvas);
          color: var(--ink);
          font-size: 12px;
          padding: 8px 10px;
        }
        .flag-input::placeholder {
          color: var(--ink-faint);
        }
        .flag-input--key {
          width: 100%;
        }
        .flag-input--value {
          flex: 1;
          min-width: 0;
        }
      `}</style>
    </section>
  );
}
