import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ToggleSwitch } from "./ToggleSwitch";
import { PRESETS, type Flags, type Preset } from "../fflagPresets";
import { notifyFlagsChanged, onFlagsChanged } from "../flagEvents";

const same = (a: unknown, b: unknown) => String(a).toLowerCase() === String(b).toLowerCase();
const matches = (flags: Flags, want: Flags) =>
  Object.entries(want).every(([key, value]) => key in flags && same(flags[key], value));

/** One-tap switches and choices for the flags people change most. */
export function FFlagPresetsSection() {
  const [flags, setFlags] = useState<Flags>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = () =>
      invoke<Flags>("get_fast_flags").then(setFlags).catch((err) => setError(String(err)));
    load();
    return onFlagsChanged(load);
  }, []);

  async function change(set: Flags, remove: string[]) {
    try {
      setFlags(await invoke<Flags>("update_fast_flags", { set, remove }));
      setError(null);
      notifyFlagsChanged();
    } catch (err) {
      setError(String(err));
    }
  }

  function control(p: Preset) {
    if (p.kind === "toggle") {
      return (
        <ToggleSwitch
          checked={matches(flags, p.flags)}
          label={`Toggle ${p.label}`}
          onChange={(on) => change(on ? p.flags : {}, on ? [] : Object.keys(p.flags))}
        />
      );
    }
    const group = Array.from(new Set(p.options.flatMap((o) => Object.keys(o.flags))));
    const active =
      p.options.find((o) => Object.keys(o.flags).length > 0 && matches(flags, o.flags)) ??
      (group.every((k) => !(k in flags)) ? p.options[0] : undefined);
    return (
      <div className="preset-chips">
        {p.options.map((o) => (
          <button
            key={o.label}
            className={`preset-chip ${active === o ? "preset-chip--on" : ""}`}
            onClick={() => change(o.flags, group.filter((k) => !(k in o.flags)))}
          >
            {o.label}
          </button>
        ))}
      </div>
    );
  }

  return (
    <section className="appearance-block">
      <h3>FastFlag presets</h3>
      {PRESETS.map((p) =>
        p.kind === "toggle" ? (
          <div className="field-row" key={p.id}>
            <div className="field-text">
              <span className="field-label">{p.label}</span>
              <p className="appearance-hint">{p.hint}</p>
            </div>
            {control(p)}
          </div>
        ) : (
          <div className="field-column" key={p.id}>
            <span className="field-label">{p.label}</span>
            <p className="appearance-hint">{p.hint}</p>
            {control(p)}
          </div>
        ),
      )}
      {error && <p className="flag-error">{error}</p>}
      <style>{`
        .preset-chips { display: flex; flex-wrap: wrap; gap: 6px; }
        .preset-chip {
          border: 1px solid var(--line-strong);
          background: transparent;
          color: var(--ink-muted);
          font-size: 11.5px;
          font-weight: 600;
          padding: 5px 13px;
          border-radius: var(--radius-pill);
          transition: background 200ms ease, color 200ms ease, transform 200ms cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .preset-chip:hover { color: var(--ink); transform: translateY(-1px); }
        .preset-chip--on { background: var(--ember-gradient); color: var(--ink-on-ember); border-color: transparent; }
      `}</style>
    </section>
  );
}
