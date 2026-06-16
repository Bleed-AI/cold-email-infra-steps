"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useDeck } from "./useDeck";
import { useClient } from "../context/ClientContext";

/**
 * The company persona, editable inline. Replaces the old "edit details" gate —
 * no form, no separate screen. Click to rename the company; applying re-plays
 * the current step personalized to the new name, so it's usable live on a call.
 */
function CompanyChip() {
  const { client, setClient } = useClient();
  const { replay, slides, activeIndex } = useDeck();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(client.businessName);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const apply = () => {
    const next = value.trim();
    if (next && next !== client.businessName) {
      setClient({ businessName: next });
      // Rebuild the current step so the new name flows through immediately.
      const id = slides[activeIndex]?.id;
      if (id) replay(id);
    }
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="shrink-0 flex items-center gap-1 rounded-full bg-accent/10 border border-accent/40 pl-3 pr-1 py-1">
        <BuildingIcon className="text-accent" />
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") apply();
            if (e.key === "Escape") {
              setValue(client.businessName);
              setEditing(false);
            }
          }}
          onBlur={apply}
          maxLength={28}
          placeholder="Company"
          className="w-[120px] bg-transparent outline-none text-[12px] font-display text-white placeholder:text-white/30"
        />
        <button
          onMouseDown={(e) => e.preventDefault()}
          onClick={apply}
          aria-label="Apply company name"
          className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-accent text-ink-950 cursor-pointer"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => {
        setValue(client.businessName);
        setEditing(true);
      }}
      title="Click to set the company — personalizes this step"
      className="group shrink-0 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-mono uppercase tracking-[0.12em] text-white/60 hover:text-white transition-colors cursor-pointer whitespace-nowrap"
    >
      <BuildingIcon className="text-accent/80 group-hover:text-accent transition-colors" />
      <span className="max-w-[120px] truncate normal-case font-display tracking-normal text-[12px] text-white/90">
        {client.businessName}
      </span>
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden className="text-white/35 group-hover:text-accent transition-colors">
        <path
          d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}

function BuildingIcon({ className }: { className?: string }) {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden className={className}>
      <path d="M3 21h18M5 21V5a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v16M14 21V9h4a1 1 0 0 1 1 1v11" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 8h2M8 12h2M8 16h2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export default function TimelineNav() {
  const deck = useDeck();
  const { unlocked, slides, activeIndex, visited, go } = deck;

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
            <CompanyChip />
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
