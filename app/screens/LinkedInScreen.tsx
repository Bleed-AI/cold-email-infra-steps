"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import type { ScreenProps } from "../lab/types";
import {
  useScrubClock,
  useDeckHandle,
  seg,
  easeOut,
  clamp01,
  lerp,
} from "../lab/engine/useScrubClock";
import { NarrationRail, type NarrationStep } from "../lab/engine/NarrationRail";

/**
 * LinkedIn outreach, the full picture, for clients who don't understand what
 * "LinkedIn outreach" means. Three ideas are on screen, not just implied:
 *   1. WHY LinkedIn, email can't reach everyone (~1 in 5 have no findable
 *      email); LinkedIn reaches them. The reach figure at the top.
 *   2. What it LOOKS like, a real LinkedIn campaign: a list of lead profile
 *      cards whose status climbs Invite sent to Pending to Connected to
 *      Replied (the Aimfox-style panel).
 *   3. It's SAFE and you APPROVE, a real rep, within LinkedIn's limits, you
 *      sign off on every message. The trust chips.
 */

const LADDER = ["Queued", "Invite sent", "Pending", "Connected", "Replied"] as const;

type Lead = { name: string; title: string; company: string; initials: string; target: number; tone: "accent" | "violet" };
const LEADS: Lead[] = [
  { name: "Ferrah Lang", title: "VP Sales",       company: "Brightwave", initials: "FL", target: 4, tone: "accent" },
  { name: "Marcus Cole", title: "Head of Growth", company: "Nimbus",     initials: "MC", target: 3, tone: "violet" },
  { name: "Priya Shah",  title: "Founder",        company: "Larkfield",  initials: "PS", target: 2, tone: "accent" },
  { name: "Dan Ortiz",   title: "RevOps Lead",    company: "Vaneo",      initials: "DO", target: 1, tone: "violet" },
];
const NL = LEADS.length;

const T = {
  reachIn: [0.3, 1.1] as [number, number],
  reachLine: [1.4, 2.1] as [number, number],
  cardsStart: 2.4,
  cardStagger: 0.5,
  stageDur: 0.8,
  chipsStart: 7.4,
  chipStagger: 0.55,
};
const DURATION = 10.0;
const P_PERIOD = 3.0;

const cardAppear = (i: number) => T.cardsStart + i * T.cardStagger;
const stageOf = (i: number, dt: number) =>
  Math.min(LEADS[i].target, Math.max(0, Math.floor((dt - cardAppear(i)) / T.stageDur)));

type Layout = { w: number; h: number; centerX: number; railRight: number };

export default function LinkedInScreen({ businessName, deckHandleRef, onDone }: ScreenProps) {
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
      { n: "01", title: "Why LinkedIn: email misses people", detail: <p>Email can&apos;t reach everyone. About <span className="text-white/80">1 in 5</span> of the right buyers have no findable email, and LinkedIn is a separate pipe with no spam filter, so it reaches the people email never could.</p> },
      { n: "02", title: "We find the right people", detail: <p>We build a ranked list of {businessName}&apos;s ideal buyers in <span className="text-white/80">priority order</span>, best-fit first. The same audience, no strangers.</p> },
      { n: "03", title: "A personal request, from a real person", detail: <p>Every note is written by hand for that person, based on their <span className="text-white/80">actual company</span>. It comes from a <span className="text-white/80">real rep who works with you</span> (or your own profile), never anyone pretending to be you.</p> },
      { n: "04", title: "We follow up the right way", detail: <p>Once they accept, a short sequence <span className="text-white/80">spaced over the week</span>. The moment someone replies, the automation stops and a <span className="text-white/80">human takes over</span>.</p> },
      { n: "05", title: "We keep your account safe", detail: <p>Real profiles, well inside LinkedIn&apos;s limits (around <span className="text-white/80">150 a week, 30 a day</span>), so your account is never flagged.</p> },
      { n: "06", title: "You approve before anything sends", detail: <p>You see the exact messages first, and nothing goes out without your sign-off. Expect around <span className="text-white/80">1 in 4</span> to accept, and a healthy share to reply.</p> },
    ],
    [businessName]
  );

  const computeLayout = useCallback(() => {
    const root = rootRef.current;
    if (!root) return;
    const w = root.clientWidth;
    const h = root.clientHeight;
    const railRight = Math.max(300, Math.min(w * 0.34, 440));
    const centerX = railRight + (w - railRight) / 2;
    layoutRef.current = { w, h, centerX, railRight };
  }, []);

  const drawCanvas = useCallback((t: number) => {
    const ctx = ctxRef.current;
    const L = layoutRef.current;
    if (!ctx || !L) return;
    const { w, h, centerX } = L;
    ctx.clearRect(0, 0, w, h);
    // soft breathing glow behind the campaign panel (ambient, loops via sin)
    const cy = h * 0.53;
    const breathe = 1 + 0.08 * Math.sin((t / P_PERIOD) * Math.PI * 2);
    const r = 240 * breathe;
    const g = ctx.createRadialGradient(centerX, cy, 0, centerX, cy, r);
    g.addColorStop(0, "rgba(255,90,77,0.06)");
    g.addColorStop(1, "rgba(255,90,77,0)");
    ctx.fillStyle = g;
    ctx.fillRect(centerX - r, cy - r, r * 2, r * 2);
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

  const connectedCount = LEADS.reduce((c, _, i) => c + (stageOf(i, dt) >= 3 ? 1 : 0), 0);
  const activeNarration =
    dt >= 7.4 ? 6 :
    dt >= 5.6 ? 5 :
    dt >= 4.2 ? 4 :
    dt >= 3.2 ? 3 :
    dt >= 2.4 ? 2 : 1;
  const reachEv = clamp01(seg(dt, T.reachIn[0], T.reachIn[1]));

  const L = layoutRef.current;
  const px = (v: number, total: number) => `${(v / total) * 100}%`;

  const CHIPS: { key: string; text: string; tone: "accent" | "violet"; icon: React.ReactNode }[] = [
    { key: "approve", tone: "violet", text: "You approve every message", icon: <CheckIcon /> },
    { key: "safe",    tone: "accent", text: "Under LinkedIn's limits · 150/wk", icon: <ShieldIcon /> },
    { key: "rep",     tone: "accent", text: "A real rep, never you", icon: <PersonIcon /> },
  ];

  return (
    <div ref={rootRef} className="relative h-full w-full overflow-hidden bg-ink-950">
      <div className="absolute inset-0 bg-grid-fine opacity-[0.16]" />
      <div className="absolute inset-0" style={{ background: "radial-gradient(65% 60% at 56% 50%, rgba(255,90,77,0.06), transparent 62%)" }} />
      <div className="noise" />
      <canvas ref={canvasRef} className="absolute inset-0" />

      <NarrationRail
        eyebrow={<><span className="dot" /> Step 08 · LinkedIn outreach · done for you</>}
        headline={<><span className="text-gradient">LinkedIn outreach,</span><br /><span className="text-gradient-accent">done for you.</span></>}
        steps={steps}
        activeCount={activeNarration}
        reduced={reduce}
      />

      {/* top-right status */}
      <div className="absolute top-9 right-9 z-30 flex items-center gap-2 chip">
        <span className="w-1.5 h-1.5 rounded-full bg-accent shadow-[0_0_10px_#ff5a4d] animate-pulse" />
        <span className="text-[12px] font-mono text-accent uppercase tracking-[0.14em]">campaign · live</span>
      </div>

      {L && (
        <>
          {/* WHY LinkedIn, animated reach figure: 10 buyers, 2 (amber) have no email */}
          <div
            className="absolute z-20"
            style={{
              left: px(L.centerX, L.w),
              top: px(L.h * 0.155, L.h),
              transform: `translate(-50%, ${(1 - reachEv) * -12}px) scale(${lerp(0.93, 1, reachEv)})`,
              opacity: reachEv,
              width: "min(470px, 46vw)",
            }}
          >
            <div className="rounded-2xl glass px-5 py-4 shadow-[0_16px_50px_rgba(0,0,0,0.5)]">
              <div className="flex items-center gap-2 mb-3">
                <span className="dot" />
                <span className="text-[10.5px] font-mono uppercase tracking-[0.18em] text-white/55">
                  Why LinkedIn · email can&apos;t reach everyone
                </span>
              </div>
              <div className="flex items-center justify-center gap-1.5 mb-3">
                {Array.from({ length: 10 }).map((_, i) => {
                  const da = clamp01((dt - (T.reachIn[0] + i * 0.07)) / 0.4);
                  const miss = i >= 8;
                  return (
                    <span
                      key={i}
                      className="inline-flex items-center justify-center w-7 h-8 rounded-md border"
                      style={{
                        opacity: da,
                        transform: `translateY(${(1 - da) * 8}px)`,
                        background: miss ? "rgba(245,158,11,0.16)" : "rgba(255,255,255,0.05)",
                        borderColor: miss ? "rgba(245,158,11,0.6)" : "rgba(255,255,255,0.12)",
                        color: miss ? "#f59e0b" : "rgba(255,255,255,0.5)",
                        boxShadow: miss ? "0 0 12px rgba(245,158,11,0.35)" : "none",
                        animation: miss && dt >= T.reachLine[0] ? "chan-firing 1.9s ease-in-out infinite" : "none",
                      }}
                    >
                      <PersonIcon size={15} />
                    </span>
                  );
                })}
              </div>
              <div
                className="flex items-center justify-center gap-2 text-center"
                style={{ opacity: clamp01(seg(dt, T.reachLine[0], T.reachLine[1])) }}
              >
                <span className="font-display text-[20px] leading-none" style={{ color: "#f59e0b" }}>1 in 5</span>
                <span className="text-white/60 text-[13px]">has no email,</span>
                <span className="font-display text-[16px] leading-none text-accent">LinkedIn reaches them</span>
              </div>
            </div>
          </div>

          {/* the campaign, a list of lead profile cards with climbing status */}
          <div
            className="absolute z-20"
            style={{
              left: px(L.centerX, L.w),
              top: px(L.h * 0.55, L.h),
              transform: "translate(-50%,-50%)",
              width: "min(540px, 52vw)",
            }}
          >
            <div className="rounded-2xl glass px-4 py-3.5 shadow-[0_20px_60px_rgba(0,0,0,0.5)]">
              {/* panel header */}
              <div className="flex items-center gap-2.5 mb-3 pb-3 border-b border-white/8">
                <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-white shrink-0 shadow-[0_1px_4px_rgba(0,0,0,0.4)]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/logos/linkedin.png" alt="LinkedIn" width={16} height={16} style={{ width: 16, height: 16 }} className="object-contain" />
                </span>
                <div className="leading-tight">
                  <div className="text-[12.5px] text-white font-medium">LinkedIn campaign</div>
                  <div className="text-[10px] text-white/45">from a real profile · not a bot</div>
                </div>
                <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-accent/12 border border-accent/40 px-2.5 py-1 text-[10px] font-mono text-accent">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                  {connectedCount} connected
                </span>
              </div>

              {/* lead rows */}
              <div className="space-y-1">
                {LEADS.map((ld, i) => {
                  const a = clamp01((dt - cardAppear(i)) / 0.5);
                  const st = stageOf(i, dt);
                  return (
                    <div
                      key={ld.name}
                      className="flex items-center gap-3 rounded-lg px-2 py-2"
                      style={{ opacity: a, transform: `translateY(${(1 - a) * 8}px)` }}
                    >
                      <span
                        className="inline-flex items-center justify-center w-9 h-9 rounded-full shrink-0 font-display text-[13px] border"
                        style={{
                          background: ld.tone === "violet" ? "rgba(124,92,255,0.16)" : "rgba(255,90,77,0.16)",
                          borderColor: ld.tone === "violet" ? "rgba(124,92,255,0.5)" : "rgba(255,90,77,0.5)",
                          color: ld.tone === "violet" ? "#a78fff" : "#ff8a7d",
                        }}
                      >
                        {ld.initials}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-[12.5px] text-white leading-tight truncate">{ld.name}</div>
                        <div className="text-[10.5px] text-white/45 leading-tight truncate">{ld.title} · {ld.company}</div>
                      </div>
                      <StatusPill stage={st} />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* trust row: safe · real rep · you approve */}
          <div
            className="absolute z-20 flex items-center justify-center gap-2.5 flex-wrap"
            style={{
              left: px(L.centerX, L.w),
              top: px(L.h * 0.87, L.h),
              transform: "translate(-50%,-50%)",
              width: "min(560px, 54vw)",
            }}
          >
            {CHIPS.map((c, i) => {
              const a = clamp01((dt - (T.chipsStart + i * T.chipStagger)) / 0.5);
              if (a <= 0) return <span key={c.key} />;
              const toneCls = c.tone === "violet" ? "border-violet-glow/45 text-violet-glow" : "border-accent/45 text-accent";
              return (
                <span
                  key={c.key}
                  className={`inline-flex items-center gap-1.5 rounded-full glass border ${toneCls} px-3 py-1.5`}
                  style={{ opacity: a, transform: `translateY(${(1 - a) * 6}px)` }}
                >
                  {c.icon}
                  <span className="text-[11px] font-mono text-white/85 whitespace-nowrap">{c.text}</span>
                </span>
              );
            })}
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

function StatusPill({ stage }: { stage: number }) {
  const label = LADDER[stage];
  // 0 Queued · 1 Invite sent · 2 Pending(amber) · 3 Connected(accent) · 4 Replied(filled)
  let cls = "bg-white/[0.05] border-white/12 text-white/45";
  let pulse = false;
  if (stage === 1) cls = "bg-white/[0.07] border-white/20 text-white/70";
  else if (stage === 2) cls = "border text-[#f59e0b]";
  else if (stage === 3) cls = "bg-accent/15 border-accent/50 text-accent";
  else if (stage === 4) { cls = "bg-accent border-accent text-ink-950 font-semibold"; pulse = true; }
  const amber = stage === 2 ? { background: "rgba(245,158,11,0.15)", borderColor: "rgba(245,158,11,0.5)" } : undefined;
  return (
    <span
      className={`shrink-0 inline-flex items-center rounded-full border px-2.5 py-1 text-[9.5px] font-mono uppercase tracking-[0.08em] ${cls} ${pulse ? "animate-pulse" : ""}`}
      style={amber}
    >
      {label}
    </span>
  );
}

function CheckIcon() {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
function ShieldIcon() {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /></svg>;
}
function PersonIcon({ size = 12 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden><circle cx="12" cy="8" r="3.4" stroke="currentColor" strokeWidth="1.8" /><path d="M5.5 20a6.5 6.5 0 0 1 13 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>;
}
