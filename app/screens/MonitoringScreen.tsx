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
  clamp01,
  lerp,
  phase,
} from "../lab/engine/useScrubClock";
import { NarrationRail, type NarrationStep } from "../lab/engine/NarrationRail";

// ── beat timeline (seconds) ──
const T = {
  testsStart: 0.4,
  testStagger: 0.5,
  gaugeStart: 2.6,
  gaugeDur: 2.6,
  ringsStart: 4.0,
  ringStagger: 0.05,
  ringDur: 0.6,
  domainStart: 6.0,
  domainStagger: 0.18,
  campStart: 8.0,
  campStagger: 0.45,
  campBarDur: 3.0,
};
const DURATION = 12.0;
const BASE = 3.6; // ambient period (canvas glow + packets)

const N_RINGS = 21;
const DELIVERABILITY = 98;

// What we A/B test — the three real dimensions (not just "copy variants").
const TESTS = [
  { dim: "Subject lines", opts: ["quick question about {co}", "{co} — a 12-min idea"], winner: 1 },
  { dim: "CTAs", opts: ["worth a quick call?", "want a sample first?"], winner: 0 },
  { dim: "Offer angles", opts: ["save time", "make money", "save money"], winner: 1 },
];
const REPLY_RATE = 8.2;

type Campaign = { name: string; target: number; start: number };

export default function MonitoringScreen({ businessName, slug, deckHandleRef, onDone }: ScreenProps) {
  const reduce = !!useReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const sizeRef = useRef<{ w: number; h: number }>({ w: 0, h: 0 });
  const lastTRef = useRef(0);
  const pushedRef = useRef(-1);
  const [dt, setDt] = useState(0);

  const domainNames = useMemo(() => buildSendingDomains(slug), [slug]);
  const mailboxes = useMemo(() => buildMailboxes(domainNames, 3), [domainNames]);

  const rings = useMemo(() => {
    const dipIdx = new Set([4, 13]);
    const pausedIdx = 9;
    return Array.from({ length: N_RINGS }, (_, i) => ({
      i,
      handle: mailboxes[i]?.handle ?? `inbox-${i}`,
      appear: T.ringsStart + i * T.ringStagger,
      dips: dipIdx.has(i),
      paused: i === pausedIdx,
    }));
  }, [mailboxes]);

  // domain reputation (deterministic, all healthy)
  const domains = useMemo(
    () => domainNames.map((d, i) => ({ name: d, score: [98, 97, 99, 96, 98, 95, 97][i] ?? 97 })),
    [domainNames]
  );

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
      { n: "01", title: "We A/B test everything", detail: <p>Subject lines, CTAs and offer angles all run head-to-head — the versions that book the most replies win and scale.</p> },
      { n: "02", title: "Mailbox health is watched", detail: <p>Every mailbox&apos;s deliverability is monitored. If one dips, it&apos;s pulled and rested before it can drag down the rest.</p> },
      { n: "03", title: "Domains are watched too", detail: <p>Each sending domain&apos;s reputation and blacklist status is tracked continuously — a problem domain is caught early.</p> },
      { n: "04", title: "Always optimizing", detail: <p>Winners scale, weak inboxes rest, new campaigns launch — the system keeps <span className="text-white/80">{businessName}</span>&apos;s reply rate climbing, evergreen.</p> },
    ],
    [businessName]
  );

  const drawCanvas = useCallback((t: number) => {
    const ctx = ctxRef.current;
    const { w, h } = sizeRef.current;
    if (!ctx || !w || !h) return;
    ctx.clearRect(0, 0, w, h);
    const railW = Math.min(w * 0.34, 440);
    const panelX = railW + 16;
    const panelW = w - panelX - 24;

    const ax = panelX + panelW * 0.27;
    const bx = panelX + panelW * 0.76;
    const topY = h * 0.3;
    const cy = h * 0.8;
    const cxm = panelX + panelW * 0.5;

    const glow = (gx: number, gy: number, on: number, hex: string) => {
      if (on <= 0) return;
      const breathe = 1 + 0.06 * Math.sin((t / BASE) * Math.PI * 2);
      const r = 150 * breathe;
      const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, r);
      g.addColorStop(0, `${hex}${(0.09 * on).toFixed(3)})`);
      g.addColorStop(1, hex + "0)");
      ctx.fillStyle = g;
      ctx.fillRect(gx - r, gy - r, r * 2, r * 2);
    };
    glow(ax, topY, easeOut(seg(t, T.testsStart, T.gaugeStart)), "rgba(124,245,208,");
    glow(bx, topY, easeOut(seg(t, T.ringsStart, T.domainStart)), "rgba(124,245,208,");
    glow(cxm, cy, easeOut(seg(t, T.campStart, T.campStart + 1.2)), "rgba(124,92,255,");

    // connectors between regions: draw once, then flow packets forever (seamless)
    const link = (x1: number, y1: number, x2: number, y2: number, prog: number, color: string, pk: string, off: number) => {
      if (prog <= 0) return;
      const midx = (x1 + x2) / 2;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      const segs = 36;
      const last = Math.max(1, Math.floor(segs * clamp01(prog)));
      for (let s = 1; s <= last; s++) {
        const f = s / segs;
        ctx.lineTo(bez(x1, midx, midx, x2, f), bez(y1, y1, y2, y2, f));
      }
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.2;
      ctx.stroke();
      if (prog >= 1) {
        for (let p = 0; p < 2; p++) {
          const f = phase(t, BASE, off + p / 2);
          const fade = Math.sin(Math.PI * f);
          ctx.beginPath();
          ctx.arc(bez(x1, midx, midx, x2, f), bez(y1, y1, y2, y2, f), 1.9, 0, Math.PI * 2);
          ctx.fillStyle = pk.replace("A", (0.85 * fade).toFixed(3));
          ctx.fill();
        }
      }
    };
    link(ax, topY + 12, bx, topY + 12, easeOut(seg(t, T.ringsStart - 0.2, T.ringsStart + 0.8)), "rgba(124,245,208,0.16)", "rgba(164,255,225,A)", 0.0);
    link(bx, topY + 12, cxm, cy - 14, easeOut(seg(t, T.campStart - 0.2, T.campStart + 0.8)), "rgba(124,92,255,0.18)", "rgba(167,143,255,A)", 0.4);
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
  }, [drawCanvas]);

  const controls = useScrubClock(onFrame, { duration: DURATION, reduced: reduce, autoPlay: !deckHandleRef, onDone, loop: true });
  useDeckHandle(controls, deckHandleRef);

  const activeNarration = dt >= T.campStart ? 4 : dt >= T.domainStart ? 3 : dt >= T.ringsStart ? 2 : dt >= T.testsStart ? 1 : 0;
  const ringsLive = rings.filter((r) => dt >= r.appear).length;
  const deliverNow = Math.round(lerp(0, DELIVERABILITY, easeOut(seg(dt, T.gaugeStart, T.gaugeStart + T.gaugeDur))));
  const replyNow = lerp(0, REPLY_RATE, easeOut(seg(dt, T.testsStart + 0.5, T.testsStart + 3.0)));
  const campsLive = campaigns.filter((c) => dt >= c.start).length;

  return (
    <div ref={rootRef} className="relative h-full w-full overflow-hidden bg-ink-950">
      <div className="absolute inset-0 bg-grid-fine opacity-[0.16]" />
      <div className="absolute inset-0" style={{ background: "radial-gradient(70% 60% at 60% 45%, rgba(124,245,208,0.07), transparent 60%)" }} />
      <div className="noise" />
      <canvas ref={canvasRef} className="absolute inset-0" />

      <NarrationRail
        eyebrow={<><span className="dot" /> Step 06 · A/B testing &amp; monitoring</>}
        headline={<><span className="text-gradient">We watch</span><br /><span className="text-gradient-accent">and we tune.</span></>}
        steps={steps}
        activeCount={activeNarration}
        reduced={reduce}
      />

      {/* live "optimizing" pulse */}
      <div className="absolute top-9 right-9 z-30 flex items-center gap-2 chip">
        <span className="w-1.5 h-1.5 rounded-full bg-accent shadow-[0_0_10px_#7cf5d0] animate-pulse" />
        <span className="text-[12px] font-mono text-accent uppercase tracking-[0.14em]">optimizing · live</span>
      </div>

      {/* DASHBOARD (right ~66%) */}
      <div className="absolute inset-0 z-20 pointer-events-none">
        <div className="absolute top-0 bottom-0 right-0 flex flex-col gap-3 px-6 md:px-8 pt-[60px] pb-[74px]" style={{ left: "min(34%, 440px)" }}>
          {/* row 1: A/B testing + deliverability */}
          <div className="grid grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] gap-3.5" style={{ flex: "1.1 1 0%", minHeight: 0 }}>
            <RegionCard appear={seg(dt, T.testsStart, T.testsStart + 0.6)} reduced={reduce}>
              <RegionHead kicker="A/B testing" title="Subject lines · CTAs · offer angles" live={dt > T.testsStart + 1.6} />
              <div className="mt-3 space-y-2.5">
                {TESTS.map((test, i) => (
                  <TestRow key={test.dim} test={test} businessName={businessName} appear={clamp01(seg(dt, T.testsStart + 0.3 + i * T.testStagger, T.testsStart + 0.3 + i * T.testStagger + 0.5))} decided={dt > T.testsStart + 0.3 + i * T.testStagger + 0.9} />
                ))}
              </div>
              <div className="mt-3 pt-2.5 border-t border-white/8 flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase tracking-[0.16em] text-white/40">best reply rate</span>
                <span className="font-display text-[18px] text-accent tabular-nums">{replyNow.toFixed(1)}%</span>
              </div>
            </RegionCard>

            <RegionCard appear={seg(dt, T.gaugeStart - 0.2, T.gaugeStart + 0.4)} reduced={reduce}>
              <RegionHead kicker="Deliverability" title="Landing in the inbox" live={dt > T.gaugeStart + 0.5} />
              <div className="mt-2 flex items-center gap-4">
                <Gauge value={deliverNow} appear={seg(dt, T.gaugeStart - 0.2, T.gaugeStart + 0.4)} />
                <div className="flex-1 min-w-0">
                  <Heartbeat />
                  <div className="mt-2 text-[10px] font-mono text-white/40 leading-relaxed">Inbox placement, opens and spam-rate tracked in real time — an evergreen pulse on every send.</div>
                </div>
              </div>
            </RegionCard>
          </div>

          {/* row 2: mailbox health + domain reputation */}
          <RegionCard appear={seg(dt, T.ringsStart - 0.2, T.ringsStart + 0.4)} reduced={reduce} style={{ flex: "1 1 0%", minHeight: 0 }}>
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)] gap-5 h-full">
              <div className="min-w-0">
                <RegionHead kicker="Mailbox health" title="Every mailbox monitored" live={dt > T.ringsStart + 0.6} />
                <div className="mt-3 grid grid-cols-7 gap-x-2 gap-y-2">
                  {rings.map((r) => <HealthRing key={r.i} ring={r} dt={dt} />)}
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
              <div className="min-w-0 border-l border-white/8 pl-5">
                <RegionHead kicker="Domain monitoring" title="Reputation & blacklists" live={dt > T.domainStart + 0.6} />
                <div className="mt-3 space-y-1.5">
                  {domains.map((d, i) => (
                    <DomainRow key={d.name} name={d.name} score={d.score} appear={clamp01(seg(dt, T.domainStart + i * T.domainStagger, T.domainStart + i * T.domainStagger + 0.5))} />
                  ))}
                </div>
              </div>
            </div>
          </RegionCard>

          {/* row 3: parallel campaigns */}
          <RegionCard appear={seg(dt, T.campStart - 0.2, T.campStart + 0.4)} reduced={reduce} className="shrink-0">
            <div className="flex items-center justify-between">
              <RegionHead kicker="Parallel campaigns" title="The pipeline never goes cold" live={campsLive > 0} inline />
              <span className="inline-flex items-center gap-1.5 chip !py-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logos/instantly.png" alt="" width={13} height={13} style={{ width: 13, height: 13 }} className="object-contain" /> Instantly
              </span>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-3">
              {campaigns.map((c, idx) => {
                const prog = c.target * easeOut(seg(dt, c.start + 0.2, c.start + 0.2 + T.campBarDur));
                return <CampaignCard key={c.name} name={c.name} progress={prog} appear={clamp01(seg(dt, c.start, c.start + 0.5))} scaled={idx === 0 && dt >= T.campStart + 2} reduced={reduce} />;
              })}
            </div>
          </RegionCard>
        </div>
      </div>

      {!deckHandleRef && (
        <button onClick={() => controls.play()} className="absolute bottom-6 right-6 z-40 inline-flex items-center gap-2 rounded-full glass px-4 py-2.5 text-[11px] font-mono uppercase tracking-[0.18em] text-white/70 hover:text-accent transition cursor-pointer">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M3 12a9 9 0 1 0 3-6.7M3 4v4h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
          Replay
        </button>
      )}
    </div>
  );
}

/* ── EKG heartbeat — pure SVG/SMIL, loops forever independent of React ── */
const EKG = "M0,18 L34,18 L40,8 L46,30 L52,18 L88,18 L94,8 L100,30 L106,18 L140,18";
function Heartbeat() {
  return (
    <svg viewBox="0 0 140 36" className="w-full h-9" preserveAspectRatio="none" aria-hidden>
      <path d={EKG} fill="none" stroke="rgba(124,245,208,0.35)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle r="2.6" fill="#7cf5d0" style={{ filter: "drop-shadow(0 0 5px #7cf5d0)" }}>
        <animateMotion dur="2.4s" repeatCount="indefinite" path={EKG} />
      </circle>
    </svg>
  );
}

/* ── A/B test dimension row ── */
function TestRow({ test, businessName, appear, decided }: { test: { dim: string; opts: string[]; winner: number }; businessName: string; appear: number; decided: boolean }) {
  const a = clamp01(appear);
  return (
    <div style={{ opacity: a, transform: `translateX(${(1 - easeOut(a)) * 14}px)` }}>
      <div className="text-[10px] font-mono uppercase tracking-[0.14em] text-accent/70 mb-1">{test.dim}</div>
      <div className="flex flex-wrap gap-1.5">
        {test.opts.map((o, i) => {
          const won = decided && i === test.winner;
          return (
            <span
              key={i}
              className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10.5px] font-mono border transition-all ${won ? "bg-accent/15 border-accent/50 text-accent" : decided ? "bg-white/[0.02] border-white/8 text-white/35" : "bg-white/[0.04] border-white/12 text-white/65"}`}
            >
              {won && <CheckMini />}
              {o.replace("{co}", businessName)}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function DomainRow({ name, score, appear }: { name: string; score: number; appear: number }) {
  const a = clamp01(appear);
  return (
    <div className="flex items-center gap-2.5" style={{ opacity: a, transform: `translateX(${(1 - easeOut(a)) * 12}px)` }}>
      <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0 shadow-[0_0_6px_#7cf5d0]" />
      <span className="font-mono text-[10.5px] text-white/75 truncate flex-1 min-w-0">{name}</span>
      <div className="w-14 h-1.5 rounded-full bg-white/[0.07] overflow-hidden shrink-0">
        <div className="h-full rounded-full" style={{ width: `${score}%`, background: "linear-gradient(90deg,#7cf5d0,#a4ffe1)" }} />
      </div>
      <span className="font-mono text-[10px] text-accent tabular-nums shrink-0 w-6 text-right">{score}</span>
    </div>
  );
}

function RegionCard({ appear, reduced, className, style, children }: { appear: number; reduced?: boolean; className?: string; style?: React.CSSProperties; children: React.ReactNode }) {
  const a = clamp01(appear);
  return (
    <div className={`rounded-2xl glass p-4 md:p-5 shadow-[0_20px_60px_rgba(0,0,0,0.45)] pointer-events-auto ${className ?? ""}`} style={{ opacity: a, transform: reduced ? undefined : `translateY(${(1 - easeOut(a)) * 16}px)`, ...style }}>
      {children}
    </div>
  );
}

function RegionHead({ kicker, title, live, inline }: { kicker: string; title: string; live: boolean; inline?: boolean }) {
  return (
    <div className={inline ? "" : "flex items-center justify-between"}>
      <div>
        <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-accent/75">{kicker}</div>
        <div className="text-[13px] md:text-[14px] text-white font-medium leading-snug mt-0.5">{title}</div>
      </div>
      {!inline && (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/12 border border-accent/35 px-2 py-1 text-[9px] font-mono uppercase tracking-[0.14em] text-accent transition-opacity" style={{ opacity: live ? 1 : 0 }}>
          <span className="w-1 h-1 rounded-full bg-accent animate-pulse" /> live
        </span>
      )}
    </div>
  );
}

function Gauge({ value, appear }: { value: number; appear: number }) {
  const a = clamp01(appear);
  const R = 34;
  const C = 2 * Math.PI * R;
  const sweep = 0.75;
  const frac = clamp01(value / 100);
  const dash = C * sweep;
  const offset = dash * (1 - frac);
  return (
    <div className="shrink-0 flex flex-col items-center" style={{ opacity: a }}>
      <div className="relative" style={{ width: 88, height: 88 }}>
        <svg width="88" height="88" viewBox="0 0 96 96" className="-rotate-[135deg]">
          <circle cx="48" cy="48" r={R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="7" strokeLinecap="round" strokeDasharray={`${dash} ${C}`} />
          <circle cx="48" cy="48" r={R} fill="none" stroke="url(#gaugeGrad)" strokeWidth="7" strokeLinecap="round" strokeDasharray={`${dash} ${C}`} strokeDashoffset={offset} style={{ filter: "drop-shadow(0 0 6px rgba(124,245,208,0.6))" }} />
          <defs><linearGradient id="gaugeGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#7cf5d0" /><stop offset="100%" stopColor="#a4ffe1" /></linearGradient></defs>
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display text-[22px] text-white leading-none tabular-nums">{value}%</span>
          <span className="text-[8px] font-mono uppercase tracking-[0.16em] text-white/40 mt-0.5">inbox</span>
        </div>
      </div>
    </div>
  );
}

type Ring = { i: number; handle: string; appear: number; dips: boolean; paused: boolean };
function HealthRing({ ring, dt }: { ring: Ring; dt: number }) {
  const a = clamp01((dt - ring.appear) / T.ringDur);
  const fill = easeOut(a);
  let color = "#7cf5d0";
  let healthFrac = fill;
  if (ring.dips) {
    const dipStart = ring.appear + 1.2;
    const w = seg(dt, dipStart, dipStart + 1.6);
    const tri = 1 - Math.abs(w * 2 - 1);
    if (w > 0 && w < 1) {
      color = "#facc6b";
      healthFrac = fill * (1 - 0.45 * tri);
    }
  }
  const PAUSE_AT = T.domainStart + 0.5;
  if (ring.paused) {
    const p = clamp01((dt - PAUSE_AT) / 0.6);
    color = p > 0 ? lerpColor("#facc6b", "#5b6472", p) : "#7cf5d0";
    if (dt >= PAUSE_AT - 0.9 && dt < PAUSE_AT) color = "#facc6b";
  }
  const R = 9;
  const C = 2 * Math.PI * R;
  const ringFrac = ring.paused && dt >= PAUSE_AT ? 1 : healthFrac;
  const offset = C * (1 - clamp01(ringFrac));
  return (
    <div className="relative flex items-center justify-center" style={{ opacity: a > 0 ? 1 : 0 }} title={ring.handle}>
      <svg width="24" height="24" viewBox="0 0 24 24" className="-rotate-90">
        <circle cx="12" cy="12" r={R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="2.4" />
        <circle cx="12" cy="12" r={R} fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={offset} style={{ filter: `drop-shadow(0 0 3px ${color}88)` }} />
      </svg>
      {ring.paused && dt >= PAUSE_AT && (
        <svg width="9" height="9" viewBox="0 0 24 24" className="absolute" fill="#9aa3b2" aria-hidden>
          <rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" />
        </svg>
      )}
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return <span className="inline-flex items-center gap-1 text-white/35"><span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />{label}</span>;
}

function CampaignCard({ name, progress, appear, scaled, reduced }: { name: string; progress: number; appear: number; scaled: boolean; reduced?: boolean }) {
  const a = clamp01(appear);
  return (
    <div className={`rounded-xl border px-3 py-2.5 transition-colors ${scaled ? "bg-accent/[0.07] border-accent/35" : "bg-ink-800/70 border-white/10"}`} style={{ opacity: a, transform: reduced ? undefined : `translateY(${(1 - easeOut(a)) * 12}px)` }}>
      <div className="flex items-center justify-between mb-2">
        <span className="font-mono text-[11px] text-white/80 truncate">{name}</span>
        {scaled && <span className="shrink-0 inline-flex items-center gap-1 text-[9px] font-mono text-accent"><ArrowUp /> scaled</span>}
      </div>
      <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${clamp01(progress) * 100}%`, background: scaled ? "linear-gradient(90deg,#7cf5d0,#a4ffe1)" : "linear-gradient(90deg,#7c5cff,#9a82ff)" }} />
      </div>
      <div className="mt-1.5 flex items-center justify-between text-[9px] font-mono text-white/40 tabular-nums">
        <span>{Math.round(clamp01(progress) * 100)}% sent</span>
        <span className="inline-flex items-center gap-1 text-accent/80"><span className="w-1 h-1 rounded-full bg-accent animate-pulse" /> sending</span>
      </div>
    </div>
  );
}

function ArrowUp() {
  return <svg width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M12 19V5M5 12l7-7 7 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
function CheckMini() {
  return <svg width="8" height="8" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
function bez(p0: number, p1: number, p2: number, p3: number, t: number) {
  const u = 1 - t;
  return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
}
function lerpColor(a: string, b: string, t: number) {
  const pa = hexToRgb(a);
  const pb = hexToRgb(b);
  return `rgb(${Math.round(lerp(pa[0], pb[0], t))},${Math.round(lerp(pa[1], pb[1], t))},${Math.round(lerp(pa[2], pb[2], t))})`;
}
function hexToRgb(h: string): [number, number, number] {
  const s = h.replace("#", "");
  return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
}
