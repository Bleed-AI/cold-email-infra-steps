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
  phase,
} from "../lab/engine/useScrubClock";
import { NarrationRail, type NarrationStep } from "../lab/engine/NarrationRail";

/**
 * LinkedIn outreach — the full picture, for clients who don't understand what
 * "LinkedIn outreach" means. Three ideas the earlier version missed are now on
 * screen, not just implied:
 *   1. WHY LinkedIn — email can't reach everyone (~1 in 5 have no findable
 *      email); LinkedIn is a separate pipe that reaches them. → the reach bar.
 *   2. It's SAFE — real profiles, well under LinkedIn's limits. → trust chip.
 *   3. Real IDENTITY + your APPROVAL — a real rep ("works with you"), never
 *      pretending to be you, and you sign off on every message. → trust chips.
 * Same buyer we email, second channel. Built on the shared scrub-clock engine.
 */

type StepKind = "list" | "connect" | "message" | "reply" | "chat";
type Step = { key: string; label: string; sub: string; kind: StepKind };
const STEPS: Step[] = [
  { key: "list",     label: "Ranked buyer list",  sub: "in priority order",        kind: "list" },
  { key: "connect",  label: "Connection request", sub: "hand-written, per person", kind: "connect" },
  { key: "followup", label: "Follow-up sequence", sub: "spaced over the week",     kind: "message" },
  { key: "human",    label: "Reply → human",      sub: "automation stops",         kind: "reply" },
  { key: "convo",    label: "Conversation",       sub: "~1 in 4 accept",           kind: "chat" },
];
const N = STEPS.length;

const T = {
  reachIn: [0.3, 1.1] as [number, number],
  reachLine: [1.4, 2.1] as [number, number],
  nodeStart: 2.4,
  nodeStagger: 1.05,
  nodeDur: 0.55,
  flowStart: 7.2,
  chipsStart: 7.6,
  chipStagger: 0.55,
};
const DURATION = 10.2;
const P_PERIOD = 3.0;

type Pt = { x: number; y: number };
type Layout = { w: number; h: number; nodes: Pt[]; centerX: number; railRight: number };

const nodeAppear = (i: number) => T.nodeStart + i * T.nodeStagger;

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
    // Mirror NarrationRail's sizing (w-[34%] max-w-[440px] min-w-[300px]).
    const railRight = Math.max(300, Math.min(w * 0.34, 440));
    const canvasLeft = railRight + 40;
    const canvasRight = w - 32;
    const cw = canvasRight - canvasLeft;
    const nodeY = h * 0.52;
    const nodes: Pt[] = Array.from({ length: N }, (_, i) => ({
      x: canvasLeft + cw * (0.12 + 0.76 * (i / (N - 1))),
      y: nodeY,
    }));
    const centerX = (nodes[0].x + nodes[N - 1].x) / 2;
    layoutRef.current = { w, h, nodes, centerX, railRight };
  }, []);

  const builtX = useCallback((t: number, L: Layout) => {
    const start = nodeAppear(0);
    const end = nodeAppear(N - 1) + T.nodeDur;
    const f = clamp01((t - start) / (end - start));
    return lerp(L.nodes[0].x, L.nodes[N - 1].x, easeOut(f));
  }, []);

  const drawCanvas = useCallback(
    (t: number) => {
      const ctx = ctxRef.current;
      const L = layoutRef.current;
      if (!ctx || !L) return;
      const { w, h, nodes } = L;
      ctx.clearRect(0, 0, w, h);
      const y = nodes[0].y;
      const x0 = nodes[0].x;
      const endX = builtX(t, L);

      // connector line (builds as the nodes appear)
      if (endX > x0 + 1) {
        ctx.beginPath();
        ctx.moveTo(x0, y);
        ctx.lineTo(endX, y);
        ctx.strokeStyle = "rgba(255,90,77,0.22)";
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }

      // node glow pulses (breathe with the packet period → seamless loop)
      nodes.forEach((nd, i) => {
        const ev = easeOut(clamp01((t - nodeAppear(i)) / T.nodeDur));
        if (ev <= 0) return;
        const breathe = 1 + 0.12 * Math.sin((t / P_PERIOD) * Math.PI * 2 + i * 0.7);
        const r = 26 * breathe;
        const g = ctx.createRadialGradient(nd.x, nd.y, 0, nd.x, nd.y, r);
        g.addColorStop(0, `rgba(255,90,77,${0.14 * ev})`);
        g.addColorStop(1, "rgba(255,90,77,0)");
        ctx.fillStyle = g;
        ctx.fillRect(nd.x - r, nd.y - r, r * 2, r * 2);
      });

      // flowing packets left→right once the line is built (loops via phase)
      if (t >= T.flowStart) {
        const pk = 3;
        for (let k = 0; k < pk; k++) {
          const f = phase(t, P_PERIOD, k / pk);
          const px = lerp(x0, nodes[N - 1].x, f);
          const fade = Math.sin(Math.PI * f);
          ctx.beginPath();
          ctx.arc(px, y, 2.0, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255,150,135,${0.5 + 0.45 * fade})`;
          ctx.fill();
        }
      }
    },
    [builtX]
  );

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

  const nodesPresent = (() => {
    let c = 0;
    for (let i = 0; i < N; i++) if (dt >= nodeAppear(i)) c++;
    return c;
  })();
  const activeNarration =
    dt >= 6.6 ? 6 :
    dt >= 5.55 ? 5 :
    dt >= 4.5 ? 4 :
    dt >= 3.45 ? 3 :
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
      <div
        className="absolute inset-0"
        style={{ background: "radial-gradient(65% 60% at 56% 50%, rgba(255,90,77,0.07), transparent 62%)" }}
      />
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
        <span className="font-display text-[20px] text-white leading-none tabular-nums">{nodesPresent}</span>
        <span className="text-white/45">/ {N} steps</span>
      </div>

      {L && (
        <>
          {/* WHY LinkedIn — a prominent animated figure: 10 buyers, 2 (amber)
              have no email, LinkedIn reaches them. */}
          <div
            className="absolute z-20"
            style={{
              left: px(L.centerX, L.w),
              top: px(L.h * 0.185, L.h),
              transform: `translate(-50%, ${(1 - reachEv) * -12}px) scale(${lerp(0.93, 1, reachEv)})`,
              opacity: reachEv,
              width: "min(500px, 48vw)",
            }}
          >
            <div className="rounded-2xl glass px-6 py-5 shadow-[0_18px_55px_rgba(0,0,0,0.5)]">
              <div className="flex items-center gap-2 mb-4">
                <span className="dot" />
                <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-white/55">
                  Why LinkedIn · email can&apos;t reach everyone
                </span>
              </div>

              {/* 10 buyers — the last 2 (amber) have no email */}
              <div className="flex items-center justify-center gap-2 mb-4">
                {Array.from({ length: 10 }).map((_, i) => {
                  const da = clamp01((dt - (T.reachIn[0] + i * 0.07)) / 0.4);
                  const miss = i >= 8;
                  return (
                    <span
                      key={i}
                      className="inline-flex items-center justify-center w-8 h-9 rounded-lg border"
                      style={{
                        opacity: da,
                        transform: `translateY(${(1 - da) * 8}px)`,
                        background: miss ? "rgba(245,158,11,0.16)" : "rgba(255,255,255,0.05)",
                        borderColor: miss ? "rgba(245,158,11,0.6)" : "rgba(255,255,255,0.12)",
                        color: miss ? "#f59e0b" : "rgba(255,255,255,0.5)",
                        boxShadow: miss ? "0 0 14px rgba(245,158,11,0.35)" : "none",
                        animation: miss && dt >= T.reachLine[0] ? "chan-firing 1.9s ease-in-out infinite" : "none",
                      }}
                    >
                      <PersonIcon size={16} />
                    </span>
                  );
                })}
              </div>

              {/* takeaway */}
              <div
                className="flex items-center justify-center gap-2 text-center"
                style={{
                  opacity: clamp01(seg(dt, T.reachLine[0], T.reachLine[1])),
                  transform: `translateY(${(1 - clamp01(seg(dt, T.reachLine[0], T.reachLine[1]))) * 6}px)`,
                }}
              >
                <span className="font-display text-[22px] leading-none" style={{ color: "#f59e0b" }}>1 in 5</span>
                <span className="text-white/60 text-[13.5px]">has no email,</span>
                <span className="font-display text-[18px] leading-none text-accent">LinkedIn reaches them</span>
              </div>
            </div>
          </div>

          {/* the 5 LinkedIn-outreach steps — icon centered ON the line, label below */}
          {STEPS.map((s, i) => {
            const a = clamp01((dt - nodeAppear(i)) / T.nodeDur);
            if (a <= 0) return null;
            const nd = L.nodes[i];
            return (
              <div key={s.key}>
                <span
                  className="absolute z-20 inline-flex items-center justify-center w-11 h-11 rounded-xl bg-ink-900/90 border border-accent/40 backdrop-blur-sm shadow-[0_8px_22px_rgba(0,0,0,0.4)]"
                  style={{
                    left: px(nd.x, L.w),
                    top: px(nd.y, L.h),
                    transform: "translate(-50%,-50%)",
                    opacity: a,
                  }}
                >
                  <StepIcon kind={s.kind} />
                </span>
                <div
                  className="absolute z-20 text-center"
                  style={{
                    left: px(nd.x, L.w),
                    top: px(nd.y + 40, L.h),
                    width: 132,
                    transform: `translate(-50%, ${(1 - a) * 6}px)`,
                    opacity: a,
                  }}
                >
                  <div className="text-[11px] font-mono text-white leading-tight">{s.label}</div>
                  <div className="text-[9.5px] text-white/45 leading-tight mt-0.5">{s.sub}</div>
                </div>
              </div>
            );
          })}

          {/* trust row — safe · real rep · you approve */}
          <div
            className="absolute z-20 flex items-center justify-center gap-2.5 flex-wrap"
            style={{
              left: px(L.centerX, L.w),
              top: px(L.h * 0.83, L.h),
              transform: "translate(-50%,-50%)",
              width: "min(560px, 52vw)",
            }}
          >
            {CHIPS.map((c, i) => {
              const a = clamp01((dt - (T.chipsStart + i * T.chipStagger)) / 0.5);
              if (a <= 0) return <span key={c.key} />;
              const toneCls = c.tone === "violet"
                ? "border-violet-glow/45 text-violet-glow"
                : "border-accent/45 text-accent";
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

function StepIcon({ kind }: { kind: StepKind }) {
  const size = 20;
  const stroke = { stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (kind === "list") {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className="text-accent">
        <path d="M9 6h11M9 12h11M9 18h11" {...stroke} />
        <circle cx="4.5" cy="6" r="1.3" fill="currentColor" />
        <circle cx="4.5" cy="12" r="1.3" fill="currentColor" />
        <circle cx="4.5" cy="18" r="1.3" fill="currentColor" />
      </svg>
    );
  }
  if (kind === "chat") {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className="text-accent">
        <path d="M4 5h11a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H8l-4 3V6a1 1 0 0 1 1-1z" {...stroke} />
        <path d="M18 9h1a1 1 0 0 1 1 1v7l-3-2h-6" {...stroke} />
      </svg>
    );
  }
  if (kind === "connect") {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className="text-accent">
        <circle cx="9" cy="8" r="3.2" {...stroke} />
        <path d="M3.5 19a5.5 5.5 0 0 1 11 0" {...stroke} />
        <path d="M18 7v6M15 10h6" {...stroke} />
      </svg>
    );
  }
  if (kind === "message") {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className="text-accent">
        <path d="M4 5h16a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H9l-4 3v-3H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z" {...stroke} />
        <path d="M8 10h8M8 12.5h5" {...stroke} />
      </svg>
    );
  }
  // reply
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className="text-accent">
      <path d="M9 17l-4-4 4-4M5 13h11a4 4 0 0 0 4-4V6" {...stroke} />
    </svg>
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
