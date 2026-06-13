"use client";

import type React from "react";
import { clamp01, easeOut } from "./useScrubClock";

type Tone = "accent" | "violet" | "muted";

const TONE: Record<Tone, { border: string; text: string; dot: string }> = {
  accent: { border: "border-accent/40", text: "text-accent", dot: "#7cf5d0" },
  violet: { border: "border-violet-glow/45", text: "text-violet-glow", dot: "#7c5cff" },
  muted: { border: "border-white/18", text: "text-white/75", dot: "rgba(255,255,255,0.55)" },
};

type StemDir = "up" | "down" | "left" | "right";

/**
 * On-screen annotation: a short label (+ optional animated number) that points
 * at the thing it describes. This is the v2 ask — "label them on the stage … a
 * mix of text, numbers and animation" — so every screen narrates itself inline,
 * not only in the left rail.
 *
 * Position the pill with `x`/`y` (CSS values, relative to the screen's relative
 * root). `value` is the animated number/string (the caller computes it from the
 * clock so it stays a pure function of t). An optional `stem` draws a thin CSS
 * leader + dot from the pill toward the element it annotates.
 */
export function Callout({
  x,
  y,
  label,
  value,
  sub,
  appear = 1,
  tone = "accent",
  anchor = "center",
  stem,
  reduced,
  className,
}: {
  x: string;
  y: string;
  label: React.ReactNode;
  value?: React.ReactNode;
  sub?: React.ReactNode;
  appear?: number;
  tone?: Tone;
  anchor?: "center" | "left" | "right";
  stem?: { dir: StemDir; len: number };
  reduced?: boolean;
  className?: string;
}) {
  const a = clamp01(appear);
  const t = TONE[tone];
  const translate =
    anchor === "left" ? "translate(0,-50%)" : anchor === "right" ? "translate(-100%,-50%)" : "translate(-50%,-50%)";

  return (
    <div
      className="absolute z-30 pointer-events-none"
      style={{ left: x, top: y, transform: translate, opacity: a }}
    >
      {stem && <Stem dir={stem.dir} len={stem.len} color={t.dot} appear={a} reduced={reduced} />}
      <div
        className={`inline-flex items-center gap-2 rounded-full bg-ink-900/85 border ${t.border} px-2.5 py-1 backdrop-blur-sm shadow-[0_4px_18px_rgba(0,0,0,0.45)] ${className ?? ""}`}
        style={{ transform: reduced ? "none" : `translateY(${(1 - easeOut(a)) * 6}px)` }}
      >
        {value != null && (
          <span className={`font-display text-[15px] leading-none tabular-nums ${t.text}`}>{value}</span>
        )}
        <span className="flex flex-col leading-tight">
          <span className="text-[10.5px] font-mono uppercase tracking-[0.12em] text-white/75 whitespace-nowrap">
            {label}
          </span>
          {sub && <span className="text-[9px] text-white/45 whitespace-nowrap normal-case tracking-normal">{sub}</span>}
        </span>
      </div>
    </div>
  );
}

/** A thin leader line + target dot extending from one edge of a Callout pill. */
function Stem({
  dir,
  len,
  color,
  appear,
  reduced,
}: {
  dir: StemDir;
  len: number;
  color: string;
  appear: number;
  reduced?: boolean;
}) {
  const grown = reduced ? 1 : easeOut(clamp01(appear));
  const horizontal = dir === "left" || dir === "right";
  const lineLen = len * grown;

  // Anchor the stem at the centre edge of the pill, growing outward.
  const base: React.CSSProperties = { position: "absolute", background: color, opacity: 0.55 };
  let line: React.CSSProperties;
  let dot: React.CSSProperties;
  const dotSize = 5;
  if (dir === "up") {
    line = { ...base, left: "50%", bottom: "100%", width: 1, height: lineLen, transform: "translateX(-50%)" };
    dot = { left: "50%", bottom: `calc(100% + ${lineLen}px)`, transform: "translate(-50%,50%)" };
  } else if (dir === "down") {
    line = { ...base, left: "50%", top: "100%", width: 1, height: lineLen, transform: "translateX(-50%)" };
    dot = { left: "50%", top: `calc(100% + ${lineLen}px)`, transform: "translate(-50%,-50%)" };
  } else if (dir === "left") {
    line = { ...base, top: "50%", right: "100%", height: 1, width: lineLen, transform: "translateY(-50%)" };
    dot = { top: "50%", right: `calc(100% + ${lineLen}px)`, transform: "translate(50%,-50%)" };
  } else {
    line = { ...base, top: "50%", left: "100%", height: 1, width: lineLen, transform: "translateY(-50%)" };
    dot = { top: "50%", left: `calc(100% + ${lineLen}px)`, transform: "translate(-50%,-50%)" };
  }
  void horizontal;
  return (
    <>
      <span style={line} />
      <span
        style={{
          position: "absolute",
          width: dotSize,
          height: dotSize,
          borderRadius: 999,
          background: color,
          boxShadow: `0 0 8px ${color}`,
          opacity: appear,
          ...dot,
        }}
      />
    </>
  );
}
