"use client";

import {
  createContext,
  useCallback,
  useMemo,
  useReducer,
} from "react";
import type { DeckPhase, Lifecycle, SlideDef } from "./types";
import { SLIDES } from "./slides";

export interface DeckApi {
  slides: SlideDef[];
  activeIndex: number;
  direction: 1 | -1;
  phase: DeckPhase;
  lifecycle: Record<string, Lifecycle>;
  visited: Set<string>;
  /** Soft gate: the timeline + jump-to-step unlock only after the Entry submit. */
  unlocked: boolean;
  go: (index: number) => void;
  next: () => void;
  prev: () => void;
  /** Capture client + reveal the deck chrome + advance to the first real step. */
  start: () => void;
  setPhaseEntered: () => void;
  setPlaying: (id: string) => void;
  markCompleted: (id: string) => void;
  /** Reset a slide to idle so its one-shot intro plays again (the Replay button). */
  replay: (id: string) => void;
}

// eslint-disable-next-line react-refresh/only-export-components
export const DeckContext = createContext<DeckApi | null>(null);

type State = {
  activeIndex: number;
  direction: 1 | -1;
  phase: DeckPhase;
  lifecycle: Record<string, Lifecycle>;
  visited: Set<string>;
  unlocked: boolean;
};

type Action =
  | { type: "GO"; index: number }
  | { type: "NEXT" }
  | { type: "PREV" }
  | { type: "START" }
  | { type: "PHASE_ENTERED" }
  | { type: "SET_LIFECYCLE"; id: string; status: Lifecycle };

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

function moveTo(state: State, rawIndex: number): State {
  const lastIndex = SLIDES.length - 1;
  // Entry (index 0) stays reachable so you can jump back and edit details.
  const index = clamp(rawIndex, 0, lastIndex);
  if (index === state.activeIndex) return state;
  const visited = new Set(state.visited);
  visited.add(SLIDES[index].id);
  return {
    ...state,
    activeIndex: index,
    direction: index > state.activeIndex ? 1 : -1,
    phase: "transitioning",
    visited,
  };
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "GO":
      return moveTo(state, action.index);
    case "NEXT":
      return moveTo(state, state.activeIndex + 1);
    case "PREV":
      return moveTo(state, state.activeIndex - 1);
    case "START": {
      const target = Math.min(1, SLIDES.length - 1);
      const visited = new Set(state.visited);
      visited.add(SLIDES[target].id);
      return {
        ...state,
        unlocked: true,
        activeIndex: target,
        direction: 1,
        phase: "transitioning",
        visited,
        // (Re)starting from Entry replays every step fresh with the new
        // details; keep Entry itself "completed" so its form shows instantly.
        lifecycle: { [SLIDES[0].id]: "completed" },
      };
    }
    case "PHASE_ENTERED":
      return state.phase === "entered" ? state : { ...state, phase: "entered" };
    case "SET_LIFECYCLE":
      if (state.lifecycle[action.id] === action.status) return state;
      return {
        ...state,
        lifecycle: { ...state.lifecycle, [action.id]: action.status },
      };
    default:
      return state;
  }
}

function initState(): State {
  return {
    activeIndex: 0,
    direction: 1,
    // Slide 0 starts "entered" so its hero animation auto-plays on load.
    phase: "entered",
    lifecycle: {},
    visited: new Set([SLIDES[0].id]),
    unlocked: false,
  };
}

export function DeckProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, initState);

  const go = useCallback((index: number) => dispatch({ type: "GO", index }), []);
  const next = useCallback(() => dispatch({ type: "NEXT" }), []);
  const prev = useCallback(() => dispatch({ type: "PREV" }), []);
  const start = useCallback(() => dispatch({ type: "START" }), []);
  const setPhaseEntered = useCallback(
    () => dispatch({ type: "PHASE_ENTERED" }),
    []
  );
  const setPlaying = useCallback(
    (id: string) => dispatch({ type: "SET_LIFECYCLE", id, status: "playing" }),
    []
  );
  const markCompleted = useCallback(
    (id: string) => dispatch({ type: "SET_LIFECYCLE", id, status: "completed" }),
    []
  );
  const replay = useCallback(
    (id: string) => dispatch({ type: "SET_LIFECYCLE", id, status: "idle" }),
    []
  );

  const value = useMemo<DeckApi>(
    () => ({
      slides: SLIDES,
      activeIndex: state.activeIndex,
      direction: state.direction,
      phase: state.phase,
      lifecycle: state.lifecycle,
      visited: state.visited,
      unlocked: state.unlocked,
      go,
      next,
      prev,
      start,
      setPhaseEntered,
      setPlaying,
      markCompleted,
      replay,
    }),
    [state, go, next, prev, start, setPhaseEntered, setPlaying, markCompleted, replay]
  );

  return <DeckContext.Provider value={value}>{children}</DeckContext.Provider>;
}
