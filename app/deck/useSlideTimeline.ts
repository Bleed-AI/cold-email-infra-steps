"use client";

import { useLayoutEffect, useRef } from "react";
import { gsap } from "gsap";
import type { SlideHandle } from "./types";

type ExternalLoop = { start: () => void; stop: () => void };

type Args = {
  /** Root element of the slide; scopes all gsap selectors + cleanup. */
  scopeRef: React.RefObject<HTMLElement>;
  /** The deck owns this ref; we fill it so the deck can drive the slide. */
  handleRef: React.MutableRefObject<SlideHandle | null>;
  reducedMotion: boolean;
  /** Fired when the one-shot intro finishes (wire to deck.markCompleted). */
  onComplete: () => void;
  /** Build the one-shot intro choreography onto a paused timeline. */
  buildIntro?: (tl: gsap.core.Timeline) => void;
  /** Build ambient looping tweens onto a separate paused timeline. */
  buildLoop?: (tl: gsap.core.Timeline) => void;
  /** Non-gsap ambient (e.g. a canvas loop from makeActiveLoop). */
  externalLoop?: ExternalLoop;
};

/**
 * Converts a section's choreography into a deck slide: an intro timeline the
 * deck PLAYS on entry (and can seek to its finished state for the completed/
 * replay behaviour), plus optional ambient loops paused while off-screen.
 *
 * Why seekToEnd is callback-safe: gsap suppresses timeline callbacks during
 * seek/progress, so tl.progress(1) never fires onComplete. That's exactly why a
 * reduced-motion "jump to end" can't falsely mark a slide completed.
 */
export function useSlideTimeline({
  scopeRef,
  handleRef,
  reducedMotion,
  onComplete,
  buildIntro,
  buildLoop,
  externalLoop,
}: Args): void {
  // Keep latest onComplete without re-running the layout effect.
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const externalLoopRef = useRef(externalLoop);
  externalLoopRef.current = externalLoop;

  useLayoutEffect(() => {
    const scope = scopeRef.current ?? undefined;

    const ctx = gsap.context(() => {
      const introTl = gsap.timeline({
        paused: true,
        onComplete: () => onCompleteRef.current(),
      });
      buildIntro?.(introTl);

      let loopTl: gsap.core.Timeline | null = null;
      if (buildLoop) {
        loopTl = gsap.timeline({ paused: true });
        buildLoop(loopTl);
      }

      const handle: SlideHandle = {
        play: () => {
          if (reducedMotion) introTl.progress(1);
          else introTl.play(0);
        },
        seekToEnd: () => {
          introTl.progress(1);
        },
        startLoop: () => {
          loopTl?.play();
          externalLoopRef.current?.start();
        },
        stopLoop: () => {
          loopTl?.pause();
          externalLoopRef.current?.stop();
        },
      };

      handleRef.current = handle;
    }, scope);

    return () => {
      handleRef.current = null;
      ctx.revert();
    };
    // Builds reference DOM via scoped class selectors, not changing values, so
    // they don't need to be deps. Re-run only when reduced-motion flips.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeRef, handleRef, reducedMotion]);
}
