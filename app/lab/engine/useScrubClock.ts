"use client";

import { useEffect, useImperativeHandle, useRef, type Ref } from "react";
import type { SlideHandle } from "../../deck/types";

export type ScrubControls = {
  /** Restart playback from 0 (real-time). For a loop screen, this builds then
   *  keeps the ambient layer running forever. */
  play: () => void;
  /** Pause the rAF (remembers where it was so startLoop can resume). */
  pause: () => void;
  /** Jump to the final composed frame. For a loop screen this also resumes the
   *  ambient loop (unless reduced-motion) so re-entry shows a LIVING screen, not
   *  a frozen one. Never fires onDone. */
  seekEnd: () => void;
  /** Resume the ambient loop after the build has finished (no-op before the
   *  build completes, so first-entry play() owns the build). */
  startLoop: () => void;
  /** Render one exact frame at time t — used by playback, replay, and the
   *  frame-by-frame audit hook. Loop screens accept t > duration so the ambient
   *  phase can be audited too. */
  renderAt: (t: number) => void;
};

/**
 * The backbone of every finalized screen: the whole visual is a PURE FUNCTION of
 * one clock. `onFrame(t)` must draw everything (canvas + overlay state) for time
 * `t` and nothing else — no internal timers. That gives us several things free:
 *   - real-time playback (rAF drives onFrame),
 *   - reduced-motion / deck "seek to end" (renderAt(duration)),
 *   - ONE-SHOT-THEN-LOOP: with `loop:true` the clock never stops at `duration`;
 *     it keeps advancing `t` forever. Build segments authored with seg(t,a,b)
 *     clamp to their end-state and HOLD, while ambient elements authored as
 *     `t % period` / `sin(t)` keep cycling — so the screen builds once then
 *     loops gracefully instead of freezing.
 *   - a frame-by-frame AUDIT: `window.__lab.renderAt(t)` renders any frame on
 *     demand, so we can screenshot the whole sequence (build AND ambient) even
 *     when the tab is backgrounded (which freezes rAF). This is how we stop
 *     building blind.
 *
 * PERF: the React `onFrame` mirror should only push per-frame state DURING the
 * build (~15s). Once t passes `duration` almost nothing in the DOM changes, so
 * screens freeze their React state and let canvas-rAF (+ CSS) carry the ambient
 * motion — otherwise the overlay tree re-renders at 60fps forever (jank).
 */
export function useScrubClock(
  onFrame: (t: number) => void,
  {
    duration,
    reduced,
    autoPlay = true,
    onDone,
    loop = false,
  }: {
    duration: number;
    reduced: boolean;
    autoPlay?: boolean;
    onDone?: () => void;
    /** When true, playback never stops at `duration` — it keeps advancing t so
     *  ambient (modulo/sine) elements loop forever. */
    loop?: boolean;
  }
): ScrubControls {
  const onFrameRef = useRef(onFrame);
  onFrameRef.current = onFrame;
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  const raf = useRef(0);
  const start = useRef(0); // performance.now() anchoring t=0 of the current run
  const pausedT = useRef(0); // elapsed time captured at pause(), for resume
  const running = useRef(false);
  const scrubbing = useRef(false);
  const doneFired = useRef(false);
  const controlsRef = useRef<ScrubControls | null>(null);

  useEffect(() => {
    const tick = (now: number) => {
      if (scrubbing.current || !running.current) return;
      const elapsed = (now - start.current) / 1000;
      const t = loop ? elapsed : Math.min(duration, elapsed);
      onFrameRef.current(t);
      if (elapsed >= duration && !doneFired.current) {
        // Fires only when natural playback REACHES the end — never on seek — so
        // the deck's "completed" (and Replay-on-re-entry) can't be triggered by
        // a reduced-motion / re-entry seekToEnd.
        doneFired.current = true;
        onDoneRef.current?.();
      }
      if (loop) {
        raf.current = requestAnimationFrame(tick); // never stops while running
      } else if (elapsed < duration) {
        raf.current = requestAnimationFrame(tick);
      } else {
        running.current = false;
      }
    };

    const play = () => {
      scrubbing.current = false;
      doneFired.current = false;
      pausedT.current = 0;
      cancelAnimationFrame(raf.current);
      if (reduced) {
        running.current = false;
        onFrameRef.current(duration);
        return;
      }
      running.current = true;
      start.current = performance.now();
      raf.current = requestAnimationFrame(tick);
    };

    const pause = () => {
      if (running.current) pausedT.current = (performance.now() - start.current) / 1000;
      running.current = false;
      cancelAnimationFrame(raf.current);
    };

    const seekEnd = () => {
      scrubbing.current = true;
      cancelAnimationFrame(raf.current);
      doneFired.current = true; // considered complete, but onDone is NOT fired
      onFrameRef.current(duration);
      if (loop && !reduced) {
        // Re-entry / standalone: keep the screen ALIVE — resume the ambient loop
        // anchored at the end of the build.
        scrubbing.current = false;
        running.current = true;
        start.current = performance.now() - duration * 1000;
        raf.current = requestAnimationFrame(tick);
      } else {
        running.current = false;
      }
    };

    const startLoop = () => {
      if (reduced) return;
      if (running.current) return; // already animating (e.g. play() in progress)
      if (!doneFired.current) return; // build not done yet → let play() own it
      scrubbing.current = false;
      running.current = true;
      const resumeT = pausedT.current > 0 ? pausedT.current : duration;
      start.current = performance.now() - resumeT * 1000;
      raf.current = requestAnimationFrame(tick);
    };

    const renderAt = (t: number) => {
      scrubbing.current = true;
      running.current = false;
      cancelAnimationFrame(raf.current);
      const tt = loop ? Math.max(0, t) : Math.max(0, Math.min(duration, t));
      onFrameRef.current(tt);
    };

    const controls: ScrubControls = { play, pause, seekEnd, startLoop, renderAt };
    controlsRef.current = controls;
    (window as unknown as { __lab?: unknown }).__lab = { ...controls, duration, loop };

    if (reduced) onFrameRef.current(duration);
    else if (autoPlay) play();
    else onFrameRef.current(0);

    return () => cancelAnimationFrame(raf.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duration, reduced, autoPlay, loop]);

  // Stable proxy so callers can wire buttons/deck handles without stale closures.
  return {
    play: () => controlsRef.current?.play(),
    pause: () => controlsRef.current?.pause(),
    seekEnd: () => controlsRef.current?.seekEnd(),
    startLoop: () => controlsRef.current?.startLoop(),
    renderAt: (t: number) => controlsRef.current?.renderAt(t),
  };
}

/**
 * Bridges a screen's scrub clock to the deck's imperative SlideHandle. When the
 * screen is mounted inside the deck (handleRef provided), SlideFrame drives it:
 *   play()      → restart from 0 on first entry / Replay (build, then loop)
 *   seekToEnd() → jump to the finished frame on re-entry / reduced-motion
 *                 (loop screens resume the ambient loop so it stays alive)
 *   startLoop() → ensure the ambient loop is running while the slide is active
 *   stopLoop()  → pause when the slide leaves (no offscreen rAF)
 */
export function useDeckHandle(controls: ScrubControls, handleRef?: Ref<SlideHandle>) {
  useImperativeHandle(
    handleRef ?? null,
    () => ({
      play: () => controls.play(),
      seekToEnd: () => controls.seekEnd(),
      startLoop: () => controls.startLoop(),
      stopLoop: () => controls.pause(),
    }),
    [controls]
  );
}

/** Smoothstep-ish helpers shared by the screens (all pure functions of t). */
export const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
export const seg = (t: number, a: number, b: number) => clamp01((t - a) / (b - a));
export const easeOut = (x: number) => 1 - Math.pow(1 - x, 3);
export const easeInOut = (x: number) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);
export const easeOutBack = (x: number) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
};
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/**
 * Ambient-loop helper: a triangle/back-and-forth wave in [0,1] with period
 * `period` seconds, so e.g. day↔night or a pulse eases out AND back with no
 * jump at the cycle boundary. Pure function of t → seamless by construction.
 */
export const pingPong = (t: number, period: number) => {
  const x = ((t % period) + period) % period / period; // 0..1
  return x < 0.5 ? x * 2 : 2 - x * 2;
};

/**
 * Ambient-loop helper: a normalized phase in [0,1) advancing once per `period`
 * seconds, offset by `offset` (0..1). Use for particles travelling a path —
 * pair with a fade that reaches 0 at BOTH ends (f→0 and f→1) so the packet
 * disappears before it wraps (no teleport). Pure function of t.
 */
export const phase = (t: number, period: number, offset = 0) =>
  (((t / period + offset) % 1) + 1) % 1;
