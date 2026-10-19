/*
 * UI sound effects.
 *
 * Sounds are small .ogg files in assets/sfx, decoded once into Web Audio
 * buffers so they can overlap and start with almost no latency. Most of the
 * app doesn't call this directly: initSound() installs one delegated
 * listener that plays a fitting sound for every button, picked from the
 * button's class (see pick()). A button can override it with
 * data-sfx="<name>" or silence itself with data-sfx="none".
 */
import launchUrl from "./assets/sfx/launch.ogg";
import swipeUrl from "./assets/sfx/swipe.ogg";
import shimmerUrl from "./assets/sfx/shimmer.ogg";
import swingUrl from "./assets/sfx/swing.ogg";
import whooshUrl from "./assets/sfx/whoosh.ogg";
import tickUrl from "./assets/sfx/tick.ogg";
import toggleOffUrl from "./assets/sfx/toggle_off.ogg";
import errorUrl from "./assets/sfx/error.ogg";
import chimeUrl from "./assets/sfx/chime.ogg";

export type SoundName =
  | "launch"
  | "swipe"
  | "shimmer"
  | "swing"
  | "whoosh"
  | "tick"
  | "toggle_off"
  | "error"
  | "chime";

const URLS: Record<SoundName, string> = {
  launch: launchUrl,
  swipe: swipeUrl,
  shimmer: shimmerUrl,
  swing: swingUrl,
  whoosh: whooshUrl,
  tick: tickUrl,
  toggle_off: toggleOffUrl,
  error: errorUrl,
  chime: chimeUrl,
};

/** Per-sound trim, so the master volume slider moves everything together. */
const BASE_GAIN: Record<SoundName, number> = {
  launch: 1,
  swipe: 0.9,
  shimmer: 0.85,
  swing: 0.9,
  whoosh: 0.85,
  tick: 0.5,
  toggle_off: 0.7,
  error: 0.9,
  chime: 0.8,
};

export const SOUND_NAMES = Object.keys(URLS) as SoundName[];

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let loading: Promise<void> | null = null;
const buffers = new Map<SoundName, AudioBuffer>();

let enabled = true;
let volume = 0.6;

export function configureSound(next: { enabled?: boolean; volume?: number }) {
  if (next.enabled !== undefined) enabled = next.enabled;
  if (next.volume !== undefined) {
    volume = Math.min(1, Math.max(0, next.volume));
    if (master) master.gain.value = volume;
  }
}

function ensureContext(): AudioContext | null {
  if (!ctx) {
    const Ctor: typeof AudioContext | undefined =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = volume;
    master.connect(ctx.destination);
  }
  // Browsers start contexts suspended until a user gesture.
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function loadAll(c: AudioContext): Promise<void> {
  return Promise.all(
    SOUND_NAMES.map(async (name) => {
      try {
        const response = await fetch(URLS[name]);
        const data = await response.arrayBuffer();
        buffers.set(name, await c.decodeAudioData(data));
      } catch {
        // A missing or undecodable sound must never break the UI.
      }
    }),
  ).then(() => undefined);
}

export function playSound(name: SoundName, options: { gain?: number; rate?: number } = {}) {
  if (!enabled || volume <= 0) return;
  const c = ensureContext();
  if (!c || !master) return;
  if (!loading) loading = loadAll(c);

  const buffer = buffers.get(name);
  if (!buffer) {
    // Very first sound: buffers are still decoding — play as soon as ready.
    void loading.then(() => {
      if (buffers.has(name)) playSound(name, options);
    });
    return;
  }

  const source = c.createBufferSource();
  source.buffer = buffer;
  source.playbackRate.value = options.rate ?? 1;
  const gain = c.createGain();
  gain.gain.value = BASE_GAIN[name] * (options.gain ?? 1);
  source.connect(gain);
  gain.connect(master);
  source.start();
}

// ----------------------------------------------------------- delegation

function buttonFrom(target: EventTarget | null): HTMLButtonElement | null {
  return (target as Element | null)?.closest?.("button") ?? null;
}

function pick(button: HTMLButtonElement): SoundName | null {
  const explicit = button.dataset.sfx;
  if (explicit === "none") return null;
  if (explicit && explicit in URLS) return explicit as SoundName;

  // Runs before React handles the click, so aria-checked is the state the
  // switch is *leaving*.
  if (button.getAttribute("role") === "switch") {
    return button.getAttribute("aria-checked") === "true" ? "toggle_off" : "shimmer";
  }
  // The Launch button is deliberately silent.
  if (button.matches(".dusk-btn--primary")) return null;
  if (button.matches(".dusk-btn--secondary, .back-btn")) return "swipe";
  if (button.matches(".terms-link, .terms-close")) return "whoosh";
  if (button.matches(".apply-btn")) return "swing";
  return "tick";
}

let lastHover = 0;

export function initSound() {
  // Warm the audio context + decode buffers on the first interaction so the
  // first real click is already instant.
  window.addEventListener(
    "pointerdown",
    () => {
      const c = ensureContext();
      if (c && !loading) loading = loadAll(c);
    },
    { once: true, capture: true },
  );

  document.addEventListener(
    "click",
    (event) => {
      const button = buttonFrom(event.target);
      if (!button || button.disabled) return;
      const name = pick(button);
      if (name) playSound(name);
    },
    true,
  );

  document.addEventListener(
    "pointerover",
    (event) => {
      const button = buttonFrom(event.target);
      if (!button || button.disabled || button.dataset.sfx === "none") return;
      if (buttonFrom((event as PointerEvent).relatedTarget) === button) return; // moving within it
      const now = performance.now();
      if (now - lastHover < 70) return;
      lastHover = now;
      playSound("tick", { gain: 0.35 });
    },
    true,
  );
}
