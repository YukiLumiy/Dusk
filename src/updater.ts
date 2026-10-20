import { useSyncExternalStore } from "react";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { playSound } from "./sound";

export type UpdateState =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "none" }
  | { kind: "available"; version: string; notes: string | null }
  | { kind: "downloading"; version: string; percent: number | null }
  | { kind: "error"; message: string };

// One shared state, so the banner on the home screen and the card in Settings agree.
let state: UpdateState = { kind: "idle" };
let pending: Update | null = null;
const listeners = new Set<() => void>();

function set(next: UpdateState) {
  state = next;
  listeners.forEach((fn) => fn());
}

export function useUpdateState(): UpdateState {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => state,
  );
}

const AUTO_KEY = "dusk.autoUpdate";
export const autoUpdateEnabled = () => localStorage.getItem(AUTO_KEY) !== "off";
export const setAutoUpdate = (on: boolean) => localStorage.setItem(AUTO_KEY, on ? "on" : "off");

/** Asks GitHub (through the updater endpoint) whether a newer release exists. */
export async function checkForUpdate() {
  if (state.kind === "checking" || state.kind === "downloading") return;
  set({ kind: "checking" });
  try {
    const update = await check();
    if (update) {
      pending = update;
      set({ kind: "available", version: update.version, notes: update.body ?? null });
      playSound("update");
    } else {
      pending = null;
      set({ kind: "none" });
    }
  } catch (err) {
    set({ kind: "error", message: String(err) });
  }
}

/** Downloads and runs the installer; Dusk closes and the new version starts. */
export async function installUpdate() {
  if (!pending) return;
  const version = pending.version;
  let total = 0;
  let received = 0;
  set({ kind: "downloading", version, percent: null });
  try {
    await pending.downloadAndInstall((event) => {
      if (event.event === "Started") total = event.data.contentLength ?? 0;
      else if (event.event === "Progress") {
        received += event.data.chunkLength;
        set({ kind: "downloading", version, percent: total ? Math.min(100, Math.round((received / total) * 100)) : null });
      }
    });
    await relaunch();
  } catch (err) {
    set({ kind: "error", message: String(err) });
  }
}
