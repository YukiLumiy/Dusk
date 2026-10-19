import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ToggleSwitch } from "./ToggleSwitch";
import { AppearanceSection } from "./AppearanceSection";
import { FastFlagsSection } from "./FastFlagsSection";
import { SkyboxFixSection } from "./SkyboxFixSection";
import { UpdateSection } from "./UpdateSection";
import { FFlagPresetsSection } from "./FFlagPresetsSection";
import { FFlagProfilesSection } from "./FFlagProfilesSection";
import { AdvancedSection } from "./AdvancedSection";

interface ModProfileInfo {
  name: string;
  enabled: boolean;
  file_count: number;
}

interface SettingsScreenProps {
  onBack: () => void;
  onProfilesChanged?: () => void;
}

export function SettingsScreen({ onBack, onProfilesChanged }: SettingsScreenProps) {
  const [profiles, setProfiles] = useState<ModProfileInfo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  // Which row is being renamed / is waiting for a second click to delete.
  const [renaming, setRenaming] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [armed, setArmed] = useState<string | null>(null);
  const armTimer = useRef<number | undefined>(undefined);
  // Remounts the Appearance block, so its "Active" tags follow a deleted or
  // renamed font/skybox profile.
  const [appearanceKey, setAppearanceKey] = useState(0);

  async function refresh() {
    try {
      const result = await invoke<ModProfileInfo[]>("list_mod_profiles");
      setProfiles(result);
      setError(null);
    } catch (err) {
      setError(String(err));
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleToggle(name: string, enabled: boolean) {
    setPending(name);
    try {
      await invoke("set_mod_profile_enabled", { name, enabled });
      await refresh();
      onProfilesChanged?.();
    } catch (err) {
      setError(String(err));
    } finally {
      setPending(null);
    }
  }

  useEffect(() => () => window.clearTimeout(armTimer.current), []);

  function startRename(name: string) {
    setRenaming(name);
    setDraft(name);
    setArmed(null);
    setError(null);
  }

  async function commitRename(oldName: string) {
    if (draft.trim() === oldName) {
      setRenaming(null);
      return;
    }
    setPending(oldName);
    try {
      await invoke("rename_mod_profile", { oldName, newName: draft });
      setRenaming(null);
      setError(null);
      await refresh();
      setAppearanceKey((k) => k + 1);
    } catch (err) {
      setError(String(err));
    } finally {
      setPending(null);
    }
  }

  async function handleDelete(name: string) {
    if (armed !== name) {
      setArmed(name);
      window.clearTimeout(armTimer.current);
      armTimer.current = window.setTimeout(() => setArmed(null), 3500);
      return;
    }
    window.clearTimeout(armTimer.current);
    setArmed(null);
    setPending(name);
    try {
      await invoke("delete_mod_profile", { name });
      setError(null);
      await refresh();
      onProfilesChanged?.();
      setAppearanceKey((k) => k + 1);
    } catch (err) {
      setError(String(err));
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="settings">
      <div className="settings-header">
        <button className="back-btn" onClick={onBack} aria-label="Back">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M10 3L5 8l5 5"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <h2>Settings</h2>
      </div>

      <AppearanceSection key={appearanceKey} onApplied={refresh} />
      <UpdateSection />
      <SkyboxFixSection />
      <FFlagPresetsSection />
      <FastFlagsSection />
      <FFlagProfilesSection />
      <AdvancedSection />

      <div className="profiles-heading-row">
        <h3 className="section-label">Mod profiles</h3>
        <button className="open-folder-btn" onClick={() => invoke("open_mods_folder")}>
          Open mods folder
        </button>
      </div>

      {error && <p className="settings-error">{error}</p>}

      {profiles === null && !error && (
        <p className="settings-empty">Loading…</p>
      )}

      {profiles?.length === 0 && (
        <p className="settings-empty">
          No profiles yet. Add a folder under <code>mods/</code> to see it
          here.
        </p>
      )}

      <ul className="profile-list">
        {profiles?.map((profile, i) => (
          <li
            key={profile.name}
            className="profile-row"
            style={{ animationDelay: `${i * 45}ms` }}
          >
            <div className="profile-info">
              {renaming === profile.name ? (
                <input
                  className="profile-rename"
                  value={draft}
                  autoFocus
                  spellCheck={false}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void commitRename(profile.name);
                    if (e.key === "Escape") setRenaming(null);
                  }}
                />
              ) : (
                <span className="profile-name" title={profile.name}>{profile.name}</span>
              )}
              <span className="profile-meta">{profile.file_count} files</span>
            </div>
            <div className="profile-actions">
              {renaming === profile.name ? (
                <>
                  <button className="icon-btn" aria-label="Save name" title="Save" onClick={() => commitRename(profile.name)} disabled={pending === profile.name}>
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3 8.5l3.2 3.2L13 4.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </button>
                  <button className="icon-btn" aria-label="Cancel" title="Cancel" onClick={() => setRenaming(null)}>
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
                  </button>
                </>
              ) : (
                <>
                  <button className="icon-btn" aria-label={`Rename ${profile.name}`} title="Rename" onClick={() => startRename(profile.name)} disabled={pending === profile.name}>
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M10.5 3.2l2.3 2.3M2.8 13.2l.5-2.9 7.2-7.1 2.3 2.3-7.1 7.2-2.9.5z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round" /></svg>
                  </button>
                  <button
                    className={`icon-btn ${armed === profile.name ? "icon-btn--danger" : ""}`}
                    aria-label={`Delete ${profile.name}`}
                    title="Delete"
                    onClick={() => handleDelete(profile.name)}
                    disabled={pending === profile.name}
                  >
                    {armed === profile.name ? (
                      <span className="icon-btn-text">Delete?</span>
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 8.5h5.8l.6-8.5M6.8 7v3.8M9.2 7v3.8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    )}
                  </button>
                </>
              )}
              <ToggleSwitch
                checked={profile.enabled}
                disabled={pending === profile.name || renaming === profile.name}
                label={`Toggle ${profile.name}`}
                onChange={(next) => handleToggle(profile.name, next)}
              />
            </div>
          </li>
        ))}
      </ul>

      <style>{`
        .settings {
          flex: 1;
          display: flex;
          flex-direction: column;
          padding: 4px 20px 20px;
          overflow-y: auto;
          scrollbar-width: none;
          animation: reveal-up 360ms cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        .settings::-webkit-scrollbar {
          display: none;
        }
        .settings-header {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 0 18px;
        }
        .settings-header h2 {
          margin: 0;
          font-family: var(--font-display);
          font-size: 16px;
          font-weight: 700;
          letter-spacing: -0.01em;
        }
        .back-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
          border: none;
          background: transparent;
          color: var(--ink-muted);
          border-radius: 12px;
          transition: background 120ms ease, color 120ms ease;
        }
        .back-btn:hover {
          background: var(--bg-surface);
          color: var(--ink);
        }
        .section-label {
          margin: 0 0 8px;
          font-size: 11.5px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: var(--ink-faint);
        }
        .profiles-heading-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          margin-bottom: 8px;
        }
        .profiles-heading-row .section-label {
          margin-bottom: 0;
        }
        .open-folder-btn {
          border: 1px solid var(--line-strong);
          background: transparent;
          color: var(--ink-muted);
          font-size: 11px;
          font-weight: 600;
          padding: 5px 10px;
          border-radius: 11px;
          transition: color 120ms ease, border-color 120ms ease;
        }
        .open-folder-btn:hover {
          color: var(--ink);
          border-color: var(--ink-muted);
        }
        .settings-empty,
        .settings-error {
          font-size: 13px;
          color: var(--ink-muted);
          padding: 12px 2px;
        }
        .settings-error {
          color: #ff8f8f;
        }
        .profile-list {
          list-style: none;
          margin: 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .profile-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 14px;
          background: var(--bg-surface);
          border: 1px solid var(--line);
          border-radius: var(--radius-md);
          animation: reveal-up 320ms cubic-bezier(0.16, 1, 0.3, 1) both;
          transition: border-color 140ms ease, transform 140ms ease;
        }
        .profile-row:hover {
          border-color: var(--line-strong);
          transform: translateY(-1px);
        }
        .profile-info {
          display: flex;
          flex-direction: column;
          gap: 2px;
          flex: 1;
          min-width: 0;
          margin-right: 8px;
        }
        .profile-name {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .profile-actions {
          display: flex;
          align-items: center;
          gap: 4px;
          flex-shrink: 0;
        }
        .icon-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          min-width: 26px;
          height: 26px;
          padding: 0 4px;
          border: none;
          border-radius: 12px;
          background: transparent;
          color: var(--ink-faint);
          transition: color 140ms ease, background 140ms ease;
        }
        .icon-btn:hover:not(:disabled) {
          color: var(--ink);
          background: var(--bg-surface-hover);
        }
        .icon-btn:disabled {
          opacity: 0.4;
          cursor: default;
        }
        .icon-btn--danger,
        .icon-btn--danger:hover:not(:disabled) {
          color: #ff8f8f;
        }
        .icon-btn-text {
          font-size: 11px;
          font-weight: 700;
          white-space: nowrap;
        }
        .profile-rename {
          width: 100%;
          min-width: 0;
          padding: 4px 8px;
          font: inherit;
          font-size: 13.5px;
          color: var(--ink);
          background: var(--bg-canvas);
          border: 1px solid var(--ember);
          border-radius: 12px;
          outline: none;
          user-select: text;
        }
        .profile-name {
          font-size: 13.5px;
          font-weight: 500;
        }
        .profile-meta {
          font-size: 11.5px;
          color: var(--ink-faint);
        }
      `}</style>
    </div>
  );
}
