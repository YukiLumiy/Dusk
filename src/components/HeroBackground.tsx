import { useRef, useState, type AnimationEvent, type CSSProperties, type PointerEvent, type ReactNode } from "react";

interface HeroBackgroundProps {
  /** Drawn on the horizon, in the sky half (the sun / moon). */
  sky?: ReactNode;
  /** Drawn below the horizon (title, status, buttons). */
  children: ReactNode;
}

type Phase = "day" | "to-night" | "night" | "to-day";

// Pointer over any of these turns the sun into the moon.
const TARGETS = ".sun-emblem, .dusk-btn--primary, .dusk-btn--secondary";
const isTarget = (n: EventTarget | null) => n instanceof Element && n.closest(TARGETS) !== null;

// Fixed star positions (deterministic, so the sky never reshuffles).
const STARS = (() => {
  let s = 7;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  return Array.from({ length: 46 }, () => ({ x: rnd() * 400, y: rnd() * 200, r: 0.6 + rnd() * 0.9, o: 0.25 + rnd() * 0.65, d: rnd() * 6, t: 3 + rnd() * 4 }));
})();

export function HeroBackground({ sky, children }: HeroBackgroundProps) {
  const [phase, setPhase] = useState<Phase>("day");
  const phaseRef = useRef<Phase>("day");
  const over = useRef(false);
  const root = useRef<HTMLDivElement>(null);
  const raf = useRef(0);

  function go(p: Phase) {
    phaseRef.current = p;
    setPhase(p);
  }
  // Starts the next transition only when none is running: a pointer that
  // leaves and comes back mid-animation changes nothing until it has finished,
  // and the scene then settles on wherever the pointer is.
  function sync() {
    const cur = phaseRef.current;
    if (cur === "day" && over.current) go("to-night");
    else if (cur === "night" && !over.current) go("to-day");
  }
  function onOver(e: PointerEvent) {
    if (isTarget(e.target)) { over.current = true; sync(); }
  }
  function onOut(e: PointerEvent) {
    if (isTarget(e.target) && !isTarget(e.relatedTarget)) { over.current = false; sync(); }
  }
  function onEnd(e: AnimationEvent) {
    if (e.animationName !== "dusk-turn") return;
    go(phaseRef.current === "to-night" ? "night" : "day");
    sync();
  }
  // Slight parallax: the stars and the sun drift against the pointer.
  function onMove(e: PointerEvent<HTMLDivElement>) {
    const el = root.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width - 0.5) * 2;
    const y = ((e.clientY - r.top) / r.height - 0.5) * 2;
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(() => {
      el.style.setProperty("--mx", x.toFixed(3));
      el.style.setProperty("--my", y.toFixed(3));
    });
  }

  return (
    <div ref={root} className={`hero hero--${phase}`} onPointerOver={onOver} onPointerOut={onOut} onAnimationEnd={onEnd} onPointerMove={onMove}>
      <div className="hero-night" aria-hidden />
      <svg className="hero-stars" viewBox="0 0 400 200" preserveAspectRatio="xMidYMin slice" aria-hidden>
        {STARS.map((st, i) => (
          <circle key={i} className="star" cx={st.x} cy={st.y} r={st.r} fill="#fff3e6"
            style={{ "--o": st.o, animationDelay: `${st.d}s`, animationDuration: `${st.t}s` } as CSSProperties} />
        ))}
      </svg>
      <div className="hero-sky">
        {sky}
        <i className="shoot" />
        <i className="shoot shoot--b" />
      </div>
      <div className="hero-water">
        <div className="hero-reflect" aria-hidden>
          <i />
          <i />
          <i />
        </div>
        <div className="hero-content">{children}</div>
      </div>
      <style>{`
        .hero {
          position: relative;
          isolation: isolate;
          flex: 1;
          display: grid;
          grid-template-rows: 50% 50%;
          overflow: hidden;
          background: linear-gradient(180deg,
            var(--sky-top) 0%, var(--sky-mid) 28%, var(--sky-low) 46%,
            var(--horizon) 50%, var(--ground) 50%, var(--ground-deep) 100%);
        }
        /* The night sky fades in over the day sky while the moon is swept in. */
        .hero-night {
          position: absolute; inset: 0; z-index: -1; opacity: 0;
          background: linear-gradient(180deg, var(--bg-canvas) 0%, #0b1230 30%, #15244a 46%, #2a3b66 50%, #080b18 50%, var(--bg-canvas) 100%);
          transition: opacity 3400ms cubic-bezier(0.45, 0.05, 0.25, 1);
        }
        .hero--to-night .hero-night, .hero--night .hero-night { opacity: 1; }
        .hero-stars {
          position: absolute; left: 0; top: 0; width: 100%; height: 50%; pointer-events: none;
          opacity: var(--stars);
          transform: translate(calc(var(--mx, 0) * -5px), calc(var(--my, 0) * -4px));
          transition: opacity 3400ms ease-in-out, transform 700ms ease-out;
        }
        .hero--to-night .hero-stars, .hero--night .hero-stars { opacity: 1; }
        .star { animation: star-twinkle 5s ease-in-out infinite; }
        @keyframes star-twinkle { 0%, 100% { opacity: var(--o); } 50% { opacity: calc(var(--o) * 0.3); } }
        .hero-sky { position: relative; display: flex; align-items: flex-end; justify-content: center; color: var(--ember-light); transition: color 3400ms ease-in-out; }
        .hero--to-night .hero-sky, .hero--night .hero-sky { color: #bcd0ff; }
        .hero-sky::after { content: ""; position: absolute; left: 8%; right: 8%; bottom: -1px; height: 1px; background: linear-gradient(90deg, transparent, currentColor, transparent); opacity: 0.8; }
        .shoot { position: absolute; left: 14%; top: 12%; width: 84px; height: 1.5px; opacity: 0; pointer-events: none; background: linear-gradient(90deg, transparent, #fff); }
        .shoot--b { left: 56%; top: 24%; }
        .hero--night .shoot { animation: shoot 6.5s linear infinite 1s; }
        .hero--night .shoot--b { animation-delay: 4.2s; }
        @keyframes shoot {
          0% { transform: translate(0, 0) rotate(24deg); opacity: 0; }
          3% { opacity: 1; }
          12% { transform: translate(170px, 76px) rotate(24deg); opacity: 0; }
          100% { transform: translate(170px, 76px) rotate(24deg); opacity: 0; }
        }
        .hero-water { position: relative; display: flex; flex-direction: column; align-items: center; }
        .hero-reflect { position: absolute; top: 8px; display: flex; flex-direction: column; align-items: center; gap: 6px; pointer-events: none; color: var(--ember); transition: color 3400ms ease-in-out; }
        .hero--to-night .hero-reflect, .hero--night .hero-reflect { color: #a9c0ff; }
        .hero-reflect i { display: block; height: 2px; border-radius: 2px; background: linear-gradient(90deg, transparent, currentColor, transparent); animation: reflect-shimmer 5s ease-in-out infinite; }
        .hero-reflect i:nth-child(1) { width: 170px; }
        .hero-reflect i:nth-child(2) { width: 110px; animation-delay: 0.6s; }
        .hero-reflect i:nth-child(3) { width: 56px; animation-delay: 1.2s; }
        @keyframes reflect-shimmer { 50% { opacity: 0.35; transform: scaleX(0.82); } }
        .hero-content { position: relative; z-index: 1; width: 280px; margin-top: 34px; display: flex; flex-direction: column; align-items: stretch; }
        /* Staggered entrance: title, status, then the buttons. */
        .hero-content > * { animation: reveal-up 560ms cubic-bezier(0.16, 1, 0.3, 1) both; }
        .hero-content > :nth-child(2) { animation-delay: 90ms; }
        .hero-content > :nth-child(3) { animation-delay: 180ms; }
      `}</style>
    </div>
  );
}
