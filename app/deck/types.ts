import type React from "react";

/**
 * A slide either plays once and stops ("one-shot"), runs an ambient loop
 * forever ("loop"), or plays an intro to completion and then settles into an
 * ambient loop ("one-shot-then-loop"). The deck uses this to decide whether a
 * Replay button appears and whether the slide can be marked "completed".
 */
export type AnimationKind = "one-shot" | "loop" | "one-shot-then-loop";

export type DeckPhase = "transitioning" | "entered";

export type Lifecycle = "idle" | "playing" | "completed";

/** Imperative controls a slide exposes to the deck (via handleRef). */
export interface SlideHandle {
  /** Play the one-shot intro from 0. No-op for a pure loop. */
  play: () => void;
  /** Jump the intro to its finished state WITHOUT firing onComplete. */
  seekToEnd: () => void;
  /** Start ambient/looping animation while the slide is on screen. */
  startLoop: () => void;
  /** Pause ambient/looping animation when the slide leaves. */
  stopLoop: () => void;
}

export interface SlideComponentProps {
  active: boolean;
  phase: DeckPhase;
  handleRef: React.MutableRefObject<SlideHandle | null>;
  /** Slide calls this when its one-shot intro finishes (wired to markCompleted). */
  onComplete: () => void;
}

export interface SlideDef {
  id: string;
  /** Stepper label. Omitted-from-nav slides (the Entry screen) use navHidden. */
  label: string;
  kind: AnimationKind;
  /** Exclude from the top timeline (e.g. the Entry/input screen). */
  navHidden?: boolean;
  Component: React.ComponentType<SlideComponentProps>;
}
