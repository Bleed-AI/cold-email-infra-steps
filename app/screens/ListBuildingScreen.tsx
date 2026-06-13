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
import { ProviderLogo, type Provider } from "../lab/engine/ProviderLogo";

// ── data (a representative slice of a real run) ──
const SOURCES = [
  { logo: "apollo", label: "Apollo" },
  { logo: "apify", label: "Apify" },
  { logo: "linkedin", label: "LinkedIn" },
  { logo: "googlemaps", label: "Google Maps" },
];
const COMPANIES = [
  { name: "Brightwave Labs", keep: true },
  { name: "NorthPeak SaaS", keep: true },
  { name: "Coastal Analytics", keep: false },
  { name: "Vertex Robotics", keep: true },
];
type Person = {
  co: number;
  initials: string;
  name: string;
  title: string;
  email: string;
  provider: Provider;
};
const PEOPLE: Person[] = [
  { co: 0, initials: "EF", name: "Emma Farrell", title: "Head of Growth", email: "emma@brightwavelabs.com", provider: "gmail" },
  { co: 0, initials: "DM", name: "Derek McNamara", title: "VP Sales", email: "derek.m@brightwavelabs.com", provider: "outlook" },
  { co: 1, initials: "PR", name: "Priya Rao", title: "Founder", email: "priya@northpeak.io", provider: "gmail" },
  { co: 1, initials: "SO", name: "Sam Okafor", title: "Head of Ops", email: "sam.okafor@northpeak.io", provider: "gmail" },
  { co: 3, initials: "LC", name: "Liam Chen", title: "CEO", email: "liam@vertexrobotics.com", provider: "outlook" },
  { co: 3, initials: "NP", name: "Nina Patel", title: "VP Eng", email: "nina.p@vertexrobotics.com", provider: "gmail" },
];
const ENRICH_TOOLS = [
  { logo: "clay", label: "Clay" },
  { logo: "parallel", label: "parallel.ai" },
  { logo: "serper", label: "Serper" },
];
const COUNTS = { sourced: 1240, qualified: 680, dms: 1700, emails: 1510 };

// ── beat timeline (seconds) ──
const T = {
  srcStart: 0.3,
  srcStagger: 0.22,
  coStart: 2.3,
  coStagger: 0.22,
  qualifyAt: 3.7, // when keep/drop is decided
  enrichStart: 4.8,
  enrichDur: 1.8,
  peopleStart: 7.0,
  peopleStagger: 0.24,
  emailStart: 9.4,
  emailStagger: 0.24,
};
const DURATION = 13.0;
const FLOW_PERIOD = 3.6; // ambient particle period (shared → seamless)

type Pt = { x: number; y: number };
type Layout = {
  w: number;
  h: number;
  sources: Pt[];
  funnel: Pt;
  companies: Pt[];
  enrich: Pt;
  people: Pt[];
  emails: Pt[];
};

const keptIndex = (co: number) => COMPANIES.slice(0, co).filter((c) => c.keep).length;

export default function ListBuildingScreen({ businessName, deckHandleRef, onDone }: ScreenProps) {
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
      { n: "01", title: "Source from everywhere", detail: <p>We pull candidate companies from Apollo, Apify, LinkedIn, Google Maps and niche directories — far wider coverage than any single tool.</p> },
      { n: "02", title: "Qualify the companies", detail: <p>We keep only right-fit companies for {businessName} — correct size, industry and signals — and drop the rest before spending a cent enriching them.</p> },
      { n: "03", title: "Enrich every one", detail: <p>We scrape each company&apos;s website and socials (via Clay, parallel.ai and Serper) for the signals that make an email feel one-to-one.</p> },
      { n: "04", title: "Find the decision-makers", detail: <p>2–3 real decision-makers per company — the people who can actually say yes — with their title and role.</p> },
      { n: "05", title: "Find their emails", detail: <p>A verified waterfall — Prospeo first, then three backup methods — finds and validates each email, so bounce rates stay near zero.</p> },
    ],
    [businessName]
  );

  const computeLayout = useCallback(() => {
    const root = rootRef.current;
    if (!root) return;
    const w = root.clientWidth;
    const h = root.clientHeight;
    const sources: Pt[] = SOURCES.map((_, i) => ({ x: w * 0.355, y: lerp(h * 0.32, h * 0.7, i / (SOURCES.length - 1)) }));
    const funnel: Pt = { x: w * 0.435, y: h * 0.51 };
    const companies: Pt[] = COMPANIES.map((_, i) => ({ x: w * 0.5, y: lerp(h * 0.27, h * 0.8, i / (COMPANIES.length - 1)) }));
    const enrich: Pt = { x: w * 0.6, y: h * 0.51 };
    // 2 people per kept company, fanned around the company's y
    const people: Pt[] = PEOPLE.map((p) => {
      const co = companies[p.co];
      const within = PEOPLE.filter((q) => q.co === p.co).indexOf(p); // 0 or 1
      return { x: w * 0.7, y: co.y + (within === 0 ? -h * 0.058 : h * 0.058) };
    });
    const emails: Pt[] = people.map((pt) => ({ x: w * 0.835, y: pt.y }));
    layoutRef.current = { w, h, sources, funnel, companies, enrich, people, emails };
  }, []);

  // ── canvas: funnel + lanes, connectors draw once, packets loop forever ──
  const drawCanvas = useCallback((t: number) => {
    const ctx = ctxRef.current;
    const L = layoutRef.current;
    if (!ctx || !L) return;
    const { w, h, sources, funnel, companies, enrich, people, emails } = L;
    ctx.clearRect(0, 0, w, h);

    const flow = (a: Pt, c1: Pt, c2: Pt, b: Pt, grow: number, color: string, pkColor: string, offset: number, n = 3, connected = false) => {
      if (grow <= 0) return;
      // partial connector (draws in during build, holds after)
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      const segs = 36;
      const upTo = Math.max(1, Math.floor(segs * grow));
      for (let q = 1; q <= upTo; q++) {
        const f = q / segs;
        ctx.lineTo(bz(a.x, c1.x, c2.x, b.x, f), bz(a.y, c1.y, c2.y, b.y, f));
      }
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.3;
      ctx.stroke();
      // packets flow once the connector is built (ambient loop, seamless)
      if (connected) {
        for (let p = 0; p < n; p++) {
          const f = phase(t, FLOW_PERIOD, offset + p / n);
          const fade = Math.sin(Math.PI * f);
          const x = bz(a.x, c1.x, c2.x, b.x, f);
          const y = bz(a.y, c1.y, c2.y, b.y, f);
          ctx.beginPath();
          ctx.arc(x, y, 1.9, 0, Math.PI * 2);
          ctx.fillStyle = pkColor.replace("ALPHA", (0.9 * fade).toFixed(3));
          ctx.fill();
        }
      }
    };

    // sources → funnel
    sources.forEach((s, i) => {
      const grow = easeOut(seg(t, T.srcStart + i * T.srcStagger + 0.3, T.srcStart + i * T.srcStagger + 1.0));
      const c1 = { x: lerp(s.x, funnel.x, 0.5), y: s.y };
      const c2 = { x: lerp(s.x, funnel.x, 0.5), y: funnel.y };
      flow(s, c1, c2, funnel, grow, "rgba(124,245,208,0.22)", "rgba(164,255,225,ALPHA)", i * 0.17, 2, grow >= 1);
    });

    // funnel → companies
    companies.forEach((c, i) => {
      const grow = easeOut(seg(t, T.coStart + i * T.coStagger, T.coStart + i * T.coStagger + 0.7));
      const dropped = !COMPANIES[i].keep && t > T.qualifyAt + 0.4;
      const c1 = { x: lerp(funnel.x, c.x, 0.5), y: funnel.y };
      const c2 = { x: lerp(funnel.x, c.x, 0.5), y: c.y };
      const col = dropped ? "rgba(255,255,255,0.06)" : "rgba(124,245,208,0.22)";
      flow(funnel, c1, c2, c, grow, col, "rgba(164,255,225,ALPHA)", 0.4 + i * 0.13, 2, grow >= 1 && !dropped);
    });

    // company → (enrich) → people, then person → email
    people.forEach((pt, i) => {
      const p = PEOPLE[i];
      const co = companies[p.co];
      const a0 = T.peopleStart + i * T.peopleStagger;
      const grow = easeOut(seg(t, a0, a0 + 0.7));
      // route the lane through the enrich hub (x≈enrich.x) so flow "passes through" it
      const midx = enrich.x;
      const c1 = { x: midx, y: co.y };
      const c2 = { x: midx, y: pt.y };
      flow(co, c1, c2, pt, grow, "rgba(124,245,208,0.2)", "rgba(164,255,225,ALPHA)", i * 0.12, 2, grow >= 1);

      // person → email
      const e = emails[i];
      const a1 = T.emailStart + i * T.emailStagger;
      const eg = easeOut(seg(t, a1, a1 + 0.6));
      const ec1 = { x: lerp(pt.x, e.x, 0.5), y: pt.y };
      const ec2 = { x: lerp(pt.x, e.x, 0.5), y: e.y };
      flow(pt, ec1, ec2, e, eg, "rgba(124,92,255,0.3)", "rgba(167,143,255,ALPHA)", 0.5 + i * 0.1, 2, eg >= 1);
    });

    // enrich hub soft glow (gentle seamless breathe, period == FLOW_PERIOD)
    const ev = easeOut(seg(t, T.enrichStart, T.enrichStart + 0.8));
    if (ev > 0) {
      const breathe = 1 + 0.08 * Math.sin((t / FLOW_PERIOD) * Math.PI * 2);
      const r = 60 * breathe;
      const g = ctx.createRadialGradient(enrich.x, enrich.y, 0, enrich.x, enrich.y, r);
      g.addColorStop(0, `rgba(124,245,208,${0.1 * ev})`);
      g.addColorStop(1, "rgba(124,245,208,0)");
      ctx.fillStyle = g;
      ctx.fillRect(enrich.x - r, enrich.y - r, r * 2, r * 2);
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

  const controls = useScrubClock(onFrame, { duration: DURATION, reduced: reduce, autoPlay: !deckHandleRef, onDone, loop: true });
  useDeckHandle(controls, deckHandleRef);

  // ── derived overlay state ──
  const activeNarration = dt < T.coStart ? 1 : dt < T.enrichStart ? 2 : dt < T.peopleStart ? 3 : dt < T.emailStart ? 4 : 5;
  const cnt = (target: number, start: number, dur = 2.4) => Math.round(target * easeOut(clamp01((dt - start) / dur)));
  const sourced = cnt(COUNTS.sourced, T.srcStart + 0.2);
  const qualified = cnt(COUNTS.qualified, T.coStart);
  const dmsCount = cnt(COUNTS.dms, T.peopleStart);
  const emailsCount = cnt(COUNTS.emails, T.emailStart);

  const L = layoutRef.current;
  const px = (v: number, total: number) => `${(v / total) * 100}%`;

  return (
    <div ref={rootRef} className="relative h-full w-full overflow-hidden bg-ink-950">
      <div className="absolute inset-0 bg-grid-fine opacity-[0.16]" />
      <div className="absolute inset-0" style={{ background: "radial-gradient(70% 70% at 62% 50%, rgba(124,245,208,0.06), transparent 60%)" }} />
      <div className="noise" />
      <canvas ref={canvasRef} className="absolute inset-0" />

      <NarrationRail
        eyebrow={<><span className="dot" /> Step 03 · Building the list</>}
        headline={<><span className="text-gradient">We find</span><br /><span className="text-gradient-accent">{businessName}&apos;s buyers.</span></>}
        steps={steps}
        activeCount={activeNarration}
        reduced={reduce}
      />

      {L && (
        <>
          {/* stage header labels with animated counts */}
          <Callout x={px(L.sources[0].x, L.w)} y={px(L.h * 0.16, L.h)} anchor="center" tone="accent" label="Sources" value={sourced.toLocaleString()} appear={seg(dt, T.srcStart, T.srcStart + 0.8)} reduced={reduce} />
          <Callout x={px(L.companies[0].x, L.w)} y={px(L.h * 0.16, L.h)} anchor="center" tone="accent" label="Qualified" value={qualified.toLocaleString()} appear={seg(dt, T.coStart, T.coStart + 0.8)} reduced={reduce} />
          <Callout x={px(L.people[0].x, L.w)} y={px(L.h * 0.16, L.h)} anchor="center" tone="accent" label="Decision-makers" value={dmsCount.toLocaleString()} appear={seg(dt, T.peopleStart, T.peopleStart + 0.8)} reduced={reduce} />
          <Callout x={px(L.emails[0].x, L.w)} y={px(L.h * 0.16, L.h)} anchor="center" tone="violet" label="Verified emails" value={emailsCount.toLocaleString()} appear={seg(dt, T.emailStart, T.emailStart + 0.8)} reduced={reduce} />

          {/* SOURCES */}
          {SOURCES.map((s, i) => {
            const a = clamp01((dt - (T.srcStart + i * T.srcStagger)) / 0.45);
            if (a <= 0) return null;
            return (
              <NodeAt key={s.label} x={px(L.sources[i].x, L.w)} y={px(L.sources[i].y, L.h)} appear={a} reduced={reduce}>
                <div className="inline-flex items-center gap-2 rounded-lg bg-ink-900/80 border border-white/10 pl-1.5 pr-2.5 py-1.5 backdrop-blur-sm">
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-white shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/logos/${s.logo}.png`} alt="" width={15} height={15} style={{ width: 15, height: 15 }} className="object-contain" />
                  </span>
                  <span className="text-[11.5px] text-white/90 whitespace-nowrap">{s.label}</span>
                </div>
              </NodeAt>
            );
          })}

          {/* COMPANIES (qualify) */}
          {COMPANIES.map((c, i) => {
            const a = clamp01((dt - (T.coStart + i * T.coStagger)) / 0.45);
            if (a <= 0) return null;
            const decided = dt > T.qualifyAt;
            const dropped = !c.keep && decided;
            return (
              <NodeAt key={c.name} x={px(L.companies[i].x, L.w)} y={px(L.companies[i].y, L.h)} appear={a} reduced={reduce}>
                <div
                  className="inline-flex items-center gap-2 rounded-lg bg-ink-900/85 border px-2.5 py-1.5 backdrop-blur-sm transition-all duration-500"
                  style={{ opacity: dropped ? 0.4 : 1, borderColor: dropped ? "rgba(255,255,255,0.1)" : "rgba(124,245,208,0.3)" }}
                >
                  <span className="font-mono text-[11.5px] text-white whitespace-nowrap">{c.name}</span>
                  {decided && (
                    c.keep ? (
                      <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-accent/18 border border-accent/55">
                        <svg width="9" height="9" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="#7cf5d0" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>
                      </span>
                    ) : (
                      <span className="text-[10px] font-mono text-white/40">dropped</span>
                    )
                  )}
                </div>
              </NodeAt>
            );
          })}

          {/* ENRICH hub: tools + inline label (the connectors pass through here) */}
          {(() => {
            const a = clamp01((dt - T.enrichStart) / 0.6);
            if (a <= 0) return null;
            return (
              <>
                <NodeAt x={px(L.enrich.x, L.w)} y={px(L.enrich.y, L.h)} appear={a} reduced={reduce}>
                  <div className="flex items-center gap-1.5 rounded-full bg-ink-900/85 border border-white/12 px-2 py-1.5 backdrop-blur-sm">
                    {ENRICH_TOOLS.map((e) => (
                      <span key={e.label} className="inline-flex items-center justify-center w-5 h-5 rounded-md bg-white shrink-0" title={e.label}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={`/logos/${e.logo}.png`} alt={e.label} width={12} height={12} style={{ width: 12, height: 12 }} className="object-contain" />
                      </span>
                    ))}
                  </div>
                </NodeAt>
                <Callout
                  x={px(L.enrich.x, L.w)}
                  y={px(L.enrich.y - L.h * 0.13, L.h)}
                  anchor="center"
                  tone="accent"
                  label="Enrich"
                  sub="site · socials · funding · tech"
                  appear={seg(dt, T.enrichStart + 0.2, T.enrichStart + 1.0)}
                  stem={{ dir: "down", len: 22 }}
                  reduced={reduce}
                />
              </>
            );
          })()}

          {/* DECISION-MAKERS */}
          {PEOPLE.map((p, i) => {
            const a = clamp01((dt - (T.peopleStart + i * T.peopleStagger)) / 0.5);
            if (a <= 0) return null;
            return (
              <div
                key={p.name}
                className="absolute z-20"
                style={{ left: px(L.people[i].x, L.w), top: px(L.people[i].y, L.h), transform: "translate(0,-50%)", opacity: a }}
              >
                <div className="inline-flex items-center gap-2 rounded-lg bg-ink-800/90 border border-white/10 pl-1.5 pr-2.5 py-1 backdrop-blur-sm shadow-[0_4px_14px_rgba(0,0,0,0.4)]" style={{ transform: reduce ? "none" : `translateX(${(1 - easeOutBack(a)) * -14}px)` }}>
                  <span className="w-6 h-6 rounded-full flex items-center justify-center text-[9.5px] font-mono text-ink-950 shrink-0" style={{ background: "linear-gradient(135deg,#7cf5d0,#7c5cff)" }}>{p.initials}</span>
                  <span className="flex flex-col leading-tight">
                    <span className="text-[11.5px] text-white whitespace-nowrap">{p.name}</span>
                    <span className="text-[9.5px] text-white/45 whitespace-nowrap">{p.title}</span>
                  </span>
                </div>
              </div>
            );
          })}

          {/* VERIFIED EMAILS */}
          {PEOPLE.map((p, i) => {
            const a = clamp01((dt - (T.emailStart + i * T.emailStagger)) / 0.5);
            if (a <= 0) return null;
            return (
              <div
                key={p.email}
                className="absolute z-20"
                style={{ left: px(L.emails[i].x, L.w), top: px(L.emails[i].y, L.h), transform: "translate(0,-50%)", opacity: a }}
              >
                <div className="inline-flex items-center gap-1.5 rounded-md bg-ink-800/90 border border-white/10 pl-1 pr-2 py-1 backdrop-blur-sm shadow-[0_4px_14px_rgba(0,0,0,0.4)]" style={{ transform: reduce ? "none" : `translateX(${(1 - easeOutBack(a)) * -14}px)` }}>
                  <ProviderLogo provider={p.provider} size={16} />
                  <span className="font-mono text-[10px] text-white/90 leading-none whitespace-nowrap">{p.email}</span>
                  <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-accent/18 border border-accent/55 shrink-0">
                    <svg width="8" height="8" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="#7cf5d0" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </span>
                </div>
              </div>
            );
          })}

          {/* waterfall label on the email stage */}
          <Callout
            x={px(L.emails[0].x, L.w)}
            y={px(L.h * 0.9, L.h)}
            anchor="center"
            tone="violet"
            label="Prospeo + 3 backups"
            sub="verified waterfall · pay-on-success"
            appear={seg(dt, T.emailStart + 0.2, T.emailStart + 1.0)}
            reduced={reduce}
            className="[&_*]:!normal-case"
          />
        </>
      )}

      {!deckHandleRef && (
        <button onClick={() => controls.play()} className="absolute bottom-6 right-6 z-40 inline-flex items-center gap-2 rounded-full glass px-4 py-2.5 text-[11px] font-mono uppercase tracking-[0.18em] text-white/70 hover:text-accent transition cursor-pointer">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M3 12a9 9 0 1 0 3-6.7M3 4v4h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
          Replay
        </button>
      )}
    </div>
  );
}

function NodeAt({ x, y, appear, reduced, children }: { x: string; y: string; appear: number; reduced?: boolean; children: React.ReactNode }) {
  const a = clamp01(appear);
  return (
    <div className="absolute z-20" style={{ left: x, top: y, transform: `translate(-50%,-50%) scale(${reduced ? 1 : lerp(0.8, 1, a)})`, opacity: a, pointerEvents: a > 0.5 ? "auto" : "none" }}>
      {children}
    </div>
  );
}

function bz(p0: number, p1: number, p2: number, p3: number, t: number) {
  const u = 1 - t;
  return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
}
