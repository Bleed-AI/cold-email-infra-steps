"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

/**
 * Centered intro modal for first-time visitors arriving from bleedai.com.
 * Dims the page behind it until dismissed, so they can't start interacting
 * with the walkthrough before they know what it is.
 *
 * Dismiss by: clicking the X, clicking the "Got it" button, or clicking
 * the dimmed backdrop.
 *
 * To revert: delete this file and remove the <VisitorIntro /> reference
 * from app/page.tsx.
 */
export default function VisitorIntro() {
  const [show, setShow] = useState(true);

  // Lock scroll & block keyboard escape while modal is open
  useEffect(() => {
    if (!show) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShow(false);
    };
    window.addEventListener("keydown", onKey);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [show]);

  const close = () => setShow(false);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35 }}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/55 backdrop-blur-sm p-4"
          onClick={close}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="visitor-intro-title"
            className="relative max-w-[480px] w-full glass rounded-2xl px-7 py-7 shadow-[0_20px_80px_rgba(0,0,0,0.6)] border border-accent/25"
          >
            <button
              onClick={close}
              aria-label="Dismiss"
              className="absolute top-3 right-3 w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center text-white/55 hover:text-white transition cursor-pointer"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path
                  d="M6 6l12 12M6 18L18 6"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </button>

            <div className="flex items-center gap-2 mb-4">
              <span className="w-1.5 h-1.5 rounded-full bg-accent shadow-[0_0_10px_currentColor]" />
              <span className="text-[10px] font-mono uppercase tracking-[0.22em] text-accent">
                Welcome
              </span>
            </div>

            <h2
              id="visitor-intro-title"
              className="font-display text-[22px] md:text-[26px] text-white leading-[1.15] tracking-[-0.01em]"
            >
              You&apos;re about to see how Bleed AI runs cold email — end to end.
            </h2>

            <p className="mt-3 text-sm text-white/65 leading-relaxed">
              Nothing&apos;s running right now — this is a walkthrough of how
              we build, send, and optimize cold email for businesses like
              yours. Look around.
            </p>

            <button
              onClick={close}
              className="mt-6 inline-flex items-center gap-2 px-5 py-3 rounded-full bg-accent text-ink-950 font-mono text-xs uppercase tracking-[0.18em] hover:bg-accent/90 transition cursor-pointer"
            >
              Got it · Start the walkthrough
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path
                  d="M5 12h14M13 5l7 7-7 7"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
