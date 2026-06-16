"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useDeck } from "./useDeck";

function Arrow({ dir }: { dir: "up" | "down" }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d={dir === "up" ? "M12 19V5M5 12l7-7 7 7" : "M12 5v14M5 12l7 7 7-7"}
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function DeckControls() {
  const deck = useDeck();
  const { unlocked, activeIndex, slides, next, prev } = deck;

  const atStart = activeIndex <= 0;
  const atEnd = activeIndex >= slides.length - 1;
  // Every slide is a step now (no Entry gate); steps are 1-based for display.
  const stepCount = slides.length;
  const currentStep = activeIndex + 1;

  return (
    <AnimatePresence>
      {unlocked && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="fixed bottom-6 inset-x-0 z-50 flex items-center justify-center gap-3 pointer-events-none"
        >
          <div className="pointer-events-auto flex items-center gap-2 rounded-full glass px-2 py-2">
            <button
              onClick={prev}
              disabled={atStart}
              aria-label="Previous step"
              className="inline-flex items-center justify-center w-10 h-10 rounded-full text-white/70 hover:text-accent hover:bg-white/5 disabled:opacity-25 disabled:pointer-events-none transition cursor-pointer"
            >
              <Arrow dir="up" />
            </button>

            <div className="px-2 text-[10px] font-mono uppercase tracking-[0.2em] text-white/50 tabular-nums">
              {String(currentStep).padStart(2, "0")}
              <span className="text-white/25"> / {String(stepCount).padStart(2, "0")}</span>
            </div>

            <button
              onClick={next}
              disabled={atEnd}
              aria-label="Next step"
              className="inline-flex items-center justify-center w-10 h-10 rounded-full text-white/70 hover:text-accent hover:bg-white/5 disabled:opacity-25 disabled:pointer-events-none transition cursor-pointer"
            >
              <Arrow dir="down" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
