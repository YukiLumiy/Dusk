interface SunEmblemProps {
  /** True while Roblox is starting: the halos speed up and a ring pulses out. */
  busy?: boolean;
}

// [left %, top %, size %] of each crater on the moon's face. They sit on the
// rotating disc, so they travel with it.
const CRATERS: [number, number, number][] = [
  [58, 22, 17], [28, 40, 13], [67, 54, 11], [42, 68, 9], [18, 20, 8],
  [76, 33, 7], [51, 46, 6], [35, 14, 6], [12, 58, 7], [80, 64, 6], [60, 82, 9], [26, 74, 7],
];

/**
 * A sun on the horizon, ringed by slowly turning dotted halos. While the
 * pointer is over it (or the Launch / Settings buttons), HeroBackground moves
 * through the phases day → to-night → night → to-day and this component's CSS
 * does the rest: the disc turns clockwise and a moon is swept in.
 */
export function SunEmblem({ busy = false }: SunEmblemProps) {
  return (
    <div className={`sun-emblem ${busy ? "sun-emblem--busy" : ""}`}>
      <div className="glow glow--sun" />
      <div className="glow glow--moon" />
      <svg className="halos" viewBox="0 0 560 281" aria-hidden>
        <circle cx="280" cy="280" r="168" fill="none" stroke="currentColor" strokeOpacity="0.55" strokeWidth="1.5" />
        <circle className="halo" cx="280" cy="280" r="208" fill="none" stroke="currentColor" strokeOpacity="0.6" strokeWidth="2" strokeDasharray="2 14" strokeLinecap="round" />
        <circle className="halo halo--b" cx="280" cy="280" r="248" fill="none" stroke="currentColor" strokeOpacity="0.4" strokeWidth="1.5" strokeDasharray="1 20" strokeLinecap="round" />
      </svg>
      <div className="disc-pos">
        <div className="disc">
          <div className="disc-sun" />
          <div className="disc-moon">
            {CRATERS.map(([l, t, s], i) => (
              <i key={i} style={{ left: `${l}%`, top: `${t}%`, width: `${s}%`, height: `${s}%` }} />
            ))}
          </div>
        </div>
      </div>
      {busy && <span className="sun-pulse" />}
      <style>{`
        @property --q { syntax: "<angle>"; inherits: false; initial-value: 0deg; }
        .sun-emblem {
          position: relative;
          width: min(340px, 92%);
          aspect-ratio: 560 / 281;
          overflow: hidden;
          transform: translate(calc(var(--mx, 0) * 3px), calc(var(--my, 0) * 2px));
          transition: transform 600ms ease-out;
        }
        .glow { position: absolute; left: 50%; top: 100%; width: 96%; aspect-ratio: 1; border-radius: 50%; transform: translate(-50%, -50%); transition: opacity 3400ms ease-in-out; }
        .glow--sun { background: radial-gradient(circle, rgba(255, 122, 89, 0.55) 0%, rgba(255, 122, 89, 0.12) 36%, transparent 66%); animation: sun-breathe 7s ease-in-out infinite; }
        .glow--moon { background: radial-gradient(circle, rgba(170, 195, 255, 0.5) 0%, rgba(150, 175, 255, 0.1) 36%, transparent 66%); opacity: 0; }
        .hero--to-night .glow--sun, .hero--night .glow--sun { opacity: 0; animation: none; }
        .hero--to-night .glow--moon, .hero--night .glow--moon { opacity: 1; }
        @keyframes sun-breathe { 50% { opacity: 0.78; } }
        .halos { position: absolute; inset: 0; width: 100%; height: 100%; color: #ffc27a; transition: color 3400ms ease-in-out; }
        .hero--to-night .halos, .hero--night .halos { color: #bcd0ff; }
        .halo { transform-origin: 280px 280px; animation: spin 90s linear infinite; }
        .halo--b { animation-duration: 140s; animation-direction: reverse; }
        .sun-emblem--busy .halo { animation-duration: 14s; }
        .sun-emblem--busy .halo--b { animation-duration: 22s; }

        .disc-pos { position: absolute; left: 50%; top: 100%; width: 47.14%; aspect-ratio: 1; transform: translate(-50%, -50%); }
        .disc { position: relative; width: 100%; height: 100%; border-radius: 50%; }
        .disc-sun, .disc-moon { position: absolute; inset: 0; border-radius: 50%; }
        .disc-sun { background: linear-gradient(0deg, #ff7a59, #ffe0a8); }
        .disc-moon {
          opacity: 0;
          background: radial-gradient(circle at 36% 30%, #fbfcff 0%, #dfe4f6 38%, #b4bcd8 78%, #98a1c4 100%);
          box-shadow: inset -10px -12px 24px rgba(40, 50, 100, 0.35);
        }
        .disc-moon i {
          position: absolute;
          border-radius: 50%;
          background: radial-gradient(circle at 38% 36%, rgba(110, 120, 160, 0.5), rgba(160, 170, 205, 0.25) 62%, transparent 72%);
          box-shadow: inset 2px 3px 4px rgba(70, 80, 120, 0.45), inset -1px -1px 2px rgba(255, 255, 255, 0.55);
        }
        .hero--night .disc-moon { opacity: 1; }
        .hero--to-night .disc-moon {
          opacity: 1;
          -webkit-mask-image: conic-gradient(from 0deg, #000 calc(var(--q) - 14deg), transparent var(--q));
          mask-image: conic-gradient(from 0deg, #000 calc(var(--q) - 14deg), transparent var(--q));
          animation: dusk-wipe-in 3400ms cubic-bezier(0.45, 0.05, 0.25, 1) both;
        }
        .hero--to-day .disc-moon {
          opacity: 1;
          -webkit-mask-image: conic-gradient(from 0deg, transparent var(--q), #000 calc(var(--q) + 14deg));
          mask-image: conic-gradient(from 0deg, transparent var(--q), #000 calc(var(--q) + 14deg));
          animation: dusk-wipe-out 3400ms cubic-bezier(0.45, 0.05, 0.25, 1) both;
        }
        .hero--to-night .disc, .hero--to-day .disc { animation: dusk-turn 3400ms cubic-bezier(0.45, 0.05, 0.25, 1); }
        @keyframes dusk-turn { to { transform: rotate(360deg); } }
        @keyframes dusk-wipe-in { from { --q: 0deg; } to { --q: 374deg; } }
        @keyframes dusk-wipe-out { from { --q: -14deg; } to { --q: 360deg; } }

        .sun-pulse { position: absolute; left: 50%; top: 100%; width: 47%; aspect-ratio: 1; border-radius: 50%; border: 2px solid #ffc27a; transform: translate(-50%, -50%) scale(1); opacity: 0.7; animation: sun-pulse 1800ms ease-out infinite; pointer-events: none; }
        @keyframes sun-pulse { to { transform: translate(-50%, -50%) scale(2.2); opacity: 0; } }
      `}</style>
    </div>
  );
}
