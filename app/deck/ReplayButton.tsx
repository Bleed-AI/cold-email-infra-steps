"use client";

import { motion } from "framer-motion";

export default function ReplayButton({ onClick }: { onClick: () => void }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2, duration: 0.4 }}
      className="absolute bottom-24 right-6 z-30 group inline-flex items-center gap-2 rounded-full glass px-4 py-2.5 text-[11px] font-mono uppercase tracking-[0.18em] text-white/70 hover:text-accent hover:border-accent/40 transition-colors cursor-pointer"
      aria-label="Replay this animation"
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        className="transition-transform duration-500 group-hover:-rotate-180"
      >
        <path
          d="M3 12a9 9 0 1 0 3-6.7M3 4v4h4"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      Replay
    </motion.button>
  );
}
