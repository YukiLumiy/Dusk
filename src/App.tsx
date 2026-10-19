import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { TitleBar } from "./components/TitleBar";
import { UpdateBanner } from "./components/UpdateBanner";
import { autoUpdateEnabled, checkForUpdate } from "./updater";
import { HeroBackground } from "./components/HeroBackground";
import { SunEmblem } from "./components/SunEmblem";
import { PrimaryButton, SecondaryButton } from "./components/Buttons";
import { StatusPill } from "./components/StatusPill";
import { SettingsScreen } from "./components/SettingsScreen";
import { TermsModal } from "./components/TermsModal";
import { configureSound, playSound } from "./sound";

type LaunchState = "idle" | "applying" | "launching" | "error";
type View = "home" | "settings";

interface ModProfileInfo {
  name: string;
  enabled: boolean;
  file_count: number;
}

interface LaunchResult {
  version_folder: string;
  files_applied: number;
  files_restored: number;
}

export default function App() {
  // Look for a new release shortly after start (can be turned off in Settings).
  useEffect(() => {
    if (!autoUpdateEnabled()) return;
    const timer = window.setTimeout(checkForUpdate, 3500);
    return () => window.clearTimeout(timer);
  }, []);

  const [view, setView] = useState<View>("home");
  // Which way the screen should slide: forward when entering Settings,
  // backward when returning home — a single directional cue instead of a
  // generic crossfade.
  const [direction, setDirection] = useState<"forward" | "backward">("forward");
  const [state, setState] = useState<LaunchState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeCount, setActiveCount] = useState<number | null>(null);
  const [showTerms, setShowTerms] = useState(false);
  // The swing-trail overlay. A fresh id remounts it, so every trigger
  // replays the animation from the start.

  async function refreshActiveCount() {
    try {
      const profiles = await invoke<ModProfileInfo[]>("list_mod_profiles");
      setActiveCount(profiles.filter((p) => p.enabled).length);
    } catch {
      setActiveCount(null);
    }
  }

  useEffect(() => {
    refreshActiveCount();
    invoke<{ theme: string; sound_enabled?: boolean; sound_volume?: number }>("get_settings").then((s) => {
      document.documentElement.setAttribute("data-theme", s.theme);
      configureSound({ enabled: s.sound_enabled ?? true, volume: s.sound_volume ?? 0.6 });
    });
  }, []);

  function openSettings() {
    setDirection("forward");
    setView("settings");
  }

  function goHome() {
    setDirection("backward");
    setView("home");
  }

  async function handleLaunch() {
    setState("applying");
    setErrorMessage(null);
    try {
      const result = await invoke<LaunchResult>("apply_mods_and_launch");
      setState("launching");
      console.log(
        `Applied to ${result.version_folder} — ${result.files_applied} files applied, ${result.files_restored} restored`,
      );
      setTimeout(() => setState("idle"), 2500);
    } catch (err) {
      setState("error");
      setErrorMessage(String(err));
      playSound("error");
    }
  }

  const statusText =
    state === "applying"
      ? "Applying mods…"
      : state === "launching"
        ? "Launching…"
        : state === "error"
          ? errorMessage ?? "Something went wrong"
          : "Ready";

  return (
    <div className="app">
      <TitleBar />
      <UpdateBanner />

      <div className="screen-viewport">
        <div key={view} className={`screen screen--${direction}`}>
          {view === "settings" ? (
            <SettingsScreen onBack={goHome} onProfilesChanged={refreshActiveCount} />
          ) : (
            <>
              <HeroBackground sky={<SunEmblem busy={state === "applying" || state === "launching"} />}>
                <h1 className="welcome-title">Start with Dusk</h1>
                <p key={statusText}
                  className={`welcome-status ${state === "error" ? "welcome-status--error" : ""} ${state === "applying" || state === "launching" ? "welcome-status--busy" : ""}`}
                >
                  {statusText}
                </p>

                <div className="actions">
                  <PrimaryButton
                    onClick={handleLaunch}
                    disabled={state === "applying" || state === "launching"}
                    loading={state === "applying" || state === "launching"}
                  >
                    Launch
                  </PrimaryButton>
                  <SecondaryButton onClick={openSettings}>Settings</SecondaryButton>
                </div>
              </HeroBackground>

              <div className="footer">
                <StatusPill tone={activeCount && activeCount > 0 ? "live" : "neutral"}>
                  {activeCount === null
                    ? "…"
                    : activeCount > 0
                      ? `${activeCount} mod${activeCount === 1 ? "" : "s"} active`
                      : "No mods active"}
                </StatusPill>
                <button className="terms-link" onClick={() => setShowTerms(true)}>
                  Terms
                </button>
              </div>
            </>
          )}
        </div>

      </div>

      {showTerms && <TermsModal onClose={() => setShowTerms(false)} />}

      <style>{appStyles}</style>
    </div>
  );
}

const appStyles = `
  .app {
    display: flex;
    flex-direction: column;
    height: 100vh;
    background: var(--bg-canvas);
    border-radius: var(--radius-window);
    border: 1px solid var(--line);
    box-shadow:
      0 30px 60px -20px rgba(0, 0, 0, 0.6),
      0 0 0 1px rgba(0, 0, 0, 0.3);
    overflow: hidden;
    position: relative;
  }
  /* Subtle grain so the flat dark surface doesn't read as an empty
     gradient — a fixed noise pattern, not decoration that competes with
     content. */
  .app::before {
    content: "";
    position: absolute;
    inset: 0;
    pointer-events: none;
    opacity: 0.05;
    mix-blend-mode: overlay;
    z-index: 5;
    background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='90' height='90'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>");
  }

  .screen-viewport {
    flex: 1;
    position: relative;
    overflow: hidden;
    display: flex;
  }
  .screen {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
  }
  .screen--forward {
    animation: slide-in-forward 340ms cubic-bezier(0.16, 1, 0.3, 1) both;
  }
  .screen--backward {
    animation: slide-in-backward 340ms cubic-bezier(0.16, 1, 0.3, 1) both;
  }
  @keyframes slide-in-forward {
    from { opacity: 0; transform: translateX(28px); }
    to { opacity: 1; transform: translateX(0); }
  }
  @keyframes slide-in-backward {
    from { opacity: 0; transform: translateX(-28px); }
    to { opacity: 1; transform: translateX(0); }
  }

  .emblem {
    position: relative;
    height: 188px;
    margin: -14px -30px 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .key-emblem {
    overflow: visible;
    animation: key-float 6.5s ease-in-out infinite;
    filter:
      drop-shadow(0 10px 14px rgba(0, 0, 0, 0.45))
      drop-shadow(0 0 11px var(--glow-soft));
  }
  :root[data-theme="light"] .key-emblem {
    filter:
      drop-shadow(0 10px 10px rgba(90, 58, 0, 0.28))
      drop-shadow(0 0 10px var(--glow-soft));
  }
  .key-glint {
    transform: translateX(-70px) skewX(-18deg);
    animation: key-glint 7.5s ease-in-out 1.6s infinite;
  }
  .key-emblem--spin .key-spin {
    animation: key-spin 1150ms cubic-bezier(0.45, 0.05, 0.25, 1) both;
  }
  @keyframes key-float {
    0%, 100% { transform: translateY(0) rotate(0deg); }
    50% { transform: translateY(-6px) rotate(1.4deg); }
  }
  @keyframes key-glint {
    0% { transform: translateX(-70px) skewX(-18deg); }
    26%, 100% { transform: translateX(190px) skewX(-18deg); }
  }
  /* A lazy full turn with a little lift — it rises, hangs, settles. */
  @keyframes key-spin {
    0%   { transform: translateY(0) rotate(0deg) scale(1); }
    38%  { transform: translateY(-14px) rotate(165deg) scale(1.07); }
    72%  { transform: translateY(-9px) rotate(305deg) scale(1.05); }
    100% { transform: translateY(0) rotate(360deg) scale(1); }
  }

  .welcome-title {
    margin: 0 0 6px;
    text-align: center;
    font-family: var(--font-display);
    font-weight: 800;
    font-size: 26px;
    letter-spacing: -0.02em;
  }
  .welcome-status {
    animation: reveal-up 320ms cubic-bezier(0.16, 1, 0.3, 1) both;
    margin: 0 0 32px;
    text-align: center;
    font-size: 13.5px;
    color: var(--ink-muted);
    transition: color 200ms ease;
  }
  .welcome-status--error {
    color: #ff8f8f;
  }
  .welcome-status--busy {
    animation: status-breathe 1.6s ease-in-out infinite;
  }
  @keyframes status-breathe {
    0%, 100% { opacity: 0.65; }
    50% { opacity: 1; }
  }
  .actions {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .footer {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 18px 0 26px;
    position: relative;
  }
  .terms-link {
    border: none;
    background: transparent;
    color: var(--ink-faint);
    font-size: 11px;
    text-decoration: underline;
    text-underline-offset: 2px;
    transition: color 120ms ease;
  }
  .terms-link:hover {
    color: var(--ink-muted);
  }
`;
