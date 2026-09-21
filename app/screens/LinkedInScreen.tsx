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
import { Callout } from "../lab/engine/Callout";

/**
 * LinkedIn outreach — EXPLAINER slide. Many clients don't understand what
 * "LinkedIn outreach" actually means, so this screen walks the same buyer we
 * email through the LinkedIn touch, step by step: find the profile → warm up
 * with a visit + like → a personal connection request → a soft message on
 * accept → the reply routes to the same pipeline (→ CRM). Same person, second
 * channel. Built on the shared scrub-clock engine like every other screen.
 */

type StepKind = "linkedin" | "view" | "connect" | "message" | "reply";
type Step = { key: string; label: string; sub: string; kind: StepKind };
const STEPS: Step[] = [
  { key: "find",    label: "Find the profile",   sub: "the same buyer we email", kind: "linkedin" },
  { key: "warm",    label: "Visit + like a post", sub: "show up first, warmly",  kind: "view" },
  { key: "connect", label: "Connection request", sub: "short, personal note",    kind: "connect" },
  { key: "message", label: "Message on accept",  sub: "soft, on-topic",          kind: "message" },
  { key: "reply",   label: "Reply → your CRM",   sub: "same pipeline as email",  kind: "reply" },
];
const N = STEPS.length;

const T = {
  profileIn: [0.2, 1.0] as [number, number],
  nodeStart: 1.1,
  nodeStagger: 1.35,
  nodeDur: 0.6,
  flowStart: 7.4,
};
const DURATION = 11.6;
const P_PERIOD = 3.0;

type Pt = { x: number; y: number };
type Layout = { w: number; h: number; nodes: Pt[]; profile: Pt; railRight: number };

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
      { n: "01", title: "It's the same buyer — on LinkedIn", detail: <p>The exact decision-maker we email also gets reached on LinkedIn. <span className="text-white/80">One person, two places</span> — not a random new list.</p> },
      { n: "02", title: "We warm up first — a visit & a like", detail: <p>Before any message, we view their profile and engage a recent post. So when our note arrives, <span className="text-white/80">our name already looks familiar</span> — not a stranger.</p> },
      { n: "03", title: "A personal connection request", detail: <p>Not a generic &quot;I&apos;d like to connect.&quot; A short note written from their research — the <span className="text-white/80">same personalization as the email</span>.</p> },
      { n: "04", title: "They accept → a real conversation", detail: <p>Once connected, a soft, on-topic message — no hard pitch. It reads human because it is, and it earns a reply.</p> },
      { n: "05", title: "Email + LinkedIn = more replies", detail: <p>The same buyer sees a helpful email <em>and</em> a familiar face on LinkedIn. Two touchpoints beat one — and every reply routes to the <span className="text-white/80">same pipeline ({businessName}&apos;s CRM)</span>.</p> },
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
    const canvasRight = w - 32;
    const cw = canvasRight - canvasLeft;
    const nodeY = h * 0.54;
    const nodes: Pt[] = Array.from({ length: N }, (_, i) => ({
      x: canvasLeft + cw * (0.12 + 0.76 * (i / (N - 1))),
      y: nodeY,
    }));
    const profile: Pt = { x: nodes[0].x, y: h * 0.24 };
    layoutRef.current = { w, h, nodes, profile, railRight };
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
      const { w, h, nodes, profile } = L;
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

      // profile → node0 feeder line
      const profEv = easeOut(seg(t, T.profileIn[0], T.profileIn[1]));
      if (profEv > 0) {
        ctx.beginPath();
        ctx.moveTo(profile.x, profile.y + 22);
        ctx.lineTo(nodes[0].x, nodes[0].y - 22);
        ctx.strokeStyle = `rgba(255,90,77,${0.2 * profEv})`;
        ctx.lineWidth = 1.1;
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
  const activeNarration = Math.max(1, nodesPresent);

  const L = layoutRef.current;
  const px = (v: number, total: number) => `${(v / total) * 100}%`;

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
        eyebrow={<><span className="dot" /> Step 07 · LinkedIn outreach · explained</>}
        headline={<><span className="text-gradient">What LinkedIn outreach</span><br /><span className="text-gradient-accent">actually is.</span></>}
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
          {/* the buyer — same person we email */}
          <div
            className="absolute z-20"
            style={{
              left: px(L.profile.x, L.w),
              top: px(L.profile.y, L.h),
              transform: "translate(-50%,-50%)",
              opacity: clamp01(seg(dt, T.profileIn[0], T.profileIn[1])),
            }}
          >
            <div className="flex items-center gap-2.5 rounded-xl glass px-3 py-2.5 shadow-[0_10px_30px_rgba(0,0,0,0.4)]">
              <span className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-accent/15 border border-accent/40 text-accent font-display text-[15px]">
                F
              </span>
              <div className="leading-tight">
                <div className="text-[12.5px] text-white font-medium">Ferrah</div>
                <div className="text-[10px] text-white/50">VP Sales · Brightwave</div>
              </div>
              <span className="ml-1 inline-flex items-center justify-center w-5 h-5 rounded bg-white shadow-[0_1px_4px_rgba(0,0,0,0.4)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logos/linkedin.png" alt="LinkedIn" width={12} height={12} style={{ width: 12, height: 12 }} className="object-contain" />
              </span>
            </div>
          </div>

          {/* the 5 LinkedIn-outreach steps */}
          {STEPS.map((s, i) => {
            const a = clamp01((dt - nodeAppear(i)) / T.nodeDur);
            if (a <= 0) return null;
            const nd = L.nodes[i];
            return (
              <div
                key={s.key}
                className="absolute z-20 flex flex-col items-center"
                style={{
                  left: px(nd.x, L.w),
                  top: px(nd.y, L.h),
                  transform: "translate(-50%,-50%)",
                  opacity: a,
                }}
              >
                <span className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-ink-900/85 border border-accent/40 backdrop-blur-sm shadow-[0_8px_22px_rgba(0,0,0,0.4)]">
                  <StepIcon kind={s.kind} />
                </span>
                <div
                  className="mt-2 w-[128px] text-center"
                  style={{ transform: `translateY(${(1 - a) * 6}px)` }}
                >
                  <div className="text-[11px] font-mono text-white leading-tight">{s.label}</div>
                  <div className="text-[9.5px] text-white/45 leading-tight mt-0.5">{s.sub}</div>
                </div>
              </div>
            );
          })}

          {/* key point callout */}
          <Callout
            x={px((L.nodes[0].x + L.nodes[N - 1].x) / 2, L.w)}
            y={px(L.h * 0.82, L.h)}
            anchor="center"
            tone="accent"
            label="Same buyer · second channel"
            sub="email + LinkedIn, working together"
            appear={seg(dt, T.flowStart - 0.4, T.flowStart + 0.4)}
            reduced={reduce}
            className="[&_*]:!normal-case"
          />
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
  if (kind === "linkedin") {
    return (
      <span className="inline-flex items-center justify-center w-6 h-6 rounded bg-white shadow-[0_1px_4px_rgba(0,0,0,0.4)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logos/linkedin.png" alt="LinkedIn" width={16} height={16} style={{ width: 16, height: 16 }} className="object-contain" />
      </span>
    );
  }
  if (kind === "view") {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className="text-accent">
        <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z" {...stroke} />
        <circle cx="12" cy="12" r="2.6" {...stroke} />
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
