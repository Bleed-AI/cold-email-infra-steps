"use client";

import { useId, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

type ExpandableProps = {
  /** Always-visible short version (the sales-call view). */
  summary: React.ReactNode;
  /** Revealed on expand (the self-navigating client's depth). */
  children: React.ReactNode;
  /** Trigger label. */
  label?: string;
  defaultOpen?: boolean;
  className?: string;
};

/**
 * "Learn more" primitive. Keeps the call view clean: a short summary plus a
 * clearly-animated affordance to expand a longer explanation. Height animates
 * 0 -> auto via framer-motion; collapses instantly under reduced motion.
 */
export default function Expandable({
  summary,
  children,
  label = "Learn more",
  defaultOpen = false,
  className,
}: ExpandableProps) {
  const [open, setOpen] = useState(defaultOpen);
  const reduce = useReducedMotion();
  const panelId = useId();

  return (
    <div className={className}>
      <div className="text-white/55 text-sm leading-relaxed">{summary}</div>

      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        className="group mt-3 inline-flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.18em] text-accent/90 hover:text-accent transition-colors cursor-pointer"
      >
        <span>{open ? "Show less" : label}</span>
        <motion.svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: reduce ? 0 : 0.25, ease: [0.22, 1, 0.36, 1] }}
        >
          <path
            d="M6 9l6 6 6-6"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </motion.svg>
        <span className="h-px flex-1 w-12 bg-gradient-to-r from-accent/40 to-transparent" />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={panelId}
            key="panel"
            initial={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
            animate={reduce ? { opacity: 1 } : { height: "auto", opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: reduce ? 0.12 : 0.32, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="pt-3 text-white/55 text-sm leading-relaxed space-y-3">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
