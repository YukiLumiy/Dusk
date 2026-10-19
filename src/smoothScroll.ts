/** Smooth mouse-wheel scrolling for every scrollable area in the app.
 *
 *  A wheel notch normally jumps ~100px at once. Here the notch only moves a
 *  target, and the list eases toward it each frame. Trackpads and other
 *  fine-grained input (small deltas) are left alone because they already
 *  scroll smoothly. Dragging the scrollbar or using the keyboard cancels
 *  the glide, so nothing fights the person. */

const NOTCH_MIN = 50; // deltas smaller than this come from a trackpad
const LINE_PX = 40;
const GLIDE_MS = 95; // lower = snappier, higher = floatier

interface Glide {
  target: number;
  last: number;
  raf: number;
  t: number;
}

const glides = new WeakMap<HTMLElement, Glide>();

function canScroll(el: HTMLElement, dy: number) {
  const style = getComputedStyle(el);
  if (!/(auto|scroll)/.test(style.overflowY)) return false;
  if (el.scrollHeight <= el.clientHeight + 1) return false;
  const atTop = el.scrollTop <= 0 && dy < 0;
  const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 1 && dy > 0;
  return !atTop && !atBottom;
}

function scrollableAncestor(start: EventTarget | null, dy: number): HTMLElement | null {
  let el = start instanceof HTMLElement ? start : null;
  while (el && el !== document.body && el !== document.documentElement) {
    if (canScroll(el, dy)) return el;
    el = el.parentElement;
  }
  return null;
}

function step(el: HTMLElement, glide: Glide, now: number) {
  // Someone else moved the list (scrollbar drag, keyboard, a link): stop.
  if (Math.abs(el.scrollTop - glide.last) > 2) {
    glides.delete(el);
    return;
  }
  const dt = Math.min(now - glide.t, 50);
  glide.t = now;
  const diff = glide.target - el.scrollTop;
  if (Math.abs(diff) < 1) {
    el.scrollTop = glide.target;
    glides.delete(el);
    return;
  }
  // Frame-rate independent easing.
  // At least one whole pixel per frame: scrollTop can snap to integers, and
  // a smaller step would never arrive.
  const move = diff * (1 - Math.exp(-dt / GLIDE_MS));
  el.scrollTop += Math.abs(move) < 1 ? Math.sign(diff) : move;
  glide.last = el.scrollTop;
  glide.raf = requestAnimationFrame((t) => step(el, glide, t));
}

export function initSmoothScroll() {
  window.addEventListener(
    "wheel",
    (e) => {
      if (e.ctrlKey || e.defaultPrevented) return;
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;

      let dy = e.deltaY;
      if (e.deltaMode === 1) dy *= LINE_PX;
      else if (e.deltaMode === 2) dy *= window.innerHeight;
      if (Math.abs(dy) < NOTCH_MIN) return; // trackpad: leave it native

      const el = scrollableAncestor(e.target, dy);
      if (!el) return;
      e.preventDefault();

      const max = el.scrollHeight - el.clientHeight;
      const running = glides.get(el);
      const base = running ? running.target : el.scrollTop;
      const target = Math.max(0, Math.min(max, base + dy));

      if (running) {
        running.target = target;
      } else {
        const glide: Glide = { target, last: el.scrollTop, raf: 0, t: performance.now() };
        glides.set(el, glide);
        glide.raf = requestAnimationFrame((t) => step(el, glide, t));
      }
    },
    { passive: false },
  );
}
