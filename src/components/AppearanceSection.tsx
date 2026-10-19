import { useCallback, useEffect, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";

type FaceKey = "up" | "dn" | "ft" | "bk" | "lf" | "rt";

const SKY_FACES: { key: FaceKey; label: string; hint: string; area: string }[] = [
  { key: "up", label: "Up", hint: "Sky — looking straight up", area: "up" },
  { key: "lf", label: "Left", hint: "Horizon — facing left", area: "lf" },
  { key: "ft", label: "Front", hint: "Horizon — facing forward", area: "ft" },
  { key: "rt", label: "Right", hint: "Horizon — facing right", area: "rt" },
  { key: "bk", label: "Back", hint: "Horizon — facing backward", area: "bk" },
  { key: "dn", label: "Down", hint: "Ground — looking straight down", area: "dn" },
];

/** What is really applied, worked out from the files on disk. */
interface AppearanceState {
  font: string | null;
  sky_faces: Record<string, string>;
}

interface SkyPreset {
  slug: string;
  name: string;
}

// Thumbnails of the built-in templates, bundled with the app.
const presetThumbs = import.meta.glob("../assets/sky-presets/*.jpg", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

function thumbFor(slug: string) {
  return presetThumbs[`../assets/sky-presets/${slug}.jpg`];
}

interface AppearanceSectionProps {
  onApplied: () => void;
}

function baseName(path: string) {
  return path.split(/[/\\]/).pop() ?? path;
}

export function AppearanceSection({ onApplied }: AppearanceSectionProps) {
  // What's already applied, per Dusk's saved settings — shown until the
  // person picks something new.
  const [appliedFontName, setAppliedFontName] = useState<string | null>(null);
  const [appliedSkyFaces, setAppliedSkyFaces] = useState<Record<string, string>>({});

  // A new selection awaiting "Apply".
  const [pendingFontPath, setPendingFontPath] = useState<string | null>(null);
  const [pendingSkyPaths, setPendingSkyPaths] = useState<Record<string, string>>({});

  const [fontStatus, setFontStatus] = useState<string | null>(null);
  const [fontBusy, setFontBusy] = useState(false);
  const [skyStatus, setSkyStatus] = useState<string | null>(null);
  const [skyBusy, setSkyBusy] = useState(false);

  const [presets, setPresets] = useState<SkyPreset[]>([]);
  const [showTemplates, setShowTemplates] = useState(true);

  // "Applied" is read from the files, not from a remembered name, so it
  // drops back by itself when the profile is switched off, deleted or
  // reset elsewhere. Checked often and whenever the window regains focus.
  const refreshState = useCallback(async () => {
    try {
      const s = await invoke<AppearanceState>("get_appearance_state");
      setAppliedFontName(s.font);
      setAppliedSkyFaces(s.sky_faces ?? {});
    } catch {
      // keep what is shown
    }
  }, []);

  useEffect(() => {
    void refreshState();
    const timer = window.setInterval(refreshState, 2000);
    window.addEventListener("focus", refreshState);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refreshState);
    };
  }, [refreshState]);

  useEffect(() => {
    invoke<SkyPreset[]>("list_sky_presets").then(setPresets).catch(() => undefined);
  }, []);

  async function pickFont() {
    const selected = await open({
      multiple: false,
      filters: [{ name: "Font", extensions: ["otf", "ttf"] }],
    });
    if (typeof selected === "string") {
      setPendingFontPath(selected);
      setFontStatus(null);
    }
  }

  async function applyFont() {
    if (!pendingFontPath) return;
    setFontBusy(true);
    setFontStatus(null);
    try {
      const count = await invoke<number>("install_font_mod", {
        profileName: "custom-font",
        fontPath: pendingFontPath,
      });
      setAppliedFontName(baseName(pendingFontPath));
      setPendingFontPath(null);
      setFontStatus(`Applied to ${count} font families.`);
      void refreshState();
      onApplied();
    } catch (err) {
      setFontStatus(String(err));
    } finally {
      setFontBusy(false);
    }
  }

  async function pickSkyFace(key: FaceKey) {
    const selected = await open({
      multiple: false,
      filters: [{ name: "Image", extensions: ["png", "jpg", "jpeg", "tex"] }],
    });
    if (typeof selected === "string") {
      setPendingSkyPaths((prev) => ({ ...prev, [key]: selected }));
      setSkyStatus(null);
    }
  }

  async function applySkybox() {
    setSkyBusy(true);
    setSkyStatus(null);
    try {
      const count = await invoke<number>("install_skybox_mod", {
        profileName: "custom-skybox",
        faces: {
          ft: pendingSkyPaths.ft ?? null,
          bk: pendingSkyPaths.bk ?? null,
          lf: pendingSkyPaths.lf ?? null,
          rt: pendingSkyPaths.rt ?? null,
          up: pendingSkyPaths.up ?? null,
          dn: pendingSkyPaths.dn ?? null,
        },
      });
      setAppliedSkyFaces((prev) => {
        const next = { ...prev };
        for (const [key, path] of Object.entries(pendingSkyPaths)) {
          next[key] = baseName(path);
        }
        return next;
      });
      setPendingSkyPaths({});
      setSkyStatus(`Applied ${count} face${count === 1 ? "" : "s"}.`);
      void refreshState();
      onApplied();
    } catch (err) {
      setSkyStatus(String(err));
    } finally {
      setSkyBusy(false);
    }
  }

  async function resetFont() {
    setFontBusy(true);
    try {
      await invoke("reset_appearance", { kind: "font" });
      setPendingFontPath(null);
      setAppliedFontName(null);
      setFontStatus("Reset. Roblox's own font is back from the next launch.");
      onApplied();
    } catch (err) {
      setFontStatus(String(err));
    } finally {
      setFontBusy(false);
    }
  }

  async function resetSkybox() {
    setSkyBusy(true);
    try {
      await invoke("reset_appearance", { kind: "skybox" });
      setPendingSkyPaths({});
      setAppliedSkyFaces({});
      setSkyStatus("Reset. Roblox's own sky is back from the next launch.");
      onApplied();
    } catch (err) {
      setSkyStatus(String(err));
    } finally {
      setSkyBusy(false);
    }
  }

  async function applyPreset(preset: SkyPreset) {
    setSkyBusy(true);
    setSkyStatus(null);
    try {
      await invoke("install_sky_preset", { slug: preset.slug });
      setPendingSkyPaths({});
      setSkyStatus(`Applied the "${preset.name}" template.`);
      await refreshState();
      onApplied();
    } catch (err) {
      setSkyStatus(String(err));
    } finally {
      setSkyBusy(false);
    }
  }

  // A template is "active" while all six faces still carry its name.
  const activePreset = presets.find((p) =>
    SKY_FACES.every(({ key }) => appliedSkyFaces[key] === p.name),
  );
  const anySkyApplied = Object.keys(appliedSkyFaces).length > 0;
  const anySkyPending = Object.keys(pendingSkyPaths).length > 0;

  const fontDisplay = pendingFontPath
    ? baseName(pendingFontPath)
    : appliedFontName
      ? appliedFontName
      : "Choose font file…";

  return (
    <div className="appearance">
      <section className="appearance-block">
        <h3>Font</h3>
        <p className="appearance-hint">
          Replaces every standard Roblox font family with the file you pick.
        </p>
        <div className="appearance-row">
          <button className="picker-btn" onClick={pickFont} title={fontDisplay}>
            <span className="picker-btn-text">{fontDisplay}</span>
            {appliedFontName && !pendingFontPath && (
              <span className="picker-btn-tag">Active</span>
            )}
          </button>
          <button
            className="apply-btn"
            onClick={applyFont}
            disabled={!pendingFontPath || fontBusy}
          >
            {fontBusy ? "Working…" : "Apply"}
          </button>
          <button
            className="reset-btn"
            onClick={resetFont}
            disabled={(!appliedFontName && !pendingFontPath) || fontBusy}
            title="Go back to Roblox's own font"
          >
            Reset
          </button>
        </div>
        {fontStatus && <p className="appearance-status">{fontStatus}</p>}
      </section>

      <section className="appearance-block">
        <h3>Skybox</h3>
        <p className="appearance-hint">
          Tap a face on the unfolded cube below to replace it — unset faces
          stay default.
        </p>
        <div className="sky-net">
          {SKY_FACES.map(({ key, label, hint, area }) => {
            const applied = appliedSkyFaces[key];
            const pending = pendingSkyPaths[key];
            return (
              <button
                key={key}
                className={`sky-face-btn ${pending || applied ? "sky-face-btn--set" : ""}`}
                style={{ gridArea: area }}
                onClick={() => pickSkyFace(key)}
                title={hint}
              >
                <span className="sky-face-label">{label}</span>
                <span className="sky-face-code">{key}</span>
                {(pending || applied) && <span className="sky-face-check">✓</span>}
              </button>
            );
          })}
        </div>
        <div className="sky-actions">
          <button
            className="apply-btn"
            onClick={applySkybox}
            disabled={!anySkyPending || skyBusy}
          >
            {skyBusy ? "Working…" : "Apply skybox"}
          </button>
          <button
            className="reset-btn"
            onClick={resetSkybox}
            disabled={(!anySkyApplied && !anySkyPending) || skyBusy}
            title="Go back to Roblox's own sky"
          >
            Reset
          </button>
        </div>
        {skyStatus && <p className="appearance-status">{skyStatus}</p>}

        {presets.length > 0 && (
          <div className="sky-templates">
            <button
              className="sky-templates-head"
              onClick={() => setShowTemplates((v) => !v)}
              aria-expanded={showTemplates}
            >
              <span>Templates</span>
              <span className="sky-templates-count">{presets.length}</span>
              <span className="sky-templates-chevron">{showTemplates ? "▾" : "▸"}</span>
            </button>
            {showTemplates && (
              <div className="sky-templates-grid">
                {presets.map((p) => (
                  <button
                    key={p.slug}
                    className={`sky-template ${activePreset?.slug === p.slug ? "sky-template--on" : ""}`}
                    onClick={() => applyPreset(p)}
                    disabled={skyBusy}
                    title={`Apply "${p.name}"`}
                  >
                    <img src={thumbFor(p.slug)} alt="" draggable={false} />
                    <span>{p.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      <style>{`
        .appearance {
          display: flex;
          flex-direction: column;
        }
        .appearance-block {
          background: var(--bg-surface);
          border: 1px solid var(--line);
          border-radius: var(--radius-md);
          padding: 14px;
          margin-bottom: 14px;
          transition: border-color 160ms ease, transform 160ms ease;
        }
        .appearance-block:hover {
          border-color: var(--line-strong);
        }
        .appearance-block h3 {
          margin: 0 0 4px;
          font-size: 13.5px;
          font-weight: 700;
          font-family: var(--font-display);
        }
        .appearance-hint {
          margin: 0 0 12px;
          font-size: 11.5px;
          color: var(--ink-faint);
          line-height: 1.5;
        }
        .appearance-row {
          display: flex;
          gap: 8px;
          min-width: 0;
        }
        .picker-btn {
          flex: 1;
          min-width: 0;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          text-align: left;
          padding: 9px 12px;
          border-radius: 13px;
          border: 1px solid var(--line-strong);
          background: var(--bg-canvas);
          color: var(--ink-muted);
          font-size: 12.5px;
        }
        .picker-btn:hover {
          color: var(--ink);
        }
        .picker-btn-text {
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .picker-btn-tag {
          flex-shrink: 0;
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: var(--ember-text);
        }
        .apply-btn {
          flex-shrink: 0;
          padding: 9px 16px;
          border: none;
          border-radius: 0;
          clip-path: var(--poly-clip-sm);
          background: var(--ember-gradient);
          color: var(--ink-on-ember);
          font-size: 12.5px;
          font-weight: 800;
          white-space: nowrap;
          transition: filter 120ms ease, opacity 120ms ease, transform 100ms ease;
        }
        .apply-btn:hover:not(:disabled) {
          filter: brightness(1.07);
        }
        .apply-btn:active:not(:disabled) {
          transform: translateY(1px);
        }
        /* Disabled reads as "unavailable", not as a dim version of the
           call-to-action gold. */
        .apply-btn:disabled {
          background: var(--bg-surface-hover);
          color: var(--ink-faint);
          cursor: default;
        }
        .reset-btn {
          flex-shrink: 0;
          padding: 9px 14px;
          border: none;
          border-radius: 0;
          clip-path: var(--poly-clip-sm);
          background: var(--bg-surface-hover);
          color: var(--ink-muted);
          font-size: 12.5px;
          font-weight: 700;
          white-space: nowrap;
          transition: color 140ms ease, text-shadow 140ms ease, opacity 120ms ease;
        }
        .reset-btn:hover:not(:disabled) {
          color: var(--ember-text);
          text-shadow: 0 0 8px var(--glow);
        }
        .reset-btn:disabled {
          opacity: 0.45;
          cursor: default;
        }
        .sky-actions {
          display: flex;
          gap: 8px;
          margin-top: 10px;
        }
        .sky-actions .apply-btn {
          flex: 1;
        }
        .sky-templates {
          margin-top: 14px;
          padding-top: 10px;
          border-top: 1px solid var(--line);
        }
        .sky-templates-head {
          display: flex;
          align-items: center;
          gap: 8px;
          width: 100%;
          padding: 2px 0 8px;
          border: none;
          background: transparent;
          color: var(--ink);
          font-size: 12.5px;
          font-weight: 700;
          font-family: var(--font-display);
          text-align: left;
        }
        .sky-templates-count {
          font-size: 11px;
          font-weight: 600;
          color: var(--ink-faint);
        }
        .sky-templates-chevron {
          margin-left: auto;
          color: var(--ink-faint);
        }
        .sky-templates-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 8px;
          max-height: 218px;
          overflow-y: auto;
          padding: 2px 4px 2px 2px;
        }
        .sky-template {
          display: flex;
          flex-direction: column;
          gap: 4px;
          padding: 0;
          border: none;
          background: transparent;
          color: var(--ink-muted);
          font-size: 10.5px;
          text-align: center;
          min-width: 0;
        }
        .sky-template img {
          width: 100%;
          aspect-ratio: 1;
          object-fit: cover;
          border-radius: 13px;
          outline: 2px solid transparent;
          outline-offset: 1px;
          transition: outline-color 140ms ease, transform 140ms ease, filter 140ms ease;
        }
        .sky-template span {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .sky-template:hover:not(:disabled) img {
          transform: translateY(-1px);
          filter: brightness(1.08);
        }
        .sky-template:hover:not(:disabled) span {
          color: var(--ember-text);
          text-shadow: 0 0 8px var(--glow);
        }
        .sky-template--on img {
          outline-color: var(--ember);
        }
        .sky-template--on span {
          color: var(--ember-text);
        }
        .sky-template:disabled {
          opacity: 0.6;
          cursor: default;
        }
        .apply-btn--full {
          width: 100%;
          margin-top: 10px;
        }

        /* Unfolded-cube layout: Up above Front, Down below Front, Left/
           Right either side, Back at the end — matches how the 6 images
           actually wrap around the sky, instead of an arbitrary grid. */
        .sky-net {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          grid-template-rows: repeat(3, 46px);
          gap: 4px;
          grid-template-areas:
            ".  up  .   ."
            "lf ft  rt  bk"
            ".  dn  .   .";
        }
        .sky-face-btn {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 1px;
          border-radius: 12px;
          border: 1px solid var(--line-strong);
          background: var(--bg-canvas);
          color: var(--ink-muted);
          font-size: 11.5px;
          font-weight: 600;
          min-width: 0;
          position: relative;
          transition: transform 140ms ease, color 120ms ease, border-color 120ms ease;
          animation: reveal-up 300ms cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        .sky-face-btn:nth-child(1) { animation-delay: 0ms; }
        .sky-face-btn:nth-child(2) { animation-delay: 30ms; }
        .sky-face-btn:nth-child(3) { animation-delay: 60ms; }
        .sky-face-btn:nth-child(4) { animation-delay: 90ms; }
        .sky-face-btn:nth-child(5) { animation-delay: 120ms; }
        .sky-face-btn:nth-child(6) { animation-delay: 150ms; }
        .sky-face-btn:hover {
          color: var(--ink);
          transform: translateY(-1px);
        }
        .sky-face-btn--set {
          border-color: var(--ember);
          color: var(--ink);
        }
        .sky-face-code {
          font-size: 9px;
          font-weight: 500;
          letter-spacing: 0.03em;
          color: var(--ink-faint);
          text-transform: lowercase;
        }
        .sky-face-btn--set .sky-face-code {
          color: var(--ink-muted);
        }
        .sky-face-check {
          position: absolute;
          top: 3px;
          right: 5px;
          color: var(--ember-text);
          font-size: 10px;
        }
        .appearance-status {
          margin: 10px 0 0;
          font-size: 11.5px;
          color: var(--ink-muted);
        }
      `}</style>
    </div>
  );
}
