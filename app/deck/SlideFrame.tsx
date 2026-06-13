"use client";

import { useCallback, useEffect, useRef } from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { SlideDef, SlideHandle } from "./types";
import { useDeck } from "./useDeck";
import ReplayButton from "./ReplayButton";

/**
 * Positions one slide in the persistent transform-stack and orchestrates its
 * lifecycle. All slides stay mounted; the active one sits at y:0 and the rest
 * are stacked ±100% above/below. Animating that offset IS the vertical swipe —
 * and a completed one-shot simply stays at its end-state in the live DOM.
 */
export default function SlideFrame({
  def,
  index,
}: {
  def: SlideDef;
  index: number;
}) {
  const deck = useDeck();
  const reduce = !!useReducedMotion();
  const handleRef = useRef<SlideHandle | null>(null);

  const active = deck.activeIndex === index;
  const entered = deck.phase === "entered";
  const isCompleted = deck.lifecycle[def.id] === "completed";
  const offset = (index - deck.activeIndex) * 100;

  const { markCompleted, setPlaying, setPhaseEntered } = deck;
  const onComplete = useCallback(
    () => markCompleted(def.id),
    [markCompleted, def.id]
  );

  // Effect A — ambient loop runs only while this slide is the active, entered
  // one (and motion is allowed). Driven by the active flag, not an observer,
  // because neighbours physically slide through the viewport during a swipe.
  useEffect(() => {
    const h = handleRef.current;
    if (!h) return;
    if (active && entered && !reduce) h.startLoop();
    return () => {
      handleRef.current?.stopLoop();
    };
  }, [active, entered, reduce]);

  // Effect B — the one-shot intro. Keyed on isCompleted (a boolean) rather than
  // the full lifecycle string, so setPlaying (idle->playing) doesn't re-trigger
  // a replay. play() -> gsap onComplete -> markCompleted -> isCompleted true ->
  // this re-runs -> seekToEnd (a harmless no-op at the end).
  useEffect(() => {
    const h = handleRef.current;
    if (!h || !active || !entered) return;
    if (reduce || isCompleted) {
      h.seekToEnd();
      return;
    }
    setPlaying(def.id);
    h.play();
  }, [active, entered, reduce, isCompleted, setPlaying, def.id]);

  const showReplay =
    active && entered && isCompleted && def.kind !== "loop" && !reduce;

  const Comp = def.Component;

  return (
    <motion.div
      className="absolute inset-0"
      style={{ zIndex: active ? 10 : 1 }}
      initial={false}
      animate={{ y: `${offset}%` }}
      transition={{ duration: reduce ? 0 : 0.7, ease: [0.22, 1, 0.36, 1] }}
      onAnimationComplete={() => {
        if (index === deck.activeIndex) setPhaseEntered();
      }}
      aria-hidden={!active}
    >
      <Comp
        active={active}
        phase={deck.phase}
        handleRef={handleRef}
        onComplete={onComplete}
      />
      {showReplay && <ReplayButton onClick={() => deck.replay(def.id)} />}
    </motion.div>
  );
}
