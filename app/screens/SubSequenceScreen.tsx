"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import type { ScreenProps } from "../lab/types";
import {
  useScrubClock,
  useDeckHandle,
  seg,
  easeOut,
  easeOutBack,
  clamp01,
  lerp,
  phase,
} from "../lab/engine/useScrubClock";
import { NarrationRail, type NarrationStep } from "../lab/engine/NarrationRail";

/**
 * SUB-SEQUENCE (Step 08) — the full "reply → sub-sequence" story shown as a
 * left-to-right timeline anyone can follow at a glance.
 *
 *   Cold email  →  Follow-up  →  POSITIVE REPLY  →  Auto-enrich  →  Sub-seq #1  →  Sub-seq #2  →  Meeting
 *                                     |                 |
 *                             [other agencies      [4 enrichment
 *                              stop here]           sources fan out]
 *
 * The reply moment is the visual pivot: everything on the left is normal
 * cold-outreach (any agency does that), everything on the right is what makes
 * Bleed AI different (auto re-enrich → tailored sub-sequence → booked meeting).
 */

type StageType = "cold" | "reply" | "enrich" | "sub" | "meeting";
type Stage = {
  key: string;
  type: StageType;
  label: string;
  sub: string;
  day: string;
  appearAt: number;
};

const STAGES: Stage[] = [
  { key: "e1",      type: "cold",    label: "Cold email",        sub: "initial touch",              day: "Day 0",  appearAt: 0.4 },
  { key: "e2",      type: "cold",    label: "Follow-up",         sub: "part of the sequence",       day: "Day 3",  appearAt: 1.4 },
  { key: "reply",   type: "reply",   label: "Positive reply",    sub: "\"What did you have in mind?\"", day: "Day 5",  appearAt: 2.7 },
  { key: "enrich",  type: "enrich",  label: "Auto-enrich",       sub: "round 2 fires",              day: "+2 min", appearAt: 4.4 },
  { key: "s1",      type: "sub",     label: "LinkedIn touch",     sub: "grounded in fresh data",     day: "Day 6",  appearAt: 5.8 },
  { key: "s2",      type: "sub",     label: "SMS nudge",          sub: "short, to the mobile",       day: "Day 9",  appearAt: 6.8 },
  { key: "meeting", type: "meeting", label: "Meeting booked",     sub: "Friday · 2:00 PM",           day: "Day 12", appearAt: 8.0 },
];
const N = STAGES.length;

type EnrichTool = { logo: string | null; label: string; note: string };
const ENRICH_TOOLS: EnrichTool[] = [
  { logo: "linkedin", label: "LinkedIn",  note: "recent posts" },
  { logo: "serper",   label: "Serper",    note: "company news" },
  { logo: "prospeo",  label: "Prospeo",   note: "role changes" },
  { logo: "openai",   label: "OpenAI",    note: "angle rewrite" },
];

const T = {
  contrastAt: 3.3,            // "other agencies stop here" pill fades in below reply
  enrichToolsStart: 4.6,      // enrichment source tools fan out from Enrich stage
  enrichToolsStagger: 0.18,
  finalStatementAt: 9.4,      // "this is where we're different" statement
};
const DURATION = 11.5;
const FLOW_PERIOD = 3.2;

type Pt = { x: number; y: number };
type Layout = {
  w: number;
  h: number;
  timelineY: number;
  stages: Pt[];
  enrichTools: Pt[];
  railRight: number;
};

// --- STATIC LAYOUT HELPERS ----------------------------------------------------
// Which horizontal fractions of the canvas each stage sits at (7 stages).
const STAGE_XS = [0.05, 0.20, 0.36, 0.51, 0.66, 0.80, 0.94];

export default function SubSequenceScreen({ businessName, deckHandleRef, onDone }: ScreenProps) {
  const reduce = !!useReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const layoutRef = useRef<Layout | null>(null);
  const lastTRef = useRef(0);
  const pushedRef = useRef(-1);
  const [dt, setDt] = useState(0);

  const steps: NarrationStep[] = useMemo(
    () => [
      { n: "01", title: "Cold sequence sends first", detail: <p>{businessName}&apos;s campaign goes out — an initial cold email, plus one follow-up. Standard so far; every agency does this part.</p> },
      { n: "02", title: "A prospect replies", detail: <p>Someone from the list writes back with real interest. This is the moment where <span className="text-white/80">most agencies stop the automation</span> and hand it off — hope for the best.</p> },
      { n: "03", title: "We fire enrichment again — right then", detail: <p>The reply triggers a second round of enrichment: their <span className="text-white/80">latest LinkedIn posts, news, role changes</span> — data that wasn&apos;t there when we first emailed.</p> },
      { n: "04", title: "A short, tailored sub-sequence sends", detail: <p>2–3 cross-channel follow-ups — a LinkedIn touch, an SMS nudge — each written around something we just learned. Not templates: a real thread that keeps the momentum moving toward a meeting.</p> },
      { n: "05", title: "Reply → booked meeting", detail: <p>Because the sub-sequence keeps the conversation warm, replies convert to calls — not drift into a &quot;maybe later.&quot; That&apos;s the piece other agencies miss.</p> },
    ],
    [businessName]
  );

  const computeLayout = useCallback(() => {
    const root = rootRef.current;
    if (!root) return;
    const w = root.clientWidth;
    const h = root.clientHeight;
    const railRight = Math.min(w * 0.34, 440);
    const canvasLeft = railRight + 24;
    const canvasRight = w - 24;
    const canvasW = canvasRight - canvasLeft;

    const timelineY = h * 0.42;
    const stages: Pt[] = STAGE_XS.map((f) => ({ x: canvasLeft + canvasW * f, y: timelineY }));
    // Enrichment tools fan out below the enrich stage (index 3)
    const enrichAnchorX = stages[3].x;
    const enrichAnchorY = h * 0.72;
    const enrichTools: Pt[] = ENRICH_TOOLS.map((_, i) => ({
      x: enrichAnchorX + (i - (ENRICH_TOOLS.length - 1) / 2) * 76,
      y: enrichAnchorY,
    }));
    layoutRef.current = { w, h, timelineY, stages, enrichTools, railRight };
  }, []);

  /** Canvas: draws the connectors between timeline stages. Style shifts at the reply. */
  const drawCanvas = useCallback((t: number) => {
    const ctx = ctxRef.current;
    const L = layoutRef.current;
    if (!ctx || !L) return;
    ctx.clearRect(0, 0, L.w, L.h);
    const { stages } = L;

    // Connectors between consecutive stages
    for (let i = 0; i < stages.length - 1; i++) {
      const a = stages[i];
      const b = stages[i + 1];
      const nextAppear = STAGES[i + 1].appearAt;
      const grow = clamp01((t - (nextAppear - 0.35)) / 0.5);
      if (grow <= 0) continue;

      // Post-reply connectors (i >= 2) glow coral; pre-reply are subdued
      const postReply = i >= 2;
      const startX = a.x + 62; // just past the card
      const endX = b.x - 62;
      const y = a.y;
      const midX = (startX + endX) / 2;

      // Straight line with slight vertical dip (subtle curve) for organic feel
      const dip = 4;
      ctx.beginPath();
      ctx.moveTo(startX, y);
      ctx.quadraticCurveTo(midX, y + dip, endX, y);
      ctx.strokeStyle = postReply ? `rgba(255,90,77,${0.4 * grow})` : `rgba(255,255,255,${0.16 * grow})`;
      ctx.lineWidth = postReply ? 1.4 : 1.1;
      if (!postReply) ctx.setLineDash([4, 4]);
      ctx.stroke();
      if (!postReply) ctx.setLineDash([]);

      // Arrow head at the end (once fully drawn)
      if (grow >= 1) {
        const arrowSize = postReply ? 5 : 4;
        ctx.beginPath();
        ctx.moveTo(endX, y);
        ctx.lineTo(endX - arrowSize, y - arrowSize * 0.7);
        ctx.lineTo(endX - arrowSize, y + arrowSize * 0.7);
        ctx.closePath();
        ctx.fillStyle = postReply ? "rgba(255,90,77,0.7)" : "rgba(255,255,255,0.35)";
        ctx.fill();
      }

      // Flowing packets on post-reply connectors (seamless loop)
      if (postReply && grow >= 1) {
        const pk = 2;
        for (let k = 0; k < pk; k++) {
          const f = phase(t, FLOW_PERIOD, i * 0.13 + k / pk);
          const fade = Math.sin(Math.PI * f);
          // Point along the quadratic bezier
          const u = 1 - f;
          const px = u * u * startX + 2 * u * f * midX + f * f * endX;
          const py = u * u * y + 2 * u * f * (y + dip) + f * f * y;
          ctx.beginPath();
          ctx.arc(px, py, 2, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255,150,135,${0.85 * fade})`;
          ctx.fill();
        }
      }
    }

    // Enrichment hub pulse — subtle radar behind the Enrich stage while it's active
    const enrichStage = STAGES[3];
    const enrichStageAppeared = t >= enrichStage.appearAt;
    if (enrichStageAppeared && t < enrichStage.appearAt + 3.5) {
      const enrichPos = stages[3];
      const p = phase(t, 2.4, 0);
      const r = 24 + p * 18;
      const fade = (1 - p) * 0.5;
      ctx.beginPath();
      ctx.arc(enrichPos.x, enrichPos.y, r, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255,90,77,${fade})`;
      ctx.lineWidth = 1.1;
      ctx.stroke();
    }

    // Enrich → tool tile connectors (fan down from Enrich stage)
    L.enrichTools.forEach((tp, i) => {
      const a0 = T.enrichToolsStart + i * T.enrichToolsStagger;
      const a = clamp01((t - a0) / 0.5);
      if (a <= 0) return;
      const startX = stages[3].x;
      const startY = stages[3].y + 30;
      const endX = tp.x;
      const endY = tp.y - 18;
      const c1 = { x: startX, y: lerp(startY, endY, 0.5) };
      const c2 = { x: endX, y: lerp(startY, endY, 0.5) };
      const segs = 18;
      const upTo = Math.max(1, Math.floor(segs * a));
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      for (let q = 1; q <= upTo; q++) {
        const f = q / segs;
        const u = 1 - f;
        const bx = u * u * u * startX + 3 * u * u * f * c1.x + 3 * u * f * f * c2.x + f * f * f * endX;
        const by = u * u * u * startY + 3 * u * u * f * c1.y + 3 * u * f * f * c2.y + f * f * f * endY;
        ctx.lineTo(bx, by);
      }
      ctx.strokeStyle = `rgba(255,90,77,${0.28 * a})`;
      ctx.lineWidth = 1;
      ctx.stroke();
    });
  }, []);

  const onFrame = useCallback(
    (t: number) => {
      const prev = lastTRef.current;
      if (t < prev - 0.5) pushedRef.current = -1;
      lastTRef.current = t;
      drawCanvas(t);
      if (pushedRef.current < DURATION) {
        const clamped = Math.min(t, DURATION);
        pushedRef.current = clamped;
        setDt(clamped);
      }
    },
    [drawCanvas]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    const root = rootRef.current;
    if (!canvas || !root) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctxRef.current = ctx;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      computeLayout();
      const L = layoutRef.current;
      if (!L) return;
      canvas.width = Math.round(L.w * dpr);
      canvas.height = Math.round(L.h * dpr);
      canvas.style.width = `${L.w}px`;
      canvas.style.height = `${L.h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawCanvas(lastTRef.current);
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [computeLayout, drawCanvas]);

  const controls = useScrubClock(onFrame, {
    duration: DURATION,
    reduced: reduce,
    autoPlay: !deckHandleRef,
    onDone,
    loop: true,
  });
  useDeckHandle(controls, deckHandleRef);

  const activeNarration =
    dt >= STAGES[6].appearAt ? 5
    : dt >= STAGES[4].appearAt ? 4
    : dt >= STAGES[3].appearAt ? 3
    : dt >= STAGES[2].appearAt ? 2
    : 1;

  const L = layoutRef.current;
  const px = (v: number, total: number) => `${(v / total) * 100}%`;

  return (
    <div ref={rootRef} className="relative h-full w-full overflow-hidden bg-ink-950">
      <div className="absolute inset-0 bg-grid-fine opacity-[0.16]" />
      <div
        className="absolute inset-0"
        style={{ background: "radial-gradient(60% 55% at 55% 45%, rgba(255,90,77,0.07), transparent 62%)" }}
      />
      <div className="noise" />
      <canvas ref={canvasRef} className="absolute inset-0" />

      <NarrationRail
        eyebrow={<><span className="dot" /> Step 08 · Sub-sequence · what most agencies skip</>}
        headline={
          <>
            <span className="text-gradient">Reply lands.</span>
            <br />
            <span className="text-gradient-accent">Sub-sequence fires. Meeting booked.</span>
          </>
        }
        steps={steps}
        activeCount={activeNarration}
        reduced={reduce}
      />

      {L && (
        <>
          {/* Phase labels above the timeline — "cold sequence" and "our sub-sequence" */}
          <div
            className="absolute z-20 flex items-center gap-1.5"
            style={{
              left: px((L.stages[0].x + L.stages[1].x) / 2, L.w),
              top: px(L.timelineY - 68, L.h),
              transform: "translate(-50%,0)",
              opacity: clamp01((dt - 0.3) / 0.5),
            }}
          >
            <span className="text-[9px] font-mono uppercase tracking-[0.18em] text-white/40">Cold sequence</span>
            <span className="text-[8.5px] font-mono text-white/25">(any agency)</span>
          </div>
          <div
            className="absolute z-20 flex items-center gap-1.5"
            style={{
              left: px((L.stages[3].x + L.stages[6].x) / 2, L.w),
              top: px(L.timelineY - 68, L.h),
              transform: "translate(-50%,0)",
              opacity: clamp01((dt - STAGES[3].appearAt) / 0.5),
            }}
          >
            <span className="text-[9px] font-mono uppercase tracking-[0.18em] text-accent">Our sub-sequence</span>
            <span className="text-[8.5px] font-mono text-accent/60">(Bleed AI)</span>
          </div>

          {/* Stage cards along the timeline */}
          {STAGES.map((s, i) => {
            const pt = L.stages[i];
            const a = clamp01((dt - s.appearAt) / 0.5);
            if (a <= 0) return null;
            return (
              <StageCard
                key={s.key}
                stage={s}
                x={px(pt.x, L.w)}
                y={px(pt.y, L.h)}
                appear={a}
                reduced={reduce}
                dt={dt}
              />
            );
          })}

          {/* "OTHER AGENCIES STOP HERE" callout below the REPLY stage */}
          <div
            className="absolute z-30"
            style={{
              left: px(L.stages[2].x, L.w),
              top: px(L.timelineY + 90, L.h),
              transform: "translate(-50%,-50%)",
              opacity: clamp01((dt - T.contrastAt) / 0.6),
            }}
          >
            <div className="flex flex-col items-center gap-1">
              <div className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 bg-white/[0.06] border border-white/20">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" className="shrink-0">
                  <path d="M6 6l12 12M6 18L18 6" stroke="rgba(255,255,255,0.55)" strokeWidth="2.4" strokeLinecap="round" />
                </svg>
                <span className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-white/60 whitespace-nowrap">
                  other agencies stop here
                </span>
              </div>
              <span className="text-[8.5px] font-mono text-white/30 italic">manual hand-off · momentum lost</span>
            </div>
          </div>

          {/* Enrichment tool tiles fan out from the ENRICH stage */}
          {ENRICH_TOOLS.map((tl, i) => {
            const a0 = T.enrichToolsStart + i * T.enrichToolsStagger;
            const a = clamp01((dt - a0) / 0.5);
            if (a <= 0) return null;
            const tp = L.enrichTools[i];
            return (
              <div
                key={tl.label + i}
                className="absolute z-20"
                style={{
                  left: px(tp.x, L.w),
                  top: px(tp.y, L.h),
                  transform: `translate(-50%,-50%) scale(${reduce ? 1 : lerp(0.88, 1, easeOutBack(a))})`,
                  opacity: a,
                }}
              >
                <div className="inline-flex items-center gap-1.5 rounded-lg bg-ink-900/85 border border-accent/30 pl-1 pr-2 py-1 backdrop-blur-sm">
                  <ToolLogo logo={tl.logo} size={12} />
                  <div className="flex flex-col leading-tight">
                    <span className="font-mono text-[10px] text-white whitespace-nowrap">{tl.label}</span>
                    <span className="text-[7.5px] font-mono uppercase tracking-[0.12em] text-white/45 whitespace-nowrap">{tl.note}</span>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Final statement pill — "this is where we're different" */}
          <div
            className="absolute z-30"
            style={{
              left: px(L.w * 0.5 + L.railRight * 0.5, L.w),
              top: px(L.h * 0.93, L.h),
              transform: "translate(-50%,-50%)",
              opacity: clamp01((dt - T.finalStatementAt) / 0.7),
            }}
          >
            <div className="glass rounded-full border border-accent/40 px-4 py-2 shadow-[0_10px_36px_rgba(255,90,77,0.2)]">
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/70">
                this is where <span className="text-accent">we&apos;re different</span> · replies become meetings, automatically
              </span>
            </div>
          </div>
        </>
      )}

      {!deckHandleRef && (
        <button
          onClick={() => controls.play()}
          className="absolute bottom-6 right-6 z-40 inline-flex items-center gap-2 rounded-full glass px-4 py-2.5 text-[11px] font-mono uppercase tracking-[0.18em] text-white/70 hover:text-accent transition cursor-pointer"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M3 12a9 9 0 1 0 3-6.7M3 4v4h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Replay
        </button>
      )}
    </div>
  );
}

/** Timeline stage card — styling varies by stage type. */
function StageCard({
  stage,
  x,
  y,
  appear,
  reduced,
  dt,
}: {
  stage: Stage;
  x: string;
  y: string;
  appear: number;
  reduced?: boolean;
  dt: number;
}) {
  const isReply = stage.type === "reply";
  const isMeeting = stage.type === "meeting";
  const isEnrich = stage.type === "enrich";
  const isCold = stage.type === "cold";
  const isSub = stage.type === "sub";

  // Border/glow style per type
  const border = isReply || isMeeting
    ? "border-accent/60 shadow-[0_0_0_1px_rgba(255,90,77,0.28),0_10px_28px_rgba(255,90,77,0.24)]"
    : isEnrich
    ? "border-accent/45 shadow-[0_0_18px_rgba(255,90,77,0.14)]"
    : isSub
    ? "border-violet-glow/45"
    : "border-white/15";
  const bg = isReply || isMeeting || isEnrich
    ? "bg-accent/8"
    : isSub
    ? "bg-violet-glow/[0.05]"
    : "bg-ink-900/85";

  // Pulse effect for the reply stage (attention-grabber)
  const pulseScale = isReply ? 1 + 0.04 * Math.sin((dt / 1.6) * Math.PI * 2) : 1;

  const width = isReply || isMeeting ? 128 : 118;

  return (
    <div
      className="absolute z-20"
      style={{
        left: x,
        top: y,
        transform: `translate(-50%,-50%) scale(${reduced ? 1 : lerp(0.88, 1, easeOutBack(appear)) * pulseScale})`,
        opacity: appear,
        width: `${width}px`,
      }}
    >
      <div className={`rounded-xl ${bg} border ${border} px-2.5 py-2 backdrop-blur-sm text-center`}>
        {/* Day chip at top */}
        <div className="flex items-center justify-center gap-1 mb-1.5">
          <span
            className={[
              "text-[8px] font-mono uppercase tracking-[0.14em] px-1.5 py-[1px] rounded-full",
              isReply || isMeeting
                ? "bg-accent/20 text-accent border border-accent/40"
                : isEnrich
                ? "bg-accent/15 text-accent border border-accent/35"
                : isSub
                ? "bg-violet-glow/15 text-violet-glow border border-violet-glow/35"
                : "bg-white/[0.05] text-white/50 border border-white/12",
            ].join(" ")}
          >
            {stage.day}
          </span>
        </div>

        {/* Icon */}
        <div className="flex items-center justify-center mb-1">
          <StageIcon type={stage.type} />
        </div>

        {/* Label */}
        <div
          className={[
            "text-[10.5px] font-mono leading-tight",
            isReply || isMeeting ? "text-accent font-bold uppercase tracking-[0.08em]"
            : isEnrich || isSub ? "text-white"
            : "text-white/85",
          ].join(" ")}
        >
          {stage.label}
        </div>

        {/* Sub-label */}
        <div className="text-[9px] text-white/50 leading-tight mt-0.5 truncate">
          {stage.sub}
        </div>
      </div>
    </div>
  );
}

function StageIcon({ type }: { type: StageType }) {
  const size = 16;
  const wrap = "inline-flex items-center justify-center w-6 h-6 rounded-md";
  if (type === "cold") {
    return (
      <span className={`${wrap} bg-white/[0.08] border border-white/15 text-white/70`}>
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <rect x="3" y="6" width="18" height="12" rx="2" stroke="currentColor" strokeWidth="1.8" />
          <path d="M3 8l9 6 9-6" stroke="currentColor" strokeWidth="1.8" />
        </svg>
      </span>
    );
  }
  if (type === "reply") {
    return (
      <span className={`${wrap} bg-accent/20 border border-accent/60 text-accent`}>
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <path d="M9 17l-4-4 4-4M5 13h11a4 4 0 0 0 4-4V6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    );
  }
  if (type === "enrich") {
    return (
      <span className={`${wrap} bg-accent/15 border border-accent/50 text-accent`}>
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <path d="M12 3l1.6 4.6L18 9l-4.4 1.4L12 15l-1.6-4.6L6 9l4.4-1.4L12 3z" fill="currentColor" />
          <path d="M5 17l0.8 2.3L8 20l-2.2 0.7L5 23l-0.8-2.3L2 20l2.2-0.7L5 17z" fill="currentColor" opacity="0.7" />
        </svg>
      </span>
    );
  }
  if (type === "sub") {
    return (
      <span className={`${wrap} bg-violet-glow/15 border border-violet-glow/50 text-violet-glow`}>
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    );
  }
  // meeting
  return (
    <span className={`${wrap} bg-accent/20 border border-accent/60 text-accent`}>
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.8" />
        <path d="M3 10h18M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M8 15l2.5 2.5L16 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

function ToolLogo({ logo, size }: { logo: string | null; size: number }) {
  if (!logo) {
    return (
      <span
        className="inline-flex items-center justify-center rounded-md bg-white/[0.08] border border-white/15 shrink-0 text-accent font-mono text-[9px]"
        style={{ width: size + 8, height: size + 8 }}
      >
        ·
      </span>
    );
  }
  return (
    <span className="inline-flex items-center justify-center rounded-md bg-white shrink-0" style={{ width: size + 8, height: size + 8 }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/logos/${logo}.png`} alt={logo} width={size} height={size} style={{ width: size, height: size }} className="object-contain" />
    </span>
  );
}
