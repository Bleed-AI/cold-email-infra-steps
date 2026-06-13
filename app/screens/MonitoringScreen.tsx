"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import type { ScreenProps } from "../lab/types";
import { buildSendingDomains, buildMailboxes } from "../lib/domains";
import {
  useScrubClock,
  useDeckHandle,
  seg,
  easeOut,
  easeOutBack,
  clamp01,
  lerp,
} from "../lab/engine/useScrubClock";
import { NarrationRail, type NarrationStep } from "../lab/engine/NarrationRail";

/* ──────────────────────────────────────────────────────────────────────────
   STEP 06 · A/B testing & monitoring  —  a dashboard CONSTRUCT.
   Everything is a pure function of one clock `t` (useScrubClock), so
   window.__lab.renderAt(t) renders any frame deterministically:
     - no Math.random() in the frame path,
     - which-rings-dip is fixed once in useMemo,
     - every meter / gauge / number FILLS via lerp(0,target,easeOut(seg(t,…))),
     - all three regions ASSEMBLE and STAY; the t=DURATION frame is the
       complete dashboard (so reduced-motion = one onFrame(duration) is whole).
   Canvas/SVG carry motion; ALL text/numbers/logos are DOM/SVG overlays.
   ────────────────────────────────────────────────────────────────────────── */

// ── Beat timeline (seconds). Pure functions of these. ──
const T = {
  // (a) A/B/C variants
  variantsIn: 0.5,
  variantStagger: 0.22,
  meterStart: 1.5,
  meterDur: 2.4,
  winnerAt: 4.3, // crown + scale highlight emerges

  // (b) inbox health + deliverability gauge
  healthStart: 5.0,
  ringStagger: 0.055, // ×21 ≈ 1.15s to populate
  ringDur: 0.6,
  gaugeStart: 5.4,
  gaugeDur: 3.4, // climbs to ~98%

  // (c) parallel campaigns
  campStart: 9.2,
  campStagger: 0.5,
  campBarDur: 4.0, // live progress keeps moving to the end

  // beat 4 — continuously optimized (winner scaled, weak inbox rested)
  optimizeStart: 11.2,
  pauseAt: 11.8, // the weak inbox transitions to "rested"

  // summary
  summaryStart: 12.6,
  summaryDur: 1.4,
};
const DURATION = 14.6;

const N_RINGS = 21;

// Variant reply rates (%). B is hard-coded as the max so winner can't drift.
const VARIANTS = [
  { id: "A", subject: "Quick question about {co}", target: 5.1 },
  { id: "B", subject: "{co} — a 12-min idea", target: 8.2 },
  { id: "C", subject: "Should I send this over?", target: 6.4 },
] as const;
const WINNER = 1; // index of B
const MAX_REPLY = 8.2; // bar scale ceiling headroom
const DELIVERABILITY = 98; // %

type Campaign = { name: string; target: number; start: number };

export default function MonitoringScreen({ businessName, slug, mainDomain, deckHandleRef, onDone }: ScreenProps) {
  const reduce = !!useReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const sizeRef = useRef<{ w: number; h: number }>({ w: 0, h: 0 });
  const lastTRef = useRef(0);
  const [dt, setDt] = useState(0);
  const [replayKey, setReplayKey] = useState(0);

  // 21 REAL mailboxes — one health ring each (grounds the "weak inbox" beat).
  const mailboxes = useMemo(
    () => buildMailboxes(buildSendingDomains(slug), 3),
    [slug]
  );

  // Deterministic per-ring health profile (fixed once — never frame-state).
  // A couple dip amber then recover; exactly one becomes the rested/paused inbox.
  const rings = useMemo(() => {
    const dipIdx = new Set([4, 13]); // these dip amber then recover
    const pausedIdx = 9; // this one is rested during beat 4
    return Array.from({ length: N_RINGS }, (_, i) => {
      const mb = mailboxes[i];
      const appear = T.healthStart + i * T.ringStagger;
      return {
        i,
        handle: mb?.handle ?? `inbox-${i}@${slug}.com`,
        appear,
        dips: dipIdx.has(i),
        paused: i === pausedIdx,
      };
    });
  }, [mailboxes, slug]);

  const campaigns: Campaign[] = useMemo(
    () => [
      { name: `${businessName} · Founders Q3`, target: 0.74, start: T.campStart },
      { name: `${businessName} · Ops leaders`, target: 0.52, start: T.campStart + T.campStagger },
      { name: `${businessName} · Re-engage`, target: 0.31, start: T.campStart + T.campStagger * 2 },
    ],
    [businessName]
  );

  const steps: NarrationStep[] = useMemo(
    () => [
      {
        n: "01",
        title: "We A/B test the copy",
        detail: (
          <p>
            Two to four variants run head-to-head; the version that books the most replies wins.
          </p>
        ),
      },
      {
        n: "02",
        title: "Inbox health is watched",
        detail: (
          <p>
            Every mailbox&apos;s deliverability is monitored. If one dips, it&apos;s pulled and
            rested before it can drag down the rest.
          </p>
        ),
      },
      {
        n: "03",
        title: "Campaigns run in parallel",
        detail: (
          <p>
            While one campaign sends, the next is already being built — the pipeline never goes cold.
          </p>
        ),
      },
      {
        n: "04",
        title: "Continuously optimized",
        detail: (
          <p>
            Winners scale, losers pause, and the system keeps{" "}
            <span className="text-white/80">{businessName}</span>&apos;s reply rate climbing.
          </p>
        ),
      },
    ],
    [businessName]
  );

  // ── canvas: ambient glow + flowing connectors between the regions (motion only) ──
  const drawCanvas = useCallback((t: number) => {
    const ctx = ctxRef.current;
    const { w, h } = sizeRef.current;
    if (!ctx || !w || !h) return;
    ctx.clearRect(0, 0, w, h);

    // anchor points roughly matching the DOM grid (right ~66% region)
    const railW = Math.min(w * 0.34, 440);
    const panelX = railW + 16;
    const panelW = w - panelX - 24;
    const ax = panelX + panelW * 0.27; // variants region center
    const ay = h * 0.3;
    const bx = panelX + panelW * 0.74; // health region center
    const by = h * 0.3;
    const cx = panelX + panelW * 0.5; // campaigns band center
    const cy = h * 0.78;

    // soft region glows that brighten as each region assembles
    const glow = (gx: number, gy: number, on: number, hex: string) => {
      if (on <= 0) return;
      const r = 150;
      const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, r);
      g.addColorStop(0, `${hex}${(0.1 * on).toFixed(3)})`);
      g.addColorStop(1, hex + "0)");
      ctx.fillStyle = g;
      ctx.fillRect(gx - r, gy - r, r * 2, r * 2);
    };
    glow(ax, ay, easeOut(seg(t, T.variantsIn, T.meterStart)), "rgba(124,245,208,");
    glow(bx, by, easeOut(seg(t, T.healthStart, T.gaugeStart + 1)), "rgba(124,245,208,");
    glow(cx, cy, easeOut(seg(t, T.campStart, T.campStart + 1.2)), "rgba(124,92,255,");

    // connectors: winner → health → campaigns, drawn once their source exists.
    const link = (x1: number, y1: number, x2: number, y2: number, prog: number, color: string) => {
      if (prog <= 0) return;
      const midx = (x1 + x2) / 2;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      const segs = 40;
      const last = Math.max(1, Math.floor(segs * clamp01(prog)));
      for (let s = 1; s <= last; s++) {
        const f = s / segs;
        const x = bez(x1, midx, midx, x2, f);
        const y = bez(y1, y1, y2, y2, f);
        ctx.lineTo(x, y);
      }
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.3;
      ctx.stroke();
      // flowing packet once fully connected
      if (prog >= 1) {
        const f = (t * 0.4) % 1;
        const px = bez(x1, midx, midx, x2, f);
        const py = bez(y1, y1, y2, y2, f);
        ctx.beginPath();
        ctx.arc(px, py, 2, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(164,255,225,0.9)";
        ctx.fill();
      }
    };
    link(ax, ay + 10, bx, by + 10, easeOut(seg(t, T.healthStart - 0.2, T.healthStart + 0.8)), "rgba(124,245,208,0.18)");
    link(bx, by + 10, cx, cy - 10, easeOut(seg(t, T.campStart - 0.2, T.campStart + 0.8)), "rgba(124,92,255,0.2)");
  }, []);

  const onFrame = useCallback(
    (t: number) => {
      lastTRef.current = t;
      drawCanvas(t);
      setDt(t);
    },
    [drawCanvas]
  );

  // canvas setup + resize (runs before autoplay)
  useEffect(() => {
    const canvas = canvasRef.current;
    const root = rootRef.current;
    if (!canvas || !root) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctxRef.current = ctx;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      const w = root.clientWidth;
      const h = root.clientHeight;
      sizeRef.current = { w, h };
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawCanvas(lastTRef.current);
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [drawCanvas, replayKey]);

  const controls = useScrubClock(onFrame, { duration: DURATION, reduced: reduce, autoPlay: !deckHandleRef, onDone });
  useDeckHandle(controls, deckHandleRef);

  // ── derived narration state ──
  const activeNarration =
    dt >= T.optimizeStart ? 4 : dt >= T.campStart ? 3 : dt >= T.healthStart ? 2 : dt >= T.variantsIn ? 1 : 0;

  // counters (pure fns of dt)
  const ringsLive = rings.filter((r) => dt >= r.appear).length;
  const winnerReply = lerp(0, MAX_REPLY, easeOut(seg(dt, T.meterStart, T.meterStart + T.meterDur)));
  const deliverNow = Math.round(lerp(0, DELIVERABILITY, easeOut(seg(dt, T.gaugeStart, T.gaugeStart + T.gaugeDur))));
  const campsLive = campaigns.filter((c) => dt >= c.start).length;

  return (
    <div ref={rootRef} className="relative h-full w-full overflow-hidden bg-ink-950">
      <div className="absolute inset-0 bg-grid-fine opacity-[0.16]" />
      <div
        className="absolute inset-0"
        style={{ background: "radial-gradient(70% 60% at 60% 45%, rgba(124,245,208,0.07), transparent 60%)" }}
      />
      <div className="noise" />
      <canvas ref={canvasRef} className="absolute inset-0" />

      {/* narration rail */}
      <NarrationRail
        eyebrow={<><span className="dot" /> Step 06 · A/B testing &amp; monitoring</>}
        headline={
          <>
            <span className="text-gradient">We watch</span>
            <br />
            <span className="text-gradient-accent">and we tune.</span>
          </>
        }
        steps={steps}
        activeCount={activeNarration}
        reduced={reduce}
      />

      {/* live status chip */}
      <div className="absolute top-10 right-10 z-20 flex items-center gap-2 chip">
        <span className="w-1.5 h-1.5 rounded-full bg-accent shadow-[0_0_10px_#7cf5d0]" style={{ opacity: dt > 0.3 ? 1 : 0.3 }} />
        <span className="font-display text-[15px] text-white leading-none tabular-nums">{campsLive}</span>
        <span className="text-white/45">campaigns live</span>
      </div>

      {/* ───────────── DASHBOARD GRID (right ~66%) ───────────── */}
      <div className="absolute inset-0 z-20 pointer-events-none">
        <div
          className="absolute top-0 bottom-0 right-0 flex flex-col gap-4 px-6 md:px-8 pt-10 pb-[88px] overflow-hidden"
          style={{ left: "min(34%, 440px)" }}
        >
          {/* top band: variants (left) + health/gauge (right) */}
          <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] gap-4">
            {/* (a) A/B/C variant test */}
            <RegionCard appear={seg(dt, T.variantsIn, T.variantsIn + 0.6)} reduced={reduce}>
              <RegionHead
                kicker="A/B/C variant test"
                title="Copy variants, head-to-head"
                live={dt > T.winnerAt}
              />
              <div className="mt-3 space-y-2.5">
                {VARIANTS.map((v, idx) => {
                  const appear = clamp01(seg(dt, T.variantsIn + idx * T.variantStagger, T.variantsIn + idx * T.variantStagger + 0.5));
                  const fill = easeOut(seg(dt, T.meterStart, T.meterStart + T.meterDur));
                  const val = v.target * fill;
                  const isWinner = idx === WINNER;
                  const won = isWinner && dt >= T.winnerAt;
                  // beat 4: winner scales up, losers dim/pause
                  const optimized = dt >= T.optimizeStart;
                  return (
                    <VariantBar
                      key={v.id}
                      id={v.id}
                      subject={v.subject.replace("{co}", businessName)}
                      value={val}
                      pct={(val / (MAX_REPLY * 1.05)) * 100}
                      appear={appear}
                      won={won}
                      scaled={isWinner && optimized}
                      paused={!isWinner && optimized}
                      reduced={reduce}
                    />
                  );
                })}
              </div>
            </RegionCard>

            {/* (b) inbox health + deliverability gauge */}
            <RegionCard appear={seg(dt, T.healthStart - 0.2, T.healthStart + 0.4)} reduced={reduce}>
              <RegionHead
                kicker="Inbox health"
                title="Every mailbox monitored"
                live={dt > T.gaugeStart + 0.5}
              />
              <div className="mt-3 flex gap-4 items-start min-h-0">
                {/* deliverability gauge */}
                <Gauge value={deliverNow} appear={seg(dt, T.gaugeStart - 0.2, T.gaugeStart + 0.4)} />
                {/* 21 health rings */}
                <div className="flex-1 min-w-0">
                  <div className="grid grid-cols-7 gap-x-2 gap-y-2.5">
                    {rings.map((r) => (
                      <HealthRing key={r.i} ring={r} dt={dt} />
                    ))}
                  </div>
                  <div className="mt-2.5 flex items-center justify-between text-[9px] font-mono uppercase tracking-[0.14em]">
                    <span className="text-white/35 tabular-nums">{ringsLive}/21 inboxes</span>
                    <span className="inline-flex items-center gap-2">
                      <LegendDot color="#7cf5d0" label="healthy" />
                      <LegendDot color="#facc6b" label="dip" />
                      <LegendDot color="#5b6472" label="rested" />
                    </span>
                  </div>
                </div>
              </div>
            </RegionCard>
          </div>

          {/* (c) parallel campaigns band */}
          <RegionCard appear={seg(dt, T.campStart - 0.2, T.campStart + 0.4)} reduced={reduce} className="shrink-0">
            <div className="flex items-center justify-between">
              <RegionHead
                kicker="Parallel campaigns"
                title="The pipeline never goes cold"
                live={campsLive > 0}
                inline
              />
              <span className="inline-flex items-center gap-1.5 chip !py-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logos/instantly.png" alt="" width={13} height={13} style={{ width: 13, height: 13 }} className="object-contain" />
                Instantly
              </span>
            </div>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
              {campaigns.map((c, idx) => {
                const appear = clamp01(seg(dt, c.start, c.start + 0.5));
                const prog = c.target * easeOut(seg(dt, c.start + 0.2, c.start + 0.2 + T.campBarDur));
                const scaled = idx === 0 && dt >= T.optimizeStart; // winner scaled
                return (
                  <CampaignCard
                    key={c.name}
                    name={c.name}
                    progress={prog}
                    appear={appear}
                    scaled={scaled}
                    reduced={reduce}
                  />
                );
              })}
            </div>
          </RegionCard>
        </div>
      </div>

      {/* ───────────── SUMMARY BAR (assembles last, stays) ───────────── */}
      <SummaryBar
        appear={seg(dt, T.summaryStart, T.summaryStart + T.summaryDur)}
        winnerReply={winnerReply}
        deliver={deliverNow}
        campsLive={campsLive}
        reduced={reduce}
      />

      {/* Replay */}
      <button
        onClick={() => {
          setReplayKey((k) => k + 1);
          controls.play();
        }}
        className="absolute bottom-6 right-6 z-40 inline-flex items-center gap-2 rounded-full glass px-4 py-2.5 text-[11px] font-mono uppercase tracking-[0.18em] text-white/70 hover:text-accent transition cursor-pointer"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <path d="M3 12a9 9 0 1 0 3-6.7M3 4v4h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Replay
      </button>
    </div>
  );
}

/* ───────────────────────── region shell + header ───────────────────────── */

function RegionCard({
  appear,
  reduced,
  className,
  children,
}: {
  appear: number;
  reduced?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const a = clamp01(appear);
  return (
    <div
      className={`rounded-2xl glass p-4 md:p-5 shadow-[0_20px_60px_rgba(0,0,0,0.45)] pointer-events-auto ${className ?? ""}`}
      style={{
        opacity: a,
        transform: reduced ? undefined : `translateY(${(1 - easeOut(a)) * 18}px)`,
      }}
    >
      {children}
    </div>
  );
}

function RegionHead({
  kicker,
  title,
  live,
  inline,
}: {
  kicker: string;
  title: string;
  live: boolean;
  inline?: boolean;
}) {
  return (
    <div className={inline ? "" : "flex items-center justify-between"}>
      <div>
        <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-accent/75">{kicker}</div>
        <div className="text-[13px] md:text-[14px] text-white font-medium leading-snug mt-0.5">{title}</div>
      </div>
      {!inline && (
        <span
          className="inline-flex items-center gap-1.5 rounded-full bg-accent/12 border border-accent/35 px-2 py-1 text-[9px] font-mono uppercase tracking-[0.14em] text-accent transition-opacity"
          style={{ opacity: live ? 1 : 0 }}
        >
          <span className="w-1 h-1 rounded-full bg-accent animate-pulse" /> live
        </span>
      )}
    </div>
  );
}

/* ───────────────────────── (a) variant bar ───────────────────────── */

function VariantBar({
  id,
  subject,
  value,
  pct,
  appear,
  won,
  scaled,
  paused,
  reduced,
}: {
  id: string;
  subject: string;
  value: number;
  pct: number;
  appear: number;
  won: boolean;
  scaled: boolean;
  paused: boolean;
  reduced?: boolean;
}) {
  return (
    <div
      className="transition-opacity"
      style={{
        opacity: paused ? appear * 0.4 : appear,
        transform: reduced ? undefined : `translateX(${(1 - easeOutBack(appear)) * 18}px)`,
      }}
    >
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={`inline-flex items-center justify-center w-5 h-5 rounded-md font-mono text-[11px] border ${
              won
                ? "bg-accent text-ink-950 border-accent"
                : "bg-white/5 text-white/70 border-white/15"
            }`}
          >
            {id}
          </span>
          <span className="font-mono text-[11px] text-white/55 truncate">{subject}</span>
          {won && (
            <span className="inline-flex items-center gap-1 text-[10px] font-mono text-accent shrink-0" title="winner">
              <CrownIcon /> {scaled ? "scaled" : "winner"}
            </span>
          )}
          {paused && (
            <span className="inline-flex items-center gap-1 text-[10px] font-mono text-white/40 shrink-0" title="paused">
              <PauseIcon /> paused
            </span>
          )}
        </div>
        <span className={`font-mono text-[12px] tabular-nums shrink-0 ${won ? "text-accent" : "text-white/70"}`}>
          {value.toFixed(1)}%
        </span>
      </div>
      <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{
            width: `${clamp01(pct / 100) * 100}%`,
            background: won
              ? "linear-gradient(90deg,#7cf5d0,#a4ffe1)"
              : "linear-gradient(90deg,rgba(124,245,208,0.5),rgba(124,245,208,0.32))",
            boxShadow: won && scaled ? "0 0 18px rgba(124,245,208,0.7)" : won ? "0 0 14px rgba(124,245,208,0.55)" : "none",
          }}
        />
      </div>
    </div>
  );
}

function PauseIcon() {
  return (
    <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <rect x="6" y="5" width="4" height="14" rx="1" />
      <rect x="14" y="5" width="4" height="14" rx="1" />
    </svg>
  );
}

function CrownIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M3 7l4 4 5-7 5 7 4-4-2 12H5L3 7z" />
    </svg>
  );
}

/* ───────────────────────── (b) deliverability gauge ───────────────────────── */

function Gauge({ value, appear }: { value: number; appear: number }) {
  const a = clamp01(appear);
  const R = 38;
  const C = 2 * Math.PI * R;
  // 270° arc (gap at bottom). frac of the 0.75 sweep filled.
  const sweep = 0.75;
  const frac = clamp01(value / 100);
  const dash = C * sweep;
  const offset = dash * (1 - frac);
  return (
    <div className="shrink-0 flex flex-col items-center" style={{ opacity: a }}>
      <div className="relative" style={{ width: 96, height: 96 }}>
        <svg width="96" height="96" viewBox="0 0 96 96" className="-rotate-[135deg]">
          <circle
            cx="48"
            cy="48"
            r={R}
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="7"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${C}`}
          />
          <circle
            cx="48"
            cy="48"
            r={R}
            fill="none"
            stroke="url(#gaugeGrad)"
            strokeWidth="7"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${C}`}
            strokeDashoffset={offset}
            style={{ filter: "drop-shadow(0 0 6px rgba(124,245,208,0.6))" }}
          />
          <defs>
            <linearGradient id="gaugeGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#7cf5d0" />
              <stop offset="100%" stopColor="#a4ffe1" />
            </linearGradient>
          </defs>
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display text-[24px] text-white leading-none tabular-nums">{value}%</span>
          <span className="text-[8px] font-mono uppercase tracking-[0.16em] text-white/40 mt-0.5">inbox</span>
        </div>
      </div>
      <span className="mt-1 text-[10px] font-mono uppercase tracking-[0.16em] text-accent/75">deliverability</span>
    </div>
  );
}

/* ───────────────────────── (b) health ring ───────────────────────── */

type Ring = { i: number; handle: string; appear: number; dips: boolean; paused: boolean };

function HealthRing({ ring, dt }: { ring: Ring; dt: number }) {
  const a = clamp01((dt - ring.appear) / T.ringDur);
  // fill amount of the ring (stroke) as it comes online
  const fill = easeOut(a);

  // dip → recover: a deterministic amber dip over a fixed window, then back to green
  let color = "#7cf5d0";
  let healthFrac = fill; // how "full" the ring reads
  if (ring.dips) {
    const dipStart = ring.appear + 1.2;
    const dipEnd = dipStart + 1.6;
    const w = seg(dt, dipStart, dipEnd); // 0→1 across the dip window
    const tri = 1 - Math.abs(w * 2 - 1); // triangle: peaks mid-window
    if (w > 0 && w < 1) {
      color = "#facc6b"; // amber
      healthFrac = fill * (1 - 0.45 * tri);
    }
  }
  if (ring.paused) {
    // transitions to a calm "rested" grey at pauseAt (beat 4) — not an alarm
    const p = clamp01((dt - T.pauseAt) / 0.6);
    color = p > 0 ? lerpColor("#facc6b", "#5b6472", p) : "#7cf5d0";
    if (dt >= T.pauseAt - 0.9 && dt < T.pauseAt) color = "#facc6b";
  }

  const R = 9;
  const C = 2 * Math.PI * R;
  const ringFrac = ring.paused && dt >= T.pauseAt ? 1 : healthFrac;
  const offset = C * (1 - clamp01(ringFrac));

  return (
    <div className="relative flex items-center justify-center" style={{ opacity: a > 0 ? 1 : 0 }} title={ring.handle}>
      <svg width="24" height="24" viewBox="0 0 24 24" className="-rotate-90">
        <circle cx="12" cy="12" r={R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="2.4" />
        <circle
          cx="12"
          cy="12"
          r={R}
          fill="none"
          stroke={color}
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={offset}
          style={{ filter: `drop-shadow(0 0 3px ${color}88)` }}
        />
      </svg>
      {ring.paused && dt >= T.pauseAt && (
        <svg width="9" height="9" viewBox="0 0 24 24" className="absolute" fill="#9aa3b2" aria-hidden>
          <rect x="6" y="5" width="4" height="14" rx="1" />
          <rect x="14" y="5" width="4" height="14" rx="1" />
        </svg>
      )}
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-white/35">
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}

/* ───────────────────────── (c) campaign card ───────────────────────── */

function CampaignCard({
  name,
  progress,
  appear,
  scaled,
  reduced,
}: {
  name: string;
  progress: number;
  appear: number;
  scaled: boolean;
  reduced?: boolean;
}) {
  const a = clamp01(appear);
  return (
    <div
      className={`rounded-xl border px-3 py-2.5 transition-colors ${
        scaled ? "bg-accent/[0.07] border-accent/35" : "bg-ink-800/70 border-white/10"
      }`}
      style={{
        opacity: a,
        transform: reduced ? undefined : `translateY(${(1 - easeOut(a)) * 12}px)`,
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="font-mono text-[11px] text-white/80 truncate">{name}</span>
        {scaled && (
          <span className="shrink-0 inline-flex items-center gap-1 text-[9px] font-mono text-accent">
            <ArrowUp /> scaled
          </span>
        )}
      </div>
      <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{
            width: `${clamp01(progress) * 100}%`,
            background: scaled
              ? "linear-gradient(90deg,#7cf5d0,#a4ffe1)"
              : "linear-gradient(90deg,#7c5cff,#9a82ff)",
          }}
        />
      </div>
      <div className="mt-1.5 flex items-center justify-between text-[9px] font-mono text-white/40 tabular-nums">
        <span>{Math.round(clamp01(progress) * 100)}% sent</span>
        <span className="inline-flex items-center gap-1 text-accent/80">
          <span className="w-1 h-1 rounded-full bg-accent animate-pulse" /> sending
        </span>
      </div>
    </div>
  );
}

function ArrowUp() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 19V5M5 12l7-7 7 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ───────────────────────── summary bar ───────────────────────── */

function SummaryBar({
  appear,
  winnerReply,
  deliver,
  campsLive,
  reduced,
}: {
  appear: number;
  winnerReply: number;
  deliver: number;
  campsLive: number;
  reduced?: boolean;
}) {
  const a = clamp01(appear);
  if (a <= 0) return null;
  return (
    <div
      className="absolute bottom-6 left-1/2 z-30 -translate-x-1/2 pointer-events-none"
      style={{
        opacity: a,
        transform: `translate(-50%, ${reduced ? 0 : (1 - easeOutBack(a)) * 16}px)`,
        // keep clear of the rail and the replay button
        left: "calc(min(34%, 440px) + (100% - min(34%, 440px)) / 2 - 40px)",
      }}
    >
      <div className="inline-flex items-center gap-3 rounded-full glass glow-accent px-5 py-2.5 shadow-[0_20px_60px_rgba(0,0,0,0.5)]">
        <span className="inline-flex items-center gap-1.5 text-[12px] font-mono text-accent">
          <CrownIcon /> Winner: Variant B
        </span>
        <Sep />
        <span className="text-[12px] font-mono text-white tabular-nums">{winnerReply.toFixed(1)}% replies</span>
        <Sep />
        <span className="text-[12px] font-mono text-white tabular-nums">Deliverability {deliver}%</span>
        <Sep />
        <span className="text-[12px] font-mono text-white tabular-nums">{campsLive} campaigns live</span>
      </div>
    </div>
  );
}

function Sep() {
  return <span className="w-1 h-1 rounded-full bg-white/25" />;
}

/* ───────────────────────── helpers ───────────────────────── */

// cubic bezier (1D) for the canvas connectors
function bez(p0: number, p1: number, p2: number, p3: number, t: number) {
  const u = 1 - t;
  return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
}

// hex color lerp (no random, pure)
function lerpColor(a: string, b: string, t: number) {
  const pa = hexToRgb(a);
  const pb = hexToRgb(b);
  const r = Math.round(lerp(pa[0], pb[0], t));
  const g = Math.round(lerp(pa[1], pb[1], t));
  const bl = Math.round(lerp(pa[2], pb[2], t));
  return `rgb(${r},${g},${bl})`;
}
function hexToRgb(h: string): [number, number, number] {
  const s = h.replace("#", "");
  return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
}
