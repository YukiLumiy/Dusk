import { useEffect, useRef, useState, type CSSProperties } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ToggleSwitch } from "./ToggleSwitch";
import { configureSound, loadSounds, soundStatus, type SoundName } from "../sound";

interface DuskSettings {
  release_channel: string | null;
  discord_rpc_enabled: boolean;
  theme: string;
  clear_cache_on_launch: boolean;
  clear_cache_on_exit: boolean;
  sound_enabled: boolean;
  sound_volume: number;
}

/** Sounds offered in the preview row, as [data-sfx name, label]. */
const SOUND_PREVIEW: [SoundName, string][] = [
  ["launch", "Launch"],
  ["moon", "Moon"],
  ["sun", "Sun"],
  ["update", "Update"],
  ["swipe", "Swipe"],
  ["shimmer", "Shimmer"],
  ["swing", "Swing"],
  ["whoosh", "Whoosh"],
  ["tick", "Tick"],
  ["toggle_off", "Toggle off"],
  ["error", "Error"],
  ["chime", "Chime"],
];

interface CacheClearResult {
  removed: number;
  bytes_freed: number;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

interface ServerLocation {
  ip: string;
  city: string | null;
  region: string | null;
  country: string | null;
  isp: string | null;
}

export function AdvancedSection() {
  const [settings, setSettings] = useState<DuskSettings | null>(null);
  const [channelInput, setChannelInput] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [serverLocation, setServerLocation] = useState<ServerLocation | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [serverBusy, setServerBusy] = useState(false);
  const [cacheBusy, setCacheBusy] = useState(false);
  const [cacheMessage, setCacheMessage] = useState<string | null>(null);
  const [cacheError, setCacheError] = useState<string | null>(null);
  const volumeSaveTimer = useRef<number | undefined>(undefined);
  const [, setSoundsLoaded] = useState(false);
  useEffect(() => {
    loadSounds().then(() => setSoundsLoaded(true));
  }, []);

  useEffect(() => {
    invoke<DuskSettings>("get_settings").then((s) => {
      setSettings(s);
      setChannelInput(s.release_channel ?? "");
    });
  }, []);

  // The slider fires continuously while dragging: apply the volume at once,
  // but write settings.json only after the user pauses.
  function changeVolume(volume: number) {
    configureSound({ volume });
    setSettings((prev) => (prev ? { ...prev, sound_volume: volume } : prev));
    window.clearTimeout(volumeSaveTimer.current);
    volumeSaveTimer.current = window.setTimeout(() => persist({ sound_volume: volume }), 350);
  }

  // Applies only the changed fields on top of the *latest* settings from the
  // backend. Other sections (e.g. the Asset replacer toggle) save settings
  // too, so writing back this component's older copy would silently undo them.
  async function persist(patch: Partial<DuskSettings>) {
    setSettings((prev) => (prev ? { ...prev, ...patch } : prev));
    try {
      const latest = await invoke<DuskSettings>("get_settings");
      await invoke("update_settings", { settings: { ...latest, ...patch } });
      setStatus(null);
    } catch (err) {
      setStatus(String(err));
    }
  }

  if (!settings) return null;

  async function clearCacheNow() {
    setCacheBusy(true);
    setCacheMessage(null);
    setCacheError(null);
    try {
      const result = await invoke<CacheClearResult>("clear_roblox_cache");
      setCacheMessage(
        result.removed === 0
          ? "Cache was already empty."
          : `Cleared ${formatBytes(result.bytes_freed)} of cached assets.`,
      );
    } catch (err) {
      setCacheError(String(err));
    } finally {
      setCacheBusy(false);
    }
  }

  async function checkServerLocation() {
    setServerBusy(true);
    setServerError(null);
    try {
      const result = await invoke<ServerLocation>("get_server_location");
      setServerLocation(result);
    } catch (err) {
      setServerLocation(null);
      setServerError(String(err));
    } finally {
      setServerBusy(false);
    }
  }

  return (
    <section className="appearance-block">
      <h3>Advanced</h3>

      <div className="field-row">
        <div className="field-text">
          <span className="field-label">Appearance</span>
          <p className="appearance-hint">Switch between dark and light.</p>
        </div>
        <div className="theme-switch" data-active={settings.theme}>
          <button
            className={`theme-option ${settings.theme === "dark" ? "theme-option--active" : ""}`}
            onClick={() => {
              document.documentElement.setAttribute("data-theme", "dark");
              persist({ theme: "dark" });
            }}
          >
            Dark
          </button>
          <button
            className={`theme-option ${settings.theme === "light" ? "theme-option--active" : ""}`}
            onClick={() => {
              document.documentElement.setAttribute("data-theme", "light");
              persist({ theme: "light" });
            }}
          >
            Light
          </button>
        </div>
      </div>

      <div className="field-row">
        <div className="field-text">
          <span className="field-label">Sound effects</span>
          <p className="appearance-hint">Swishes and glints on buttons and when launching.</p>
        </div>
        <ToggleSwitch
          checked={settings.sound_enabled ?? true}
          label="Toggle sound effects"
          onChange={(enabled) => {
            configureSound({ enabled });
            persist({ sound_enabled: enabled });
          }}
        />
      </div>

      <div className="vol-row">
        <input
          type="range"
          className="vol"
          min={0}
          max={100}
          value={Math.round((settings.sound_volume ?? 0.6) * 100)}
          style={{ "--pct": `${Math.round((settings.sound_volume ?? 0.6) * 100)}%` } as CSSProperties}
          aria-label="Sound volume"
          onChange={(e) => changeVolume(Number(e.target.value) / 100)}
        />
        <span className="vol-value">{Math.round((settings.sound_volume ?? 0.6) * 100)}%</span>
      </div>
      <div className="sfx-chips">
        {SOUND_PREVIEW.map(([name, label]) => (
          <button
            key={name}
            className={`sfx-chip ${soundStatus(name) && soundStatus(name) !== "loaded" ? "sfx-chip--off" : ""}`}
            data-sfx={name}
          >
            {label}
          </button>
        ))}
      </div>
      {SOUND_PREVIEW.some(([name]) => soundStatus(name) && soundStatus(name) !== "loaded") && (
        <p className="appearance-hint">
          Struck-through sounds have no usable file. Put a file named like the sound (for example launch.wav or
          launch.mp3) in src/assets/sfx and rebuild.
        </p>
      )}

      <div className="field-row">
        <div className="field-text">
          <span className="field-label">Discord Rich Presence</span>
          <p className="appearance-hint">
            Shows "In Roblox" on your Discord profile while it's running.
          </p>
        </div>
        <ToggleSwitch
          checked={settings.discord_rpc_enabled}
          label="Toggle Discord Rich Presence"
          onChange={(enabled) => persist({ discord_rpc_enabled: enabled })}
        />
      </div>

      <div className="field-row">
        <div className="field-text">
          <span className="field-label">Clear cache on launch</span>
          <p className="appearance-hint">
            Deletes Roblox's downloaded-asset cache just before it starts.
          </p>
        </div>
        <ToggleSwitch
          checked={settings.clear_cache_on_launch}
          label="Toggle clearing the cache on launch"
          onChange={(enabled) => persist({ clear_cache_on_launch: enabled })}
        />
      </div>

      <div className="field-row">
        <div className="field-text">
          <span className="field-label">Clear cache on exit</span>
          <p className="appearance-hint">
            Deletes it again after Roblox closes (while Dusk is running).
          </p>
        </div>
        <ToggleSwitch
          checked={settings.clear_cache_on_exit}
          label="Toggle clearing the cache on exit"
          onChange={(enabled) => persist({ clear_cache_on_exit: enabled })}
        />
      </div>

      <div className="field-column">
        <button
          className="apply-btn apply-btn--full"
          onClick={clearCacheNow}
          disabled={cacheBusy}
        >
          {cacheBusy ? "Clearing…" : "Clear cache now"}
        </button>
        {cacheMessage && <p className="appearance-hint">{cacheMessage}</p>}
        {cacheError && <p className="flag-error">{cacheError}</p>}
      </div>

      <div className="field-column">
        <span className="field-label">Release channel</span>
        <p className="appearance-hint">
          Leave blank for the default (production) channel.
        </p>
        <div className="appearance-row">
          <input
            className="flag-input"
            style={{ flex: 1 }}
            placeholder="e.g. zintegration"
            value={channelInput}
            onChange={(e) => setChannelInput(e.target.value)}
          />
          <button
            className="apply-btn"
            onClick={() =>
              persist({ release_channel: channelInput.trim() || null })
            }
          >
            Save
          </button>
        </div>
      </div>

      <div className="field-column">
        <span className="field-label">Server location</span>
        <p className="appearance-hint">
          Reads the current game server's IP from Roblox's own log file and
          looks up roughly where it's hosted. Only works while you're
          actually in a game.
        </p>
        <button
          className="apply-btn apply-btn--full"
          onClick={checkServerLocation}
          disabled={serverBusy}
        >
          {serverBusy ? "Checking…" : "Check current server"}
        </button>
        {serverLocation && (
          <div className="server-result">
            <span className="server-result-line">
              {[serverLocation.city, serverLocation.region, serverLocation.country]
                .filter(Boolean)
                .join(", ") || "Unknown location"}
            </span>
            <span className="server-result-meta">
              {serverLocation.ip}
              {serverLocation.isp ? ` · ${serverLocation.isp}` : ""}
            </span>
          </div>
        )}
        {serverError && <p className="flag-error">{serverError}</p>}
      </div>

      {status && <p className="flag-error">{status}</p>}

      <p className="appearance-hint appearance-hint--muted">
        Multi-instance launching is the one Bloxstrap feature not included
        here — it needs patching Roblox's own process at runtime (a
        different, riskier technique than the file modding this app
        otherwise does), so it's intentionally out of scope.
      </p>

      <style>{`
        .field-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 16px;
        }
        .field-text {
          flex: 1;
          min-width: 0;
        }
        .field-text .appearance-hint {
          margin-bottom: 0;
        }
        .field-column {
          margin-bottom: 12px;
        }
        .field-label {
          font-size: 12.5px;
          font-weight: 600;
          display: block;
        }
        .theme-switch {
          position: relative;
          display: flex;
          background: var(--bg-canvas);
          border: 1px solid var(--line-strong);
          border-radius: var(--radius-pill);
          padding: 3px;
          flex-shrink: 0;
        }
        /* One pill that slides between the options; it shares the outer
           pill's curvature, so it always sits flush inside the border. */
        .theme-switch::before {
          content: "";
          position: absolute;
          top: 3px;
          bottom: 3px;
          left: 3px;
          width: calc((100% - 6px) / 2);
          border-radius: var(--radius-pill);
          background: var(--ember-gradient);
          transition: transform 360ms cubic-bezier(0.34, 1.3, 0.5, 1);
        }
        .theme-switch[data-active="light"]::before { transform: translateX(100%); }
        .theme-option {
          position: relative;
          z-index: 1;
          flex: 1 1 0;
          min-width: 58px;
          text-align: center;
          border: none;
          background: transparent;
          color: var(--ink-muted);
          font-size: 11.5px;
          font-weight: 600;
          padding: 5px 12px;
          border-radius: var(--radius-pill);
          transition: color 200ms ease;
        }
        .theme-option--active { color: var(--ink-on-ember); }
        .vol-row {
          display: flex;
          align-items: center;
          gap: 10px;
          margin: -6px 0 12px;
        }
        .vol {
          -webkit-appearance: none;
          appearance: none;
          flex: 1;
          height: 5px;
          border-radius: 99px;
          outline: none;
          background: linear-gradient(to right, var(--ember) var(--pct), var(--line-strong) var(--pct));
        }
        .vol::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 15px;
          height: 15px;
          border-radius: 0;
          clip-path: circle(50%);
          background: var(--ember-gradient);
          border: none;
          cursor: pointer;
        }
        .vol-value {
          width: 34px;
          text-align: right;
          font-size: 11px;
          color: var(--ink-faint);
          font-variant-numeric: tabular-nums;
        }
        .sfx-chips {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-bottom: 16px;
        }
        .sfx-chip {
          border: 1px solid var(--line-strong);
          background: var(--bg-canvas);
          color: var(--ink-muted);
          font-size: 11px;
          font-weight: 600;
          padding: 5px 10px;
          border-radius: var(--radius-pill);
          transition: color 120ms ease, border-color 120ms ease;
        }
        .sfx-chip--off { opacity: 0.45; text-decoration: line-through; }
        .sfx-chip:hover {
          color: var(--ink);
          border-color: var(--ember-dark);
        }
        .appearance-hint--muted {
          margin-top: 14px;
          padding-top: 12px;
          border-top: 1px solid var(--line);
        }
        .server-result {
          margin-top: 8px;
          padding: 9px 10px;
          background: var(--bg-canvas);
          border: 1px solid var(--line);
          border-radius: 12px;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .server-result-line {
          font-size: 12.5px;
          font-weight: 600;
        }
        .server-result-meta {
          font-size: 10.5px;
          color: var(--ink-faint);
        }
      `}</style>
    </section>
  );
}
