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

/** Sprint = 6–8 parallel campaigns, one per segment. Segments are a deliberate
 *  mix of buying SIGNALS (funding/hiring/launches — active intent), VERTICALS
 *  (industry), and ROLES (persona). Winners scale, others rest.
 *  Swap this array to change the shown segments — everything else is derived. */
type Outcome = "winner" | "runner" | "rest";
type Category = "signal" | "vertical" | "role";
type Campaign = { category: Category; segment: string; angle: string; outcome: Outcome; replies: number };
const CAMPAIGNS: Campaign[] = [
  { category: "signal",   segment: "Recently funded (30d)",   angle: "Where new capital lands",       outcome: "winner", replies: 51 },
  { category: "vertical", segment: "SaaS · Series A",          angle: "New funding, new priorities",   outcome: "winner", replies: 47 },
  { category: "signal",   segment: "Hiring BDRs",              angle: "Skip 6 months of ramp",         outcome: "winner", replies: 42 },
  { category: "role",     segment: "VP Sales · Mid-market",    angle: "Predictable pipeline",          outcome: "runner", replies: 33 },
  { category: "vertical", segment: "Shopify Plus",             angle: "Break the DTC ceiling",         outcome: "runner", replies: 31 },
  { category: "signal",   segment: "Product Hunt (60d)",       angle: "First 100 customers",           outcome: "runner", replies: 28 },
  { category: "role",     segment: "Founders · Bootstrapped",  angle: "Every hour matters",            outcome: "rest",   replies: 11 },
  { category: "vertical", segment: "Agencies · 10–50",         angle: "Get your team's hours back",    outcome: "rest",   replies: 8  },
];
const N = CAMPAIGNS.length;
const N_SIGNALS = CAMPAIGNS.filter((c) => c.category === "signal").length;

// ── beat timeline (seconds) ──
const T = {
  hubStart: 0.3,
  hubEnd: 1.2,
  cardStart: 1.4,
  cardStagger: 0.28,
  cardDur: 0.55,
  livesStart: 4.6,
  livesEnd: 9.4,
  decisionAt: 9.6,   // outcome revealed (winner / runner / rest)
  fadeAt: 10.2,      // losers dim, winners glow
};
const DURATION = 12.4;
const P_PERIOD = 3.2; // ambient particle period (seamless loop)

type Pt = { x: number; y: number };
type Layout = {
  w: number;
  h: number;
  hub: Pt;
  cards: Pt[];
  railRight: number;
};

export default function SprintScreen({ businessName, deckHandleRef, onDone }: ScreenProps) {
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
      { n: "01", title: "Split into 6–8 best-fit segments", detail: <p>We break {businessName}&apos;s list into a deliberate mix of <span className="text-white/80">verticals</span> (industry), <span className="text-white/80">roles</span> (persona), and <span className="text-white/80">buying signals</span> (active intent), so each campaign speaks to one type of buyer.</p> },
      { n: "02", title: "Signals catch buyers early", detail: <p>Recently funded, a BDR hire, a Product Hunt launch: these are companies actively spending right now. Signal-based segments consistently reply first.</p> },
      { n: "03", title: "One campaign per segment", detail: <p>Every segment gets its own angle, offer and channel mix (email, LinkedIn and direct mail), never one message duct-taped across the whole list.</p> },
      { n: "04", title: "All 6–8 send in parallel", detail: <p>Every experiment runs at the same time. No favorites, real replies pick the winners.</p> },
      { n: "05", title: "Winners scale · losers rest", detail: <p>Top 2–3 campaigns double their volume. Underperformers pause and get rewritten. Every week we compound what&apos;s working.</p> },
    ],
    [businessName]
  );

  const cardAppear = (i: number) => T.cardStart + i * T.cardStagger;

  const computeLayout = useCallback(() => {
    const root = rootRef.current;
    if (!root) return;
    const w = root.clientWidth;
    const h = root.clientHeight;
    const railRight = Math.min(w * 0.34, 440);
    const canvasLeft = railRight + 24;
    const canvasRight = w - 24;
    const hubX = canvasLeft + (canvasRight - canvasLeft) * 0.14;
    const hubY = h * 0.5;
    const cardsX = canvasLeft + (canvasRight - canvasLeft) * 0.78;
    const cards: Pt[] = Array.from({ length: N }, (_, i) => ({
      x: cardsX,
      y: lerp(h * 0.13, h * 0.87, i / (N - 1)),
    }));
    layoutRef.current = { w, h, hub: { x: hubX, y: hubY }, cards, railRight };
  }, []);

  /** curves + flowing particles from the hub to each campaign card */
  const drawCanvas = useCallback((t: number) => {
    const ctx = ctxRef.current;
    const L = layoutRef.current;
    if (!ctx || !L) return;
    const { w, h, hub, cards } = L;
    ctx.clearRect(0, 0, w, h);

    // hub glow (breathes with the particle period → seamless)
    const hubEv = easeOut(seg(t, T.hubStart, T.hubEnd));
    if (hubEv > 0) {
      const breathe = 1 + 0.09 * Math.sin((t / P_PERIOD) * Math.PI * 2);
      const r = 56 * breathe;
      const g = ctx.createRadialGradient(hub.x, hub.y, 0, hub.x, hub.y, r);
      g.addColorStop(0, `rgba(255,90,77,${0.16 * hubEv})`);
      g.addColorStop(1, "rgba(255,90,77,0)");
      ctx.fillStyle = g;
      ctx.fillRect(hub.x - r, hub.y - r, r * 2, r * 2);
    }

    // one bezier per campaign, packet flowing along it once "live"
    cards.forEach((c, i) => {
      const appear = clamp01((t - cardAppear(i)) / T.cardDur);
      if (appear <= 0) return;

      // outcome after decision moment — losers dim their line
      const decided = t >= T.decisionAt;
      const oc = CAMPAIGNS[i].outcome;
      const isWin = decided && oc === "winner";
      const isRunner = decided && oc === "runner";
      const isRest = decided && oc === "rest";
      const dim = isRest ? 0.35 : 1;

      // curve path (once fully appeared, hold it)
      const c1: Pt = { x: lerp(hub.x, c.x, 0.55), y: hub.y };
      const c2: Pt = { x: lerp(hub.x, c.x, 0.5),  y: c.y };
      const segs = 28;
      const upTo = Math.max(1, Math.floor(segs * appear));
      ctx.beginPath();
      ctx.moveTo(hub.x, hub.y);
      for (let q = 1; q <= upTo; q++) {
        const f = q / segs;
        ctx.lineTo(bz(hub.x, c1.x, c2.x, c.x, f), bz(hub.y, c1.y, c2.y, c.y, f));
      }
      const lineColor = isWin
        ? `rgba(255,90,77,${0.34 * dim})`
        : isRunner
        ? `rgba(255,150,135,${0.28 * dim})`
        : `rgba(255,90,77,${0.18 * dim})`;
      ctx.strokeStyle = lineColor;
      ctx.lineWidth = isWin ? 1.5 : 1.1;
      ctx.stroke();

      // flowing packets (2 per line) — seamless via phase()
      if (appear >= 1 && !isRest) {
        const pk = isWin ? 3 : 2;
        for (let k = 0; k < pk; k++) {
          const f = phase(t, P_PERIOD, k / pk + i * 0.11);
          const fade = Math.sin(Math.PI * f);
          const px = bz(hub.x, c1.x, c2.x, c.x, f);
          const py = bz(hub.y, c1.y, c2.y, c.y, f);
          ctx.beginPath();
          ctx.arc(px, py, isWin ? 2.1 : 1.7, 0, Math.PI * 2);
          const alpha = (0.5 + 0.4 * fade) * dim;
          ctx.fillStyle = isRunner
            ? `rgba(167,143,255,${alpha})`
            : `rgba(255,150,135,${alpha})`;
          ctx.fill();
        }
      }
    });

    // arriving-reply blips at each card position (build-only during livesStart→livesEnd)
    const livesEv = seg(t, T.livesStart, T.livesEnd);
    if (livesEv > 0 && livesEv < 1.05) {
      cards.forEach((c, i) => {
        if (CAMPAIGNS[i].outcome === "rest") return;
        // deterministic ping schedule per card
        const period = 0.9 + (i % 3) * 0.25;
        const p = ((t - T.livesStart + i * 0.13) % period) / period;
        const fade = Math.max(0, Math.sin(Math.PI * p));
        if (fade < 0.02) return;
        ctx.beginPath();
        ctx.arc(c.x - 6, c.y, 4 + 8 * p, 0, Math.PI * 2);
        ctx.strokeStyle =
          CAMPAIGNS[i].outcome === "winner"
            ? `rgba(255,150,135,${0.55 * fade * livesEv})`
            : `rgba(167,143,255,${0.5 * fade * livesEv})`;
        ctx.lineWidth = 1.3;
        ctx.stroke();
      });
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

  // ── derived overlay state ──
  const cardsPresent = (() => {
    let c = 0;
    for (let i = 0; i < N; i++) if (dt >= cardAppear(i)) c++;
    return c;
  })();
  const totalReplies = (() => {
    const ramp = easeOut(clamp01((dt - T.livesStart) / (T.livesEnd - T.livesStart)));
    return Math.round(
      CAMPAIGNS.reduce((s, c) => s + c.replies, 0) * ramp
    );
  })();
  const activeNarration =
    dt >= T.fadeAt ? 5
    : dt >= T.livesEnd ? 4
    : dt >= T.livesStart ? 3
    : dt >= T.cardStart + T.cardStagger * 2 ? 2
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

      {/* narration rail */}
      <NarrationRail
        eyebrow={<><span className="dot" /> Step 05 · Sprint · 6–8 campaigns in parallel</>}
        headline={
          <>
            <span className="text-gradient">We don&apos;t run one campaign.</span>
            <br />
            <span className="text-gradient-accent">Six to eight, in parallel.</span>
          </>
        }
        steps={steps}
        activeCount={activeNarration}
        reduced={reduce}
      />

      {/* top-right animated status */}
      <div className="absolute top-9 right-9 z-30 flex items-center gap-2">
        <div className="flex items-center gap-2 chip">
          <span className="font-display text-[20px] text-white leading-none tabular-nums">{cardsPresent}</span>
          <span className="text-white/45">/ {N} campaigns</span>
        </div>
        <div className="flex items-center gap-1.5 chip">
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: "#ff5a4d", boxShadow: "0 0 8px #ff5a4d" }}
          />
          <span className="text-white/85 tabular-nums">{N_SIGNALS}</span>
          <span className="text-white/45">signals</span>
        </div>
      </div>

      {L && (
        <>
          {/* central hub — "your list" */}
          <div
            className="absolute z-20"
            style={{
              left: px(L.hub.x, L.w),
              top: px(L.hub.y, L.h),
              transform: "translate(-50%,-50%)",
              opacity: clamp01(seg(dt, T.hubStart, T.hubEnd)),
            }}
          >
            <div className="flex flex-col items-center gap-1.5">
              <div className="inline-flex items-center gap-1.5 rounded-lg bg-accent/12 border border-accent/45 px-3 py-2 backdrop-blur-sm">
                <span className="w-2 h-2 rounded-full bg-accent shadow-[0_0_10px_#ff5a4d]" />
                <span className="font-mono text-[11.5px] text-white whitespace-nowrap">Your qualified list</span>
              </div>
              <span className="text-[9px] font-mono uppercase tracking-[0.2em] text-accent/70">split into segments</span>
            </div>
          </div>

          {/* 6–8 campaign cards */}
          {CAMPAIGNS.map((c, i) => {
            const a = clamp01((dt - cardAppear(i)) / T.cardDur);
            if (a <= 0) return null;
            const decided = dt >= T.decisionAt;
            const faded = dt >= T.fadeAt;
            const oc = c.outcome;
            const winner = decided && oc === "winner";
            const runner = decided && oc === "runner";
            const rest = decided && oc === "rest";
            const dim = faded && rest ? 0.42 : 1;

            // live-reply count for THIS card
            const cRamp = easeOut(clamp01((dt - T.livesStart) / (T.livesEnd - T.livesStart)));
            const cReplies = Math.round(c.replies * cRamp);

            return (
              <div
                key={c.segment}
                className="absolute z-20"
                style={{
                  left: px(L.cards[i].x, L.w),
                  top: px(L.cards[i].y, L.h),
                  transform: `translate(0,-50%) scale(${reduce ? 1 : lerp(0.88, 1, easeOutBack(a))})`,
                  opacity: a * dim,
                  transition: "opacity 0.6s ease",
                }}
              >
                <div
                  className={[
                    "inline-flex items-start gap-2.5 rounded-lg bg-ink-900/85 border pl-2.5 pr-3 py-2 backdrop-blur-sm min-w-[210px]",
                    winner
                      ? "border-accent/70 shadow-[0_0_0_1px_rgba(255,90,77,0.28),0_10px_24px_rgba(255,90,77,0.18)]"
                      : runner
                      ? "border-violet-glow/55 shadow-[0_0_0_1px_rgba(124,92,255,0.22),0_10px_20px_rgba(124,92,255,0.14)]"
                      : "border-white/12",
                  ].join(" ")}
                >
                  <span
                    className={[
                      "mt-0.5 inline-flex items-center justify-center w-4 h-4 rounded-full shrink-0 text-[8px] font-mono",
                      winner
                        ? "bg-accent/20 border border-accent/60 text-accent"
                        : runner
                        ? "bg-violet-glow/18 border border-violet-glow/55 text-violet-glow"
                        : "bg-white/[0.05] border border-white/15 text-white/45",
                    ].join(" ")}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div className="flex flex-col min-w-0">
                    <span className="flex items-center gap-1.5 leading-none mb-1">
                      <span
                        className={[
                          "font-mono text-[8.5px] uppercase tracking-[0.16em]",
                          c.category === "signal"
                            ? "text-accent"
                            : c.category === "vertical"
                            ? "text-violet-glow"
                            : "text-white/45",
                        ].join(" ")}
                      >
                        {c.category === "signal" ? "● signal" : c.category === "vertical" ? "vertical" : "role"}
                      </span>
                    </span>
                    <span className="font-mono text-[11px] text-white whitespace-nowrap leading-tight">
                      {c.segment}
                    </span>
                    <span className="text-[10px] text-white/55 leading-tight mt-0.5 whitespace-nowrap">
                      {c.angle}
                    </span>
                    <span
                      className="mt-1 inline-flex items-center gap-1 text-[9.5px] font-mono transition-opacity"
                      style={{ opacity: clamp01((dt - T.livesStart) / 0.6) }}
                    >
                      <span
                        className={
                          winner ? "text-accent" : runner ? "text-violet-glow" : "text-white/45"
                        }
                      >
                        {cReplies}
                      </span>
                      <span className="text-white/40">replies</span>
                      {winner && faded && (
                        <span className="ml-1.5 px-1.5 py-[1px] rounded-full text-[8px] uppercase tracking-[0.14em] bg-accent/15 border border-accent/45 text-accent">
                          scaling
                        </span>
                      )}
                      {rest && faded && (
                        <span className="ml-1.5 px-1.5 py-[1px] rounded-full text-[8px] uppercase tracking-[0.14em] bg-white/[0.05] border border-white/15 text-white/45">
                          resting
                        </span>
                      )}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}

          {/* on-canvas callouts, matching the site's callout system */}
          <Callout
            x={px(L.hub.x, L.w)}
            y={px(L.h * 0.15, L.h)}
            anchor="center"
            tone="accent"
            label="6 to 8 experiments"
            sub="verticals · roles · buying signals"
            appear={seg(dt, T.cardStart + 0.4, T.cardStart + 1.2)}
            reduced={reduce}
            className="[&_*]:!normal-case"
          />
          <Callout
            x={px((L.hub.x + L.cards[0].x) / 2, L.w)}
            y={px(L.h * 0.86, L.h)}
            anchor="center"
            tone="violet"
            label="Replies pick the winners"
            appear={seg(dt, T.livesStart, T.livesStart + 0.8)}
            reduced={reduce}
            className="[&_*]:!normal-case"
          />

          {/* Sprint outcome pill (does NOT stop the scene — packets keep flowing) */}
          <div
            className="absolute z-30"
            style={{
              left: px(L.hub.x + (L.cards[0].x - L.hub.x) * 0.5, L.w),
              top: px(L.h * 0.075, L.h),
              transform: "translate(-50%,-50%)",
              opacity: clamp01((dt - T.decisionAt) / 0.6),
            }}
          >
            <span className="inline-flex items-center gap-2 rounded-full bg-accent/15 border border-accent/45 px-3.5 py-1.5 text-[11px] font-mono text-accent shadow-[0_6px_22px_rgba(255,90,77,0.16)]">
              <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
              3 winners identified · scaling now
            </span>
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

/** cubic bezier scalar helper (shared shape with ListBuildingScreen) */
function bz(p0: number, p1: number, p2: number, p3: number, t: number) {
  const u = 1 - t;
  return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
}
