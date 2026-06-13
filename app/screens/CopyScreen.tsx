"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import type { ScreenProps } from "../lab/types";
import { useScrubClock, useDeckHandle, clamp01, lerp } from "../lab/engine/useScrubClock";
import { NarrationRail, type NarrationStep } from "../lab/engine/NarrationRail";

const STAGE_T = [0, 3.0, 5.8, 10.0, 12.6] as const;
const DURATION = 15.6;

const DATA = [
  { k: "IrishJobs", v: "247 HR Manager roles" },
  { k: "LinkedIn", v: "612 more roles" },
  { k: "Contact", v: "Emma Farrell" },
  { k: "Signal", v: "Active hiring surge" },
];
const VARS = [
  { name: "{{first_name}}", val: "Emma" },
  { name: "{{top_role}}", val: "HR Manager" },
  { name: "{{irishjobs_count}}", val: "247" },
  { name: "{{linkedin_count}}", val: "612" },
];
// Email body as tokens; `v` marks a slotted-in variable (highlighted).
type Tok = { t: string; v?: boolean };
const LINES: Tok[][] = [
  [{ t: "Hey " }, { t: "Emma", v: true }, { t: "," }],
  [{ t: "247", v: true }, { t: " " }, { t: "HR Manager", v: true }, { t: " roles are live on IrishJobs right now — " }, { t: "612", v: true }, { t: " more on LinkedIn." }],
  [{ t: "Your competitors are calling those companies today." }],
  [{ t: "We monitor fresh " }, { t: "HR Manager", v: true }, { t: " hiring signals daily, pull the right contact, and build you a ready-to-call list." }],
  [{ t: "Want me to send a sample from this week?" }],
];
const VARIANTS = [
  { id: "A", subject: "247 HR Manager roles, Ireland", angle: "Hiring signal" },
  { id: "B", subject: "Your competitors are already calling", angle: "Competitor pressure" },
  { id: "C", subject: "A sample list from this week?", angle: "Free sample" },
];
const FOLLOWUPS = [
  { tag: "Email 1 · Day 0", text: "The opener" },
  { tag: "Email 2 · Day 3", text: "Still 200+ roles live — want the sample?" },
  { tag: "Breakup · Day 7", text: "Should I close this out, Emma?" },
];

export default function CopyScreen({ businessName, deckHandleRef, onDone }: ScreenProps) {
  const reduce = !!useReducedMotion();
  const [dt, setDt] = useState(0);

  const steps: NarrationStep[] = useMemo(
    () => [
      { n: "01", title: "Start from real research", detail: <p>Every lead already has the enrichment we pulled — hiring signals, role, company facts. That&apos;s the raw material for a personal email.</p> },
      { n: "02", title: "Turn it into variables", detail: <p>The research becomes per-lead variables — first name, role, live-role counts — so one template can speak to thousands of people individually.</p> },
      { n: "03", title: "Write the email", detail: <p>The variables slot into a proven template. Every email reads like it was written one-to-one, because the specifics really are theirs.</p> },
      { n: "04", title: "A/B/C variants", detail: <p>Two to four angles run head-to-head — hiring signal, competitor pressure, free sample — so the best-performing message wins on real replies.</p> },
      { n: "05", title: "Follow-ups", detail: <p>One or two follow-ups land in the same thread over the next week, so {businessName} stays top-of-mind without ever being pushy.</p> },
    ],
    [businessName]
  );

  const onFrame = useCallback((t: number) => setDt(t), []);
  const controls = useScrubClock(onFrame, { duration: DURATION, reduced: reduce, autoPlay: !deckHandleRef, onDone });
  useDeckHandle(controls, deckHandleRef);

  const activeNarration = dt < STAGE_T[1] ? 1 : dt < STAGE_T[2] ? 2 : dt < STAGE_T[3] ? 3 : dt < STAGE_T[4] ? 4 : 5;
  const linesShown = LINES.filter((_, i) => dt > STAGE_T[2] + 0.4 + i * 0.7).length;
  const showVariants = dt > STAGE_T[3];
  const showFollowups = dt > STAGE_T[4];

  return (
    <div className="relative h-full w-full overflow-hidden bg-ink-950">
      <div className="absolute inset-0 bg-grid-fine opacity-[0.16]" />
      <div className="absolute inset-0" style={{ background: "radial-gradient(70% 60% at 66% 45%, rgba(124,92,255,0.08), transparent 60%)" }} />
      <div className="noise" />

      <NarrationRail
        eyebrow={<><span className="dot" /> Step 04 · AI copy personalization</>}
        headline={<><span className="text-gradient">We write it,</span><br /><span className="text-gradient-accent">personally — at scale.</span></>}
        steps={steps}
        activeCount={activeNarration}
        reduced={reduce}
      />

      {/* data → variables column */}
      <div className="absolute z-20" style={{ left: "39%", top: "50%", transform: "translateY(-50%)", width: "min(220px,18vw)" }}>
        <div className="rounded-xl glass p-3.5 mb-3">
          <div className="text-[9px] font-mono uppercase tracking-[0.2em] text-white/40 mb-2.5">Enrichment data</div>
          <div className="space-y-1.5">
            {DATA.map((d, i) => {
              const a = clamp01((dt - (0.3 + i * 0.4)) / 0.4);
              return (
                <div key={d.k} className="flex items-center justify-between gap-2 text-[10.5px]" style={{ opacity: a, transform: `translateX(${(1 - a) * 10}px)` }}>
                  <span className="text-white/40 font-mono shrink-0">{d.k}</span>
                  <span className="text-white/80 text-right leading-tight">{d.v}</span>
                </div>
              );
            })}
          </div>
        </div>
        <div className="rounded-xl glass p-3.5">
          <div className="text-[9px] font-mono uppercase tracking-[0.2em] text-white/40 mb-2.5">Variables</div>
          <div className="space-y-1.5">
            {VARS.map((v, i) => {
              const a = clamp01((dt - (STAGE_T[1] + 0.2 + i * 0.35)) / 0.4);
              return (
                <div key={v.name} className="flex items-center gap-1.5 text-[10.5px] font-mono" style={{ opacity: a }}>
                  <span className="text-violet-glow">{v.name}</span>
                  <span className="text-white/30">→</span>
                  <span className="text-accent">{v.val}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* email composition */}
      <div className="absolute z-20" style={{ left: "73%", top: "50%", transform: "translate(-50%,-50%)", width: "min(460px,38vw)" }}>
        {/* variant tabs */}
        <div className="flex items-center gap-1.5 mb-2" style={{ opacity: showVariants ? 1 : 0, transition: "opacity .4s" }}>
          {VARIANTS.map((v, i) => (
            <span key={v.id} className={`inline-flex items-center gap-1.5 rounded-t-lg px-3 py-1.5 text-[10px] font-mono ${i === 0 ? "bg-ink-800 text-accent border-t border-x border-white/12" : "bg-white/[0.03] text-white/45"}`}>
              <span className="font-bold">{v.id}</span> {v.angle}
            </span>
          ))}
        </div>

        <div className="rounded-2xl glass p-5 shadow-[0_20px_60px_rgba(0,0,0,0.5)]">
          <div className="flex items-center justify-between border-b border-white/8 pb-3 mb-3">
            <div className="min-w-0">
              <div className="text-[10px] font-mono text-white/35">Subject</div>
              <div className="text-[13px] text-white truncate">{VARIANTS[0].subject}</div>
            </div>
            <span className="text-[10px] font-mono text-white/30 shrink-0 ml-3">to Emma</span>
          </div>
          <div className="space-y-2.5 text-[13px] leading-relaxed min-h-[150px]">
            {LINES.map((line, i) => (
              <p key={i} style={{ opacity: i < linesShown ? 1 : 0, transform: `translateY(${i < linesShown ? 0 : 6}px)`, transition: "opacity .4s, transform .4s" }}>
                {line.map((tok, j) => (
                  <span key={j} className={tok.v ? "text-accent font-medium" : "text-white/75"}>{tok.t}</span>
                ))}
              </p>
            ))}
          </div>
          <div className="mt-3 pt-3 border-t border-white/8 text-[11px] text-white/40">— {businessName} via Bleed AI</div>
        </div>

        {/* follow-up thread */}
        <div className="mt-3 space-y-1.5" style={{ opacity: showFollowups ? 1 : 0, transition: "opacity .4s" }}>
          {FOLLOWUPS.map((f, i) => {
            const a = clamp01((dt - (STAGE_T[4] + 0.2 + i * 0.4)) / 0.4);
            return (
              <div key={f.tag} className="flex items-center gap-2.5 rounded-lg bg-white/[0.03] border border-white/8 px-3 py-2" style={{ opacity: showFollowups ? a : 0, transform: `translateX(${(1 - a) * 12}px)` }}>
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${i === 0 ? "bg-accent" : "bg-white/25"}`} />
                <span className="text-[10px] font-mono text-white/40 shrink-0 w-[110px]">{f.tag}</span>
                <span className="text-[11px] text-white/65 truncate">{f.text}</span>
              </div>
            );
          })}
        </div>
      </div>

      <button onClick={() => controls.play()} className="absolute bottom-6 right-6 z-40 inline-flex items-center gap-2 rounded-full glass px-4 py-2.5 text-[11px] font-mono uppercase tracking-[0.18em] text-white/70 hover:text-accent transition cursor-pointer">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M3 12a9 9 0 1 0 3-6.7M3 4v4h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
        Replay
      </button>
    </div>
  );
}
