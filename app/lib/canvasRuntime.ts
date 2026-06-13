// Shared runtime helpers for the canvas particle backdrops.
//
// Each section used to start a requestAnimationFrame loop on mount and never
// stop it — so every canvas kept rendering even while scrolled far off-screen,
// and every loop drew at the raw devicePixelRatio (9-16x the pixels on a 3x/4x
// display). These helpers keep the heavy loops cheap:
//   - clampedDpr(): cap pixel density so retina displays don't render needlessly
//   - runVisibleLoop(): only run the loop while the canvas is on-screen, and
//     skip animation entirely when the user prefers reduced motion.

export function clampedDpr(max = 2): number {
  if (typeof window === "undefined") return 1;
  return Math.min(window.devicePixelRatio || 1, max);
}

export function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

type LoopOptions = {
  // Frames to pre-render for the static (reduced-motion) fallback, so a
  // simulation that builds up over time doesn't render an empty first frame.
  warmupFrames?: number;
  // Start the loop slightly before the canvas scrolls into view (smooth start).
  rootMargin?: string;
};

// Runs `frame` — a SINGLE-frame draw that must NOT schedule its own rAF — only
// while `target` is on-screen. Returns a cleanup function (stops loop + observer).
export function runVisibleLoop(
  target: Element,
  frame: () => void,
  { warmupFrames = 1, rootMargin = "200px" }: LoopOptions = {}
): () => void {
  // Reduced motion: draw a populated static frame, then leave it be.
  if (prefersReducedMotion()) {
    for (let i = 0; i < Math.max(1, warmupFrames); i++) frame();
    return () => {};
  }

  let raf = 0;
  let running = false;
  const loop = () => {
    frame();
    raf = requestAnimationFrame(loop);
  };
  const start = () => {
    if (running) return;
    running = true;
    raf = requestAnimationFrame(loop);
  };
  const stop = () => {
    running = false;
    cancelAnimationFrame(raf);
  };

  const io = new IntersectionObserver(
    (entries) => {
      if (entries[0]?.isIntersecting) start();
      else stop();
    },
    { rootMargin }
  );
  io.observe(target);

  return () => {
    stop();
    io.disconnect();
  };
}

// Like runVisibleLoop, but the rAF loop is driven by an explicit active/inactive
// signal instead of an IntersectionObserver. The deck needs this because slides
// physically slide THROUGH the viewport during a swipe transition — an
// IntersectionObserver would briefly resume a neighbour's loop mid-transition.
// The deck calls start() when a slide becomes the active/front slide and stop()
// when it leaves, so only one canvas animates at a time.
export function makeActiveLoop(
  frame: () => void,
  { warmupFrames = 1 }: { warmupFrames?: number } = {}
): { start: () => void; stop: () => void; dispose: () => void } {
  // Reduced motion: draw a populated static frame once, never schedule rAF.
  if (prefersReducedMotion()) {
    let drawn = false;
    const drawOnce = () => {
      if (drawn) return;
      for (let i = 0; i < Math.max(1, warmupFrames); i++) frame();
      drawn = true;
    };
    return { start: drawOnce, stop: () => {}, dispose: () => {} };
  }

  let raf = 0;
  let running = false;
  const loop = () => {
    frame();
    raf = requestAnimationFrame(loop);
  };
  const start = () => {
    if (running) return;
    running = true;
    raf = requestAnimationFrame(loop);
  };
  const stop = () => {
    running = false;
    cancelAnimationFrame(raf);
  };
  return { start, stop, dispose: stop };
}
