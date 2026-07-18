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
import { Callout } from "../lab/engine/Callout";

/**
 * SUB-SEQUENCE — what happens AFTER a reply.
 * Most agencies stop at "prospect replied ✓" — that's when we start.
 * Reply → auto-enrich round 2 → tailored sub-sequence (2–3 messages) → booked call.
 */
type EnrichTool = { logo: string | null; label: string; note: string };
const ENRICH_TOOLS: EnrichTool[] = [
  { logo: "linkedin", label: "LinkedIn scrape", note: "recent posts" },
  { logo: "serper",   label: "Serper",          note: "company news"     },
  { logo: "prospeo",  label: "Prospeo",         note: "role changes"     },
  { logo: "openai",   label: "OpenAI",          note: "angle rewrite"    },
];

type SubMessage = { subject: string; hook: string };
const SUB_MESSAGES: SubMessage[] = [
  { subject: "Re: your reply — quick thought",  hook: "Saw your Series A post yesterday…" },
  { subject: "One more thing before we chat",   hook: "Your team's hiring 3 BDRs — here's how…" },
  { subject: "Booking a 15-min?",                hook: "Grabbing a slot Friday, or would next week…" },
];

// ── beat timeline (seconds) ──
const T = {
  emailStart: 0.3,
  emailEnd: 1.2,
  replyStart: 1.5,
  replyEnd: 2.4,
  contrastAt: 2.6,        // "other agencies stop here" pill
  enrichStart: 3.4,
  enrichStagger: 0.28,
  enrichDur: 0.5,
  subStart: 5.5,
  subStagger: 0.65,
  subDur: 0.55,
  meetingAt: 8.2,
  meetingDur: 0.7,
};
const DURATION = 12.0;
const FLOW_PERIOD = 3.2;

type Pt = { x: number; y: number };
type Layout = {
  w: number;
  h: number;
  email: Pt;
  reply: Pt;
  hub: Pt;             // enrichment hub
  enrich: Pt[];        // enrichment source tiles
  messages: Pt[];      // sub-sequence message cards
  meeting: Pt;
  railRight: number;
};

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
      { n: "01", title: "First cold email lands. Prospect replies.", detail: <p>Someone from {businessName}&apos;s target list writes back. That reply is where <span className="text-white/80">most agencies stop</span> — hand it off, hope for the best.</p> },
      { n: "02", title: "We fire enrichment again — right then", detail: <p>The moment the reply lands, we pull <span className="text-white/80">fresh data</span> — their latest LinkedIn posts, company news, role changes, current context — none of it was there when we first emailed them.</p> },
      { n: "03", title: "A tailored sub-sequence writes itself", detail: <p>2–3 short follow-ups, each grounded in something we just learned. Not a template — a real thread that reads like it&apos;s been watching.</p> },
      { n: "04", title: "Reply → booked meeting", detail: <p>Because the sub-sequence keeps the momentum going, replies convert to calls — not drift back into a &quot;maybe later.&quot;</p> },
      { n: "05", title: "This is where we’re different", detail: <p>Most agencies build campaigns and disappear after send. We turn every reply into a real conversation, automatically — that&apos;s where the meetings come from.</p> },
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

    const email  : Pt = { x: canvasLeft + canvasW * 0.05, y: h * 0.28 };
    const reply  : Pt = { x: canvasLeft + canvasW * 0.05, y: h * 0.58 };
    const hub    : Pt = { x: canvasLeft + canvasW * 0.32, y: h * 0.5  };
    const enrich : Pt[] = ENRICH_TOOLS.map((_, i) => ({
      x: canvasLeft + canvasW * (0.22 + (i % 2) * 0.13),
      y: h * (0.19 + Math.floor(i / 2) * 0.13),
    }));
    const messages: Pt[] = SUB_MESSAGES.map((_, i) => ({
      x: canvasLeft + canvasW * 0.55,
      y: lerp(h * 0.24, h * 0.7, i / (SUB_MESSAGES.length - 1)),
    }));
    const meeting: Pt = { x: canvasLeft + canvasW * 0.83, y: h * 0.5 };

    layoutRef.current = { w, h, email, reply, hub, enrich, messages, meeting, railRight };
  }, []);

  const drawCanvas = useCallback((t: number) => {
    const ctx = ctxRef.current;
    const L = layoutRef.current;
    if (!ctx || !L) return;
    const { w, h, email, reply, hub, enrich, messages, meeting } = L;
    ctx.clearRect(0, 0, w, h);

    // — reply arrow: email → reply node —
    const replyDraw = clamp01((t - T.replyStart) / 0.8);
    if (replyDraw > 0) {
      ctx.beginPath();
      ctx.moveTo(email.x + 60, email.y);
      ctx.lineTo(reply.x + 60, lerp(email.y, reply.y, replyDraw));
      ctx.strokeStyle = `rgba(255,90,77,${0.35 * replyDraw})`;
      ctx.lineWidth = 1.4;
      ctx.setLineDash([4, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // — reply → hub curve (with flowing packet, seamless loop) —
    const hubEv = clamp01((t - T.enrichStart) / 0.6);
    if (hubEv > 0) {
      const c1: Pt = { x: lerp(reply.x, hub.x, 0.55), y: reply.y };
      const c2: Pt = { x: lerp(reply.x, hub.x, 0.45), y: hub.y };
      const segs = 24;
      const upTo = Math.max(1, Math.floor(segs * hubEv));
      ctx.beginPath();
      ctx.moveTo(reply.x + 60, reply.y);
      for (let q = 1; q <= upTo; q++) {
        const f = q / segs;
        ctx.lineTo(bz(reply.x + 60, c1.x, c2.x, hub.x, f), bz(reply.y, c1.y, c2.y, hub.y, f));
      }
      ctx.strokeStyle = `rgba(255,90,77,${0.35 * hubEv})`;
      ctx.lineWidth = 1.3;
      ctx.stroke();

      if (hubEv >= 1) {
        const f = phase(t, FLOW_PERIOD, 0);
        const fade = Math.sin(Math.PI * f);
        const px = bz(reply.x + 60, c1.x, c2.x, hub.x, f);
        const py = bz(reply.y, c1.y, c2.y, hub.y, f);
        ctx.beginPath();
        ctx.arc(px, py, 2, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,150,135,${0.85 * fade})`;
        ctx.fill();
      }
    }

    // — hub pulse (data being enriched) —
    if (t >= T.enrichStart && t < T.subStart + 0.5) {
      const p = phase(t, 2.2, 0);
      const r = 30 + p * 24;
      const fade = (1 - p) * 0.5;
      ctx.beginPath();
      ctx.arc(hub.x, hub.y, r, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255,90,77,${fade})`;
      ctx.lineWidth = 1.1;
      ctx.stroke();
    }

    // — hub → each enrichment tool tile —
    enrich.forEach((e, i) => {
      const a = clamp01((t - (T.enrichStart + i * T.enrichStagger)) / T.enrichDur);
      if (a <= 0) return;
      ctx.beginPath();
      ctx.moveTo(hub.x, hub.y);
      const c1 = { x: lerp(hub.x, e.x, 0.5), y: hub.y };
      const c2 = { x: lerp(hub.x, e.x, 0.5), y: e.y };
      const segs = 18;
      const upTo = Math.max(1, Math.floor(segs * a));
      for (let q = 1; q <= upTo; q++) {
        const f = q / segs;
        ctx.lineTo(bz(hub.x, c1.x, c2.x, e.x, f), bz(hub.y, c1.y, c2.y, e.y, f));
      }
      ctx.strokeStyle = `rgba(255,90,77,${0.22 * a})`;
      ctx.lineWidth = 1;
      ctx.stroke();
    });

    // — hub → each sub-sequence message —
    messages.forEach((m, i) => {
      const a0 = T.subStart + i * T.subStagger;
      const a = clamp01((t - a0) / T.subDur);
      if (a <= 0) return;
      const c1 = { x: lerp(hub.x, m.x, 0.55), y: hub.y };
      const c2 = { x: lerp(hub.x, m.x, 0.45), y: m.y };
      const segs = 22;
      const upTo = Math.max(1, Math.floor(segs * a));
      ctx.beginPath();
      ctx.moveTo(hub.x, hub.y);
      for (let q = 1; q <= upTo; q++) {
        const f = q / segs;
        ctx.lineTo(bz(hub.x, c1.x, c2.x, m.x, f), bz(hub.y, c1.y, c2.y, m.y, f));
      }
      ctx.strokeStyle = `rgba(124,92,255,${0.3 * a})`;
      ctx.lineWidth = 1.2;
      ctx.stroke();
      if (a >= 1) {
        const f = phase(t, FLOW_PERIOD, i * 0.2);
        const fade = Math.sin(Math.PI * f);
        const px = bz(hub.x, c1.x, c2.x, m.x, f);
        const py = bz(hub.y, c1.y, c2.y, m.y, f);
        ctx.beginPath();
        ctx.arc(px, py, 1.8, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(167,143,255,${0.85 * fade})`;
        ctx.fill();
      }
    });

    // — last message → meeting card —
    const mA = clamp01((t - (T.meetingAt - 0.3)) / T.meetingDur);
    if (mA > 0) {
      const last = messages[messages.length - 1];
      const c1 = { x: lerp(last.x, meeting.x, 0.55), y: last.y };
      const c2 = { x: lerp(last.x, meeting.x, 0.45), y: meeting.y };
      const segs = 20;
      const upTo = Math.max(1, Math.floor(segs * mA));
      ctx.beginPath();
      ctx.moveTo(last.x + 210, last.y);
      for (let q = 1; q <= upTo; q++) {
        const f = q / segs;
        ctx.lineTo(bz(last.x + 210, c1.x, c2.x, meeting.x, f), bz(last.y, c1.y, c2.y, meeting.y, f));
      }
      ctx.strokeStyle = `rgba(255,90,77,${0.4 * mA})`;
      ctx.lineWidth = 1.4;
      ctx.stroke();
    }
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
    dt >= T.meetingAt ? 5
    : dt >= T.subStart ? 4
    : dt >= T.enrichStart ? 3
    : dt >= T.replyStart ? 2
    : 1;

  const L = layoutRef.current;
  const px = (v: number, total: number) => `${(v / total) * 100}%`;

  return (
    <div ref={rootRef} className="relative h-full w-full overflow-hidden bg-ink-950">
      <div className="absolute inset-0 bg-grid-fine opacity-[0.16]" />
      <div
        className="absolute inset-0"
        style={{ background: "radial-gradient(65% 60% at 55% 50%, rgba(255,90,77,0.07), transparent 62%)" }}
      />
      <div className="noise" />
      <canvas ref={canvasRef} className="absolute inset-0" />

      <NarrationRail
        eyebrow={<><span className="dot" /> Step 08 · Sub-sequence · what most agencies skip</>}
        headline={
          <>
            <span className="text-gradient">Others stop at the reply.</span>
            <br />
            <span className="text-gradient-accent">We turn it into a booked meeting.</span>
          </>
        }
        steps={steps}
        activeCount={activeNarration}
        reduced={reduce}
      />

      {L && (
        <>
          {/* 1. Cold email card */}
          <div
            className="absolute z-20"
            style={{
              left: px(L.email.x, L.w),
              top: px(L.email.y, L.h),
              transform: "translate(0,-50%)",
              opacity: clamp01(seg(dt, T.emailStart, T.emailEnd)),
            }}
          >
            <div className="inline-flex items-center gap-2 rounded-lg bg-ink-900/85 border border-white/12 pl-2 pr-2.5 py-2 backdrop-blur-sm">
              <span className="inline-flex items-center justify-center rounded-[3px] bg-white shrink-0" style={{ width: 18, height: 18 }}>
                <MailIcon />
              </span>
              <div className="flex flex-col leading-tight">
                <span className="text-[9px] font-mono uppercase tracking-[0.16em] text-white/45">Cold email · sent</span>
                <span className="font-mono text-[11px] text-white whitespace-nowrap">Initial touch · Instantly</span>
              </div>
            </div>
          </div>

          {/* 2. Reply card */}
          <div
            className="absolute z-20"
            style={{
              left: px(L.reply.x, L.w),
              top: px(L.reply.y, L.h),
              transform: "translate(0,-50%)",
              opacity: clamp01(seg(dt, T.replyStart, T.replyEnd)),
            }}
          >
            <div className="inline-flex items-center gap-2 rounded-lg bg-accent/12 border border-accent/55 pl-2 pr-2.5 py-2 backdrop-blur-sm shadow-[0_0_18px_rgba(255,90,77,0.22)]">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-accent/20 border border-accent/60 shrink-0">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                  <path d="M9 17l-4-4 4-4M5 13h11a4 4 0 0 0 4-4V6" stroke="#ff5a4d" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <div className="flex flex-col leading-tight">
                <span className="text-[9px] font-mono uppercase tracking-[0.16em] text-accent">Reply · positive intent</span>
                <span className="font-mono text-[11px] text-white whitespace-nowrap">&quot;What do you have in mind?&quot;</span>
              </div>
            </div>
          </div>

          {/* "Other agencies stop here" contrast pill — appears then persists */}
          <div
            className="absolute z-30"
            style={{
              left: px(L.reply.x + 240, L.w),
              top: px(L.reply.y, L.h),
              transform: "translate(0,-50%)",
              opacity: clamp01((dt - T.contrastAt) / 0.6),
            }}
          >
            <div className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 bg-white/[0.05] border border-white/15">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" className="shrink-0">
                <path d="M6 6l12 12M6 18L18 6" stroke="rgba(255,255,255,0.5)" strokeWidth="2.4" strokeLinecap="round" />
              </svg>
              <span className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-white/55 whitespace-nowrap">
                other agencies stop here
              </span>
            </div>
          </div>

          {/* 3. Enrichment hub */}
          <div
            className="absolute z-20"
            style={{
              left: px(L.hub.x, L.w),
              top: px(L.hub.y, L.h),
              transform: "translate(-50%,-50%)",
              opacity: clamp01((dt - T.enrichStart) / 0.5),
            }}
          >
            <div className="flex flex-col items-center gap-1.5">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-accent/15 border border-accent/50 px-3 py-1.5 backdrop-blur-sm shadow-[0_0_18px_rgba(255,90,77,0.22)]">
                <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-accent whitespace-nowrap">Enrich · round 2</span>
              </div>
              <span className="text-[8.5px] font-mono uppercase tracking-[0.14em] text-white/45 text-center">pull fresh data · right now</span>
            </div>
          </div>

          {/* 3b. Enrichment source tiles fanning out from hub */}
          {ENRICH_TOOLS.map((tl, i) => {
            const a0 = T.enrichStart + i * T.enrichStagger;
            const a = clamp01((dt - a0) / T.enrichDur);
            if (a <= 0) return null;
            return (
              <div
                key={tl.label + i}
                className="absolute z-20"
                style={{
                  left: px(L.enrich[i].x, L.w),
                  top: px(L.enrich[i].y, L.h),
                  transform: `translate(-50%,-50%) scale(${reduce ? 1 : lerp(0.85, 1, easeOutBack(a))})`,
                  opacity: a,
                }}
              >
                <div className="inline-flex items-center gap-1.5 rounded-lg bg-ink-900/85 border border-white/12 pl-1.5 pr-2 py-1 backdrop-blur-sm">
                  <ToolLogo logo={tl.logo} size={14} />
                  <div className="flex flex-col leading-tight">
                    <span className="font-mono text-[10px] text-white whitespace-nowrap">{tl.label}</span>
                    <span className="text-[8px] font-mono uppercase tracking-[0.14em] text-white/45">{tl.note}</span>
                  </div>
                </div>
              </div>
            );
          })}

          {/* 4. Sub-sequence message cards */}
          {SUB_MESSAGES.map((m, i) => {
            const a0 = T.subStart + i * T.subStagger;
            const a = clamp01((dt - a0) / T.subDur);
            if (a <= 0) return null;
            return (
              <div
                key={i}
                className="absolute z-20"
                style={{
                  left: px(L.messages[i].x, L.w),
                  top: px(L.messages[i].y, L.h),
                  transform: `translate(0,-50%) scale(${reduce ? 1 : lerp(0.9, 1, easeOutBack(a))})`,
                  opacity: a,
                }}
              >
                <div className="rounded-lg bg-ink-900/85 border border-violet-glow/45 px-3 py-2 backdrop-blur-sm shadow-[0_0_0_1px_rgba(124,92,255,0.16),0_8px_20px_rgba(124,92,255,0.14)] min-w-[220px]">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-violet-glow" />
                    <span className="text-[9px] font-mono uppercase tracking-[0.14em] text-violet-glow">Follow-up · {i + 1} of {SUB_MESSAGES.length}</span>
                  </div>
                  <div className="font-mono text-[11px] text-white leading-tight whitespace-nowrap overflow-hidden text-ellipsis">{m.subject}</div>
                  <div className="text-[10px] text-white/60 leading-tight mt-0.5 whitespace-nowrap overflow-hidden text-ellipsis">{m.hook}</div>
                </div>
              </div>
            );
          })}

          {/* 5. Booked meeting card */}
          <div
            className="absolute z-20"
            style={{
              left: px(L.meeting.x, L.w),
              top: px(L.meeting.y, L.h),
              transform: `translate(-50%,-50%) scale(${clamp01((dt - T.meetingAt) / T.meetingDur)})`,
              opacity: clamp01((dt - T.meetingAt) / T.meetingDur),
            }}
          >
            <div className="rounded-xl bg-accent/12 border border-accent/60 px-4 py-3 backdrop-blur-sm shadow-[0_0_28px_rgba(255,90,77,0.28)]">
              <div className="flex items-center gap-2 mb-1">
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-accent/20 border border-accent/60">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                    <path d="M5 13l4 4L19 7" stroke="#ff5a4d" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-accent">Meeting booked</span>
              </div>
              <div className="font-display text-[15px] text-white leading-tight">Reply → call</div>
              <div className="text-[10px] font-mono text-white/60 mt-0.5">Friday · 2:00 PM</div>
            </div>
          </div>

          {/* On-canvas callouts */}
          <Callout
            x={px(L.hub.x, L.w)}
            y={px(L.h * 0.9, L.h)}
            anchor="center"
            tone="accent"
            label="Auto-enrich the reply"
            sub="LinkedIn · news · role changes · fresh context"
            appear={seg(dt, T.enrichStart + 0.4, T.enrichStart + 1.2)}
            reduced={reduce}
            className="[&_*]:!normal-case"
          />
          <Callout
            x={px(L.messages[0].x + 100, L.w)}
            y={px(L.h * 0.12, L.h)}
            anchor="center"
            tone="violet"
            label="Tailored sub-sequence"
            sub="2–3 follow-ups · each based on what we just learned"
            appear={seg(dt, T.subStart, T.subStart + 0.8)}
            reduced={reduce}
            className="[&_*]:!normal-case"
          />

          {/* "This is where we're different" statement panel — clear of deck controls */}
          <div
            className="absolute z-30"
            style={{
              left: px(L.w * 0.5 + L.railRight * 0.5, L.w),
              top: px(L.h * 0.9, L.h),
              transform: "translate(-50%,-50%)",
              opacity: clamp01((dt - (T.meetingAt + 0.4)) / 0.7),
            }}
          >
            <div className="glass rounded-full border border-accent/40 px-4 py-2 shadow-[0_10px_36px_rgba(255,90,77,0.2)]">
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/70">
                this is what other agencies{" "}
                <span className="text-accent">don&apos;t</span> do
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

function ToolLogo({ logo, size }: { logo: string | null; size: number }) {
  if (!logo) {
    return <span className="inline-flex items-center justify-center rounded-md bg-white/[0.08] border border-white/15 shrink-0 text-accent font-mono text-[9px]" style={{ width: size + 8, height: size + 8 }}>·</span>;
  }
  return (
    <span className="inline-flex items-center justify-center rounded-md bg-white shrink-0" style={{ width: size + 8, height: size + 8 }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/logos/${logo}.png`} alt={logo} width={size} height={size} style={{ width: size, height: size }} className="object-contain" />
    </span>
  );
}

function MailIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="6" width="18" height="12" rx="2" stroke="#0b0f17" strokeWidth="2" />
      <path d="M3 8l9 6 9-6" stroke="#0b0f17" strokeWidth="2" />
    </svg>
  );
}

function bz(p0: number, p1: number, p2: number, p3: number, t: number) {
  const u = 1 - t;
  return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
}
