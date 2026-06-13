"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useDeck } from "./useDeck";

export default function TimelineNav() {
  const deck = useDeck();
  const { unlocked, slides, activeIndex, visited, go } = deck;

  // Numbered steps only — the Entry screen (navHidden) isn't a step.
  const steps = slides
    .map((def, index) => ({ def, index }))
    .filter(({ def }) => !def.navHidden);

  return (
    <AnimatePresence>
      {unlocked && (
        <motion.nav
          aria-label="Walkthrough steps"
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="fixed top-0 inset-x-0 z-50 flex justify-center px-4 pt-4 pointer-events-none"
        >
          <div className="pointer-events-auto flex items-center gap-1 rounded-full glass px-2 py-2 max-w-[94vw] overflow-x-auto no-scrollbar">
            {/* Step 0 — jump back to edit company / your name, then relaunch. */}
            <button
              onClick={() => go(0)}
              aria-current={activeIndex === 0 ? "step" : undefined}
              data-state={activeIndex === 0 ? "current" : "edit"}
              className={[
                "group shrink-0 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-mono uppercase tracking-[0.14em] transition-colors cursor-pointer whitespace-nowrap",
                activeIndex === 0 ? "bg-accent text-ink-950" : "text-white/45 hover:text-white/80",
              ].join(" ")}
              title="Edit company & name details"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Details
            </button>
            <span className="shrink-0 w-px h-5 bg-white/10 mx-0.5" />
            {steps.map(({ def, index }, n) => {
              const state =
                index === activeIndex
                  ? "current"
                  : visited.has(def.id)
                  ? "visited"
                  : "upcoming";
              return (
                <button
                  key={def.id}
                  onClick={() => go(index)}
                  aria-current={state === "current" ? "step" : undefined}
                  data-state={state}
                  className={[
                    "group relative shrink-0 inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[11px] font-mono uppercase tracking-[0.14em] transition-colors cursor-pointer whitespace-nowrap",
                    state === "current"
                      ? "bg-accent text-ink-950"
                      : state === "visited"
                      ? "text-white/75 hover:text-white"
                      : "text-white/40 hover:text-white/70",
                  ].join(" ")}
                >
                  <span
                    className={[
                      "inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px]",
                      state === "current"
                        ? "bg-ink-950/20 text-ink-950"
                        : state === "visited"
                        ? "bg-accent/15 text-accent"
                        : "bg-white/5 text-white/40",
                    ].join(" ")}
                  >
                    {state === "visited" ? "✓" : n + 1}
                  </span>
                  {def.label}
                </button>
              );
            })}
          </div>
        </motion.nav>
      )}
    </AnimatePresence>
  );
}
