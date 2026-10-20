/*
 * UI sound effects.
 *
 * Sounds are audio files in assets/sfx (ogg, mp3, wav, m4a, flac or opus). A file fills the
 * slot that matches its name: launch.wav, launch.mp3 and launch.ogg all fill "launch".
 * They are decoded once into Web Audio
 * buffers so they can overlap and start with almost no latency. Most of the
 * app doesn't call this directly: initSound() installs one delegated
 * listener that plays a fitting sound for every button, picked from the
 * button's class (see pick()). A button can override it with
 * data-sfx="<name>" or silence itself with data-sfx="none".
 */
// Every audio file in assets/sfx is bundled; the file name picks the slot.
const FOUND = import.meta.glob("./assets/sfx/*.{ogg,mp3,wav,m4a,flac,opus}", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;
const FILES: Record<string, string> = {};
for (const [path, url] of Object.entries(FOUND)) {
  const base = (path.split("/").pop() ?? "").replace(/\.[^.]+$/, "").toLowerCase().replace(/[-\s]+/g, "_");
  FILES[base] = url;
}

export type SoundName =
  | "launch"
  | "moon"
  | "sun"
  | "update"
  | "swipe"
  | "shimmer"
  | "swing"
  | "whoosh"
  | "tick"
  | "toggle_off"
  | "error"
  | "chime";

/** Where each sound is used: launch = Launch button, moon / sun = the sun and
 *  moon change, update = a new version was found; the rest are button sounds. */
export const SOUND_NAMES: SoundName[] = [
  "launch", "moon", "sun", "update", "swipe", "shimmer", "swing", "whoosh", "tick", "toggle_off", "error", "chime",
];

/** Per-sound trim, so the master volume slider moves everything together. */
const BASE_GAIN: Record<SoundName, number> = {
  launch: 1,
  moon: 0.9,
  sun: 0.9,
  update: 0.8,
  swipe: 0.9,
  shimmer: 0.85,
  swing: 0.9,
  whoosh: 0.85,
  tick: 0.5,
  toggle_off: 0.7,
  error: 0.9,
  chime: 0.8,
};

export type SoundStatus = "loaded" | "missing" | "failed";
const status = new Map<SoundName, SoundStatus>();
/** undefined until the sounds have been loaded once. */
export const soundStatus = (name: SoundName): SoundStatus | undefined => status.get(name);

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
      const url = FILES[name];
      if (!url) {
        status.set(name, "missing");
        return;
      }
      try {
        const response = await fetch(url);
        buffers.set(name, await c.decodeAudioData(await response.arrayBuffer()));
        status.set(name, "loaded");
      } catch (err) {
        // A broken sound must never break the UI, but it should be findable.
        status.set(name, "failed");
        console.warn(`[sound] "${name}" couldn't be loaded:`, err);
      }
    }),
  ).then(() => undefined);
}

/** Loads (once) every sound; resolves when each one is loaded or has failed. */
export function loadSounds(): Promise<void> {
  const c = ensureContext();
  if (!c) return Promise.resolve();
  if (!loading) loading = loadAll(c);
  return loading;
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
  if (explicit && (SOUND_NAMES as string[]).includes(explicit)) return explicit as SoundName;

  // Runs before React handles the click, so aria-checked is the state the
  // switch is *leaving*.
  if (button.getAttribute("role") === "switch") {
    return button.getAttribute("aria-checked") === "true" ? "toggle_off" : "shimmer";
  }
  if (button.matches(".dusk-btn--primary")) return "launch";
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
