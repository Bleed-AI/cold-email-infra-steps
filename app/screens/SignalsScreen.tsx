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
 * SIGNALS — the always-on monitoring layer. Six source streams flow into a
 * central radar; matched events emerge as buying signals on the right,
 * populating a live-feed of "companies actively spending right now."
 *
 * All content is driven by the two arrays below (SOURCES + SIGNALS) —
 * swap them to change what's shown, everything else is derived.
 */
type SourceKey = "job" | "social" | "funding" | "launch" | "web" | "community";
type SourceDef = { key: SourceKey; label: string; logo: string | null; sub: string; icon: string };

const SOURCES: SourceDef[] = [
  { key: "job",       label: "Job posts",       logo: "linkedin", sub: "Hiring roles",       icon: "briefcase" },
  { key: "social",    label: "LinkedIn posts",  logo: "linkedin", sub: "Role announcements", icon: "user" },
  { key: "funding",   label: "Funding events",  logo: null,       sub: "Crunchbase · press", icon: "trending" },
  { key: "launch",    label: "Product launches", logo: null,      sub: "Product Hunt · HN",  icon: "rocket" },
  { key: "web",       label: "Web / tech stack", logo: null,      sub: "BuiltWith · scrape", icon: "code" },
  { key: "community", label: "Communities",     logo: null,       sub: "Reddit · HN · X",    icon: "chat" },
];
const NS = SOURCES.length;

type DetectedSignal = { company: string; event: string; source: SourceKey; ago: string; hot?: boolean };
const SIGNALS: DetectedSignal[] = [
  { company: "Brightwave Labs",   event: "VP Sales hired",              source: "job",       ago: "2h",  hot: true },
  { company: "NorthPeak SaaS",    event: "Raised $12M Series A",        source: "funding",   ago: "4h",  hot: true },
  { company: "Vertex Robotics",   event: "Launched Analytics Pro",       source: "launch",    ago: "6h" },
  { company: "Coastal Analytics", event: "BDR job posted",              source: "job",       ago: "8h" },
  { company: "StackFlow CEO",     event: "Posted on scaling outbound",   source: "social",    ago: "12h" },
  { company: "Zeta Systems",      event: "Added Salesforce",            source: "web",       ago: "1d" },
  { company: "Amber Devices",     event: "New CTO announcement",        source: "social",    ago: "1d",  hot: true },
  { company: "Rho Payments",      event: "Featured on Product Hunt",    source: "launch",    ago: "2d" },
];
const NS2 = SIGNALS.length;

// ── beat timeline (seconds) ──
const T = {
  sourceStart: 0.3,
  sourceStagger: 0.13,
  hubStart: 1.5,
  hubEnd: 2.5,
  flowStart: 2.3,
  signalStart: 3.5,
  signalStagger: 0.6,
  signalDur: 0.55,
};
const DURATION = 12.6;
const P_PERIOD = 3.2;  // ambient particle period (seamless loop)
const RADAR_PERIOD = 3.2; // radar sweep period

type Pt = { x: number; y: number };
type Layout = {
  w: number;
  h: number;
  sources: Pt[];
  hub: Pt;
  signals: Pt[];
  hubR: number;
  railRight: number;
};

export default function SignalsScreen({ businessName, deckHandleRef, onDone }: ScreenProps) {
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
      { n: "01", title: "We monitor 6 signal sources — 24/7", detail: <p>Job posts, LinkedIn announcements, funding rounds, product launches, tech-stack changes and community mentions — all watched continuously for {businessName}&apos;s ideal buyers.</p> },
      { n: "02", title: "Every match becomes a signal", detail: <p>A new BDR hire, a Series A raise, a Product Hunt launch — each is a company actively spending right now. Not a cold guess: a live event.</p> },
      { n: "03", title: "Enriched the moment it fires", detail: <p>Signal attaches to the company, we find the decision-maker, and the copy hook writes itself around <span className="text-white/80">what just happened</span>.</p> },
      { n: "04", title: "Signal-based prospects reply first", detail: <p>Because they&apos;re already in motion, not stationary. Signals outperform pure firmographic segments in almost every sprint.</p> },
      { n: "05", title: "Not one campaign — 6 to 8 experiments", detail: <p>Each signal type becomes its own campaign in Sprint (Step 05) — job-signal, funding-signal, launch-signal each get their own angle, offer and channel mix (email, LinkedIn, direct mail). Always fresh, always warm.</p> },
    ],
    [businessName]
  );

  const sourceAppear = (i: number) => T.sourceStart + i * T.sourceStagger;
  const signalAppear = (i: number) => T.signalStart + i * T.signalStagger;

  const computeLayout = useCallback(() => {
    const root = rootRef.current;
    if (!root) return;
    const w = root.clientWidth;
    const h = root.clientHeight;
    const railRight = Math.min(w * 0.34, 440);
    const canvasLeft = railRight + 32;
    const canvasRight = w - 32;
    const canvasW = canvasRight - canvasLeft;

    const sourcesX = canvasLeft + canvasW * 0.02;
    const sources: Pt[] = Array.from({ length: NS }, (_, i) => ({
      x: sourcesX,
      y: lerp(h * 0.16, h * 0.86, i / (NS - 1)),
    }));

    const hubX = canvasLeft + canvasW * 0.45;
    const hubY = h * 0.52;
    const hubR = Math.min(Math.min(w, h) * 0.075, 90);

    const signalsX = canvasLeft + canvasW * 0.78;
    const signals: Pt[] = Array.from({ length: NS2 }, (_, i) => ({
      x: signalsX,
      y: lerp(h * 0.135, h * 0.87, i / (NS2 - 1)),
    }));

    layoutRef.current = { w, h, sources, hub: { x: hubX, y: hubY }, signals, hubR, railRight };
  }, []);

  /** Canvas: radar hub, source→hub curves + packets, hub→signal packets on match */
  const drawCanvas = useCallback((t: number) => {
    const ctx = ctxRef.current;
    const L = layoutRef.current;
    if (!ctx || !L) return;
    const { w, h, sources, hub, signals, hubR } = L;
    ctx.clearRect(0, 0, w, h);

    const hubEv = easeOut(seg(t, T.hubStart, T.hubEnd));

    // — Radar hub: pulsing rings + sweeping arc + center core —
    if (hubEv > 0) {
      // Concentric pulsing rings (3 waves, offset by 1/3 period → seamless)
      for (let k = 0; k < 3; k++) {
        const f = phase(t, RADAR_PERIOD, k / 3);
        const r = hubR * (0.5 + f * 1.8);
        const fade = (1 - f) * hubEv * 0.55;
        ctx.beginPath();
        ctx.arc(hub.x, hub.y, r, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255,90,77,${fade})`;
        ctx.lineWidth = 1.1;
        ctx.stroke();
      }

      // Inner glow
      const g = ctx.createRadialGradient(hub.x, hub.y, 0, hub.x, hub.y, hubR * 1.4);
      g.addColorStop(0, `rgba(255,90,77,${0.22 * hubEv})`);
      g.addColorStop(1, "rgba(255,90,77,0)");
      ctx.fillStyle = g;
      ctx.fillRect(hub.x - hubR * 1.5, hub.y - hubR * 1.5, hubR * 3, hubR * 3);

      // Radar sweep arc (rotates once per RADAR_PERIOD)
      const sweepAngle = (t / RADAR_PERIOD) * Math.PI * 2;
      const trailSpan = Math.PI / 2.6; // ~70° trailing arc
      ctx.save();
      ctx.translate(hub.x, hub.y);
      ctx.rotate(sweepAngle);
      const sweepG = ctx.createLinearGradient(0, 0, hubR * 0.98, 0);
      sweepG.addColorStop(0, "rgba(255,150,135,0)");
      sweepG.addColorStop(1, `rgba(255,150,135,${0.55 * hubEv})`);
      ctx.fillStyle = sweepG;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, hubR * 0.98, -trailSpan, 0);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // Outer ring
      ctx.beginPath();
      ctx.arc(hub.x, hub.y, hubR * 0.98, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255,150,135,${0.6 * hubEv})`;
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // Center dot
      ctx.beginPath();
      ctx.arc(hub.x, hub.y, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = "#ff5a4d";
      ctx.shadowBlur = 14;
      ctx.shadowColor = "#ff5a4d";
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // — Curves from each source into the hub, with flowing packets —
    sources.forEach((s, i) => {
      const a = clamp01((t - sourceAppear(i)) / 0.5);
      if (a <= 0) return;

      const c1: Pt = { x: lerp(s.x, hub.x, 0.55), y: s.y };
      const c2: Pt = { x: lerp(s.x, hub.x, 0.45), y: hub.y };
      const segs = 28;
      const upTo = Math.max(1, Math.floor(segs * a));
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      for (let q = 1; q <= upTo; q++) {
        const f = q / segs;
        ctx.lineTo(bz(s.x, c1.x, c2.x, hub.x, f), bz(s.y, c1.y, c2.y, hub.y, f));
      }
      ctx.strokeStyle = `rgba(255,90,77,${0.2 * a})`;
      ctx.lineWidth = 1;
      ctx.stroke();

      // Packets flowing source→hub (once "live")
      if (a >= 1 && t >= T.flowStart) {
        const pk = 2;
        for (let k = 0; k < pk; k++) {
          const f = phase(t, P_PERIOD, k / pk + i * 0.11);
          const fade = Math.sin(Math.PI * f);
          const px = bz(s.x, c1.x, c2.x, hub.x, f);
          const py = bz(s.y, c1.y, c2.y, hub.y, f);
          ctx.beginPath();
          ctx.arc(px, py, 1.7, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255,150,135,${0.75 * fade})`;
          ctx.fill();
        }
      }
    });

    // — Curves from hub to each signal card (only after the signal has appeared) —
    signals.forEach((sp, i) => {
      const a0 = signalAppear(i);
      const a = clamp01((t - a0) / T.signalDur);
      if (a <= 0) return;

      const c1: Pt = { x: lerp(hub.x, sp.x, 0.55), y: hub.y };
      const c2: Pt = { x: lerp(hub.x, sp.x, 0.45), y: sp.y };
      const segs = 22;
      const upTo = Math.max(1, Math.floor(segs * a));
      ctx.beginPath();
      ctx.moveTo(hub.x, hub.y);
      for (let q = 1; q <= upTo; q++) {
        const f = q / segs;
        ctx.lineTo(bz(hub.x, c1.x, c2.x, sp.x, f), bz(hub.y, c1.y, c2.y, sp.y, f));
      }
      const isHot = !!SIGNALS[i].hot;
      ctx.strokeStyle = isHot ? `rgba(255,90,77,${0.32 * a})` : `rgba(124,92,255,${0.28 * a})`;
      ctx.lineWidth = isHot ? 1.4 : 1.1;
      ctx.stroke();

      // A single packet fires along the curve when the signal "detects"
      if (a >= 1) {
        const f = phase(t, P_PERIOD, i * 0.17);
        const fade = Math.sin(Math.PI * f);
        const px = bz(hub.x, c1.x, c2.x, sp.x, f);
        const py = bz(hub.y, c1.y, c2.y, sp.y, f);
        ctx.beginPath();
        ctx.arc(px, py, isHot ? 2.1 : 1.6, 0, Math.PI * 2);
        ctx.fillStyle = isHot
          ? `rgba(255,150,135,${0.85 * fade})`
          : `rgba(167,143,255,${0.75 * fade})`;
        ctx.fill();
      }

      // "Detected" ping ring on arrival (once)
      const pingAge = t - (a0 + T.signalDur);
      if (pingAge >= 0 && pingAge < 1.1) {
        const k = pingAge / 1.1;
        ctx.beginPath();
        ctx.arc(sp.x - 6, sp.y, 5 + k * 22, 0, Math.PI * 2);
        ctx.strokeStyle = isHot
          ? `rgba(255,90,77,${0.6 * (1 - k)})`
          : `rgba(167,143,255,${0.55 * (1 - k)})`;
        ctx.lineWidth = 1.4;
        ctx.stroke();
      }
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

  // ── derived overlay state ──
  const signalsDetected = (() => {
    let c = 0;
    for (let i = 0; i < NS2; i++) if (dt >= signalAppear(i) + T.signalDur * 0.8) c++;
    return c;
  })();
  const activeNarration =
    dt >= signalAppear(NS2 - 1) + 1.2 ? 5
    : dt >= T.signalStart + 1.0 ? 4
    : dt >= T.flowStart ? 3
    : dt >= T.hubStart ? 2
    : 1;

  const L = layoutRef.current;
  const px = (v: number, total: number) => `${(v / total) * 100}%`;

  return (
    <div ref={rootRef} className="relative h-full w-full overflow-hidden bg-ink-950">
      <div className="absolute inset-0 bg-grid-fine opacity-[0.16]" />
      <div
        className="absolute inset-0"
        style={{ background: "radial-gradient(60% 55% at 55% 50%, rgba(255,90,77,0.08), transparent 62%)" }}
      />
      <div className="noise" />
      <canvas ref={canvasRef} className="absolute inset-0" />

      <NarrationRail
        eyebrow={<><span className="dot" /> Step 04 · Buying signals · always-on</>}
        headline={
          <>
            <span className="text-gradient">Live signals in.</span>
            <br />
            <span className="text-gradient-accent">Six to eight campaigns out.</span>
          </>
        }
        steps={steps}
        activeCount={activeNarration}
        reduced={reduce}
      />

      {/* top-right animated status */}
      <div className="absolute top-9 right-9 z-30 flex items-center gap-2">
        <div className="flex items-center gap-2 chip">
          <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
          <span className="text-white/85 font-mono text-[11px] uppercase tracking-[0.14em]">Monitoring</span>
        </div>
        <div className="flex items-center gap-2 chip">
          <span className="font-display text-[20px] text-white leading-none tabular-nums">{signalsDetected}</span>
          <span className="text-white/45">/ {NS2} signals · last 24h</span>
        </div>
      </div>

      {L && (
        <>
          {/* Source column — 6 monitored streams */}
          {SOURCES.map((s, i) => {
            const a = clamp01((dt - sourceAppear(i)) / 0.5);
            if (a <= 0) return null;
            return (
              <div
                key={s.key}
                className="absolute z-20"
                style={{
                  left: px(L.sources[i].x, L.w),
                  top: px(L.sources[i].y, L.h),
                  transform: `translate(0,-50%) scale(${reduce ? 1 : lerp(0.9, 1, easeOutBack(a))})`,
                  opacity: a,
                }}
              >
                <div className="inline-flex items-center gap-2 rounded-lg bg-ink-900/85 border border-white/12 pl-1.5 pr-2.5 py-1.5 backdrop-blur-sm">
                  <SourceIcon icon={s.icon} logo={s.logo} />
                  <div className="flex flex-col leading-tight">
                    <span className="font-mono text-[10.5px] text-white whitespace-nowrap">{s.label}</span>
                    <span className="text-[8.5px] font-mono uppercase tracking-[0.12em] text-white/45 whitespace-nowrap">{s.sub}</span>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Central radar hub — labeled */}
          <div
            className="absolute z-20"
            style={{
              left: px(L.hub.x, L.w),
              top: px(L.hub.y, L.h),
              transform: "translate(-50%,-50%)",
              opacity: clamp01(seg(dt, T.hubStart, T.hubEnd)),
            }}
          >
            <div className="flex flex-col items-center gap-1.5" style={{ marginTop: L.hubR + 12 }}>
              <span className="text-[9px] font-mono uppercase tracking-[0.2em] text-accent/80">Signals radar</span>
              <span className="text-[8.5px] font-mono uppercase tracking-[0.14em] text-white/40">pattern match</span>
            </div>
          </div>

          {/* Detected signals — populate on the right */}
          {SIGNALS.map((s, i) => {
            const a = clamp01((dt - signalAppear(i)) / T.signalDur);
            if (a <= 0) return null;
            return (
              <div
                key={s.company + i}
                className="absolute z-20"
                style={{
                  left: px(L.signals[i].x, L.w),
                  top: px(L.signals[i].y, L.h),
                  transform: `translate(0,-50%) scale(${reduce ? 1 : lerp(0.9, 1, easeOutBack(a))})`,
                  opacity: a,
                }}
              >
                <div
                  className={[
                    "inline-flex items-start gap-2 rounded-lg bg-ink-900/85 border pl-2 pr-2.5 py-1.5 backdrop-blur-sm min-w-[230px]",
                    s.hot
                      ? "border-accent/55 shadow-[0_0_0_1px_rgba(255,90,77,0.2),0_8px_20px_rgba(255,90,77,0.14)]"
                      : "border-violet-glow/40",
                  ].join(" ")}
                >
                  <span
                    className={[
                      "mt-0.5 inline-flex items-center justify-center w-4 h-4 rounded-full shrink-0 text-[8px] font-mono",
                      s.hot
                        ? "bg-accent/18 border border-accent/60 text-accent"
                        : "bg-violet-glow/15 border border-violet-glow/50 text-violet-glow",
                    ].join(" ")}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div className="flex flex-col min-w-0">
                    <span className="flex items-center gap-1.5 leading-none mb-1">
                      <span
                        className={[
                          "font-mono text-[8.5px] uppercase tracking-[0.16em]",
                          s.hot ? "text-accent" : "text-violet-glow",
                        ].join(" ")}
                      >
                        {s.hot ? "● " : ""}
                        {sourceLabel(s.source)}
                      </span>
                      {s.hot && (
                        <span className="text-[8px] font-mono uppercase tracking-[0.14em] px-1.5 py-[1px] rounded-full bg-accent/15 border border-accent/45 text-accent">
                          hot
                        </span>
                      )}
                    </span>
                    <span className="font-mono text-[11px] text-white whitespace-nowrap leading-tight">
                      {s.company}
                    </span>
                    <span className="text-[10px] text-white/60 leading-tight mt-0.5 whitespace-nowrap">
                      {s.event}
                    </span>
                    <span className="text-[9px] font-mono text-white/40 leading-tight mt-0.5 whitespace-nowrap">
                      {s.ago} ago
                    </span>
                  </div>
                </div>
              </div>
            );
          })}

          {/* On-canvas callouts */}
          <Callout
            x={px(L.hub.x, L.w)}
            y={px(L.h * 0.14, L.h)}
            anchor="center"
            tone="accent"
            label="6 sources · always-on"
            sub="job posts · social · funding · launches · web · communities"
            appear={seg(dt, T.hubEnd, T.hubEnd + 0.9)}
            reduced={reduce}
            className="[&_*]:!normal-case"
          />
          <Callout
            x={px((L.hub.x + L.signals[0].x) / 2, L.w)}
            y={px(L.h * 0.9, L.h)}
            anchor="center"
            tone="violet"
            label="matched → into the signal feed"
            appear={seg(dt, T.signalStart + 0.4, T.signalStart + 1.2)}
            reduced={reduce}
            className="[&_*]:!normal-case"
          />

          {/* Multi-campaign statement panel — the "not one campaign" reinforcement */}
          <div
            className="absolute z-30"
            style={{
              left: px(L.hub.x + (L.signals[0].x - L.hub.x) * 0.5, L.w),
              top: px(L.h * 0.055, L.h),
              transform: "translate(-50%,-50%)",
              opacity: clamp01((dt - (signalAppear(NS2 - 1) + 0.6)) / 0.7),
            }}
          >
            <div className="glass rounded-2xl border border-accent/35 px-4 py-2.5 shadow-[0_10px_36px_rgba(255,90,77,0.18)]">
              <div className="flex items-center gap-2.5">
                <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                <div className="flex flex-col leading-tight">
                  <span className="font-display text-[15px] text-white">
                    Not one campaign —{" "}
                    <span className="text-accent">6&nbsp;to&nbsp;8 experiments</span>.
                  </span>
                  <span className="text-[9.5px] font-mono uppercase tracking-[0.16em] text-white/50 mt-0.5">
                    each signal type → its own campaign in Sprint (Step 05)
                  </span>
                </div>
              </div>
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

/** Small icon tile: uses a real logo image if provided, otherwise a stylized
    SVG that fits the source type. */
function SourceIcon({ icon, logo }: { icon: string; logo: string | null }) {
  if (logo) {
    return (
      <span className="inline-flex items-center justify-center rounded-md bg-white shrink-0" style={{ width: 22, height: 22 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/logos/${logo}.png`} alt={logo} width={14} height={14} style={{ width: 14, height: 14 }} className="object-contain" />
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center justify-center rounded-md bg-white/[0.08] border border-white/15 shrink-0 text-accent"
      style={{ width: 22, height: 22 }}
    >
      <IconGlyph name={icon} />
    </span>
  );
}

function IconGlyph({ name }: { name: string }) {
  switch (name) {
    case "briefcase":
      return (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
          <rect x="3" y="7" width="18" height="13" rx="2" stroke="currentColor" strokeWidth="1.8" />
          <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" stroke="currentColor" strokeWidth="1.8" />
        </svg>
      );
    case "user":
      return (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.8" />
          <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" stroke="currentColor" strokeWidth="1.8" />
        </svg>
      );
    case "trending":
      return (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
          <path d="M3 17l6-6 4 4 8-8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M14 7h7v7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "rocket":
      return (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
          <path d="M12 2c4 3 6 7 6 11l-6 3-6-3c0-4 2-8 6-11z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
          <circle cx="12" cy="10" r="1.5" stroke="currentColor" strokeWidth="1.6" />
          <path d="M8 18l-2 4 4-2M16 18l2 4-4-2" stroke="currentColor" strokeWidth="1.6" />
        </svg>
      );
    case "code":
      return (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
          <path d="M8 6l-5 6 5 6M16 6l5 6-5 6M14 4l-4 16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "chat":
    default:
      return (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
          <path d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H8l-4 4V6z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        </svg>
      );
  }
}

function sourceLabel(k: SourceKey): string {
  switch (k) {
    case "job":       return "job signal";
    case "social":    return "social signal";
    case "funding":   return "funding signal";
    case "launch":    return "launch signal";
    case "web":       return "web signal";
    case "community": return "community signal";
  }
}

function bz(p0: number, p1: number, p2: number, p3: number, t: number) {
  const u = 1 - t;
  return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
}
