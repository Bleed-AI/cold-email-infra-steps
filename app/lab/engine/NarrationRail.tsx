"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

export type NarrationStep = {
  n: string;
  title: string;
  detail: React.ReactNode;
};

/**
 * The persistent "what's happening" rail. Each step's heading appears as its
 * beat plays and STAYS for reference; the plain-English description is shown
 * EXPANDED by default (the user's ask) but stays collapsible. A newcomer can
 * read exactly what each stage is doing without hunting for a toggle.
 */
export function NarrationRail({
  eyebrow,
  headline,
  steps,
  activeCount,
  reduced,
}: {
  eyebrow: React.ReactNode;
  headline: React.ReactNode;
  steps: NarrationStep[];
  activeCount: number;
  reduced?: boolean;
}) {
  return (
    <div className="absolute top-0 left-0 h-full w-[34%] max-w-[440px] min-w-[300px] z-20 px-8 md:px-10 py-9 flex flex-col">
      {/* Consistent BleedAI brand lockup — present on every screen. */}
      <div className="mb-5 flex items-center self-start">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logos/bleedai.svg" alt="BleedAI" className="h-[18px] w-auto opacity-95" />
      </div>
      <div className="chip mb-5 self-start">{eyebrow}</div>
      <h2 className="font-display text-[26px] md:text-[34px] leading-[1.02] tracking-[-0.02em] mb-6">
        {headline}
      </h2>

      <ol className="space-y-1.5 overflow-y-auto pr-1 -mr-1">
        {steps.map((s, i) => (
          <NarrationRow key={s.n} step={s} visible={i < activeCount} reduced={reduced} />
        ))}
      </ol>
    </div>
  );
}

function NarrationRow({
  step,
  visible,
  reduced,
}: {
  step: NarrationStep;
  visible: boolean;
  reduced?: boolean;
}) {
  // Descriptions open by default; the chevron still lets you collapse for the
  // clean sales-call view.
  const [open, setOpen] = useState(true);

  return (
    <motion.li
      initial={false}
      animate={
        visible
          ? { opacity: 1, height: "auto", marginTop: 6 }
          : { opacity: 0, height: 0, marginTop: 0 }
      }
      transition={{ duration: reduced ? 0 : 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="overflow-hidden"
      style={{ pointerEvents: visible ? "auto" : "none" }}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="group w-full text-left flex items-start gap-3 rounded-lg px-2 py-2 hover:bg-white/[0.03] transition-colors cursor-pointer"
      >
        <span className="mt-0.5 shrink-0 inline-flex items-center justify-center w-6 h-6 rounded-md bg-accent/12 border border-accent/35 text-accent font-mono text-[11px]">
          {step.n}
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-[14px] md:text-[15px] text-white font-medium leading-snug">
            {step.title}
          </span>
        </span>
        <motion.svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden
          className="mt-1 shrink-0 text-white/40 group-hover:text-accent"
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: reduced ? 0 : 0.2 }}
        >
          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </motion.svg>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={reduced ? { opacity: 0 } : { height: 0, opacity: 0 }}
            animate={reduced ? { opacity: 1 } : { height: "auto", opacity: 1 }}
            exit={reduced ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: reduced ? 0.1 : 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="pl-11 pr-2 pb-2 text-[12.5px] leading-relaxed text-white/55 space-y-2">
              {step.detail}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.li>
  );
}
