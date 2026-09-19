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

// ── the real pipeline (grounded in bleedai-campaign-master/knowledge-base) ──
// SOURCES: a vast fan-out — data providers + SERP + an Apify scraper cluster +
// communities + niche directories. (logo:null → rendered as a named chip.)
type Tool = { logo: string | null; label: string; note?: string; verify?: boolean };
const SOURCES: Tool[] = [
  { logo: "prospeo", label: "Prospeo" },
  { logo: "apollo", label: "Apollo" },
  { logo: "linkedin", label: "Sales Nav" },
  { logo: "serper", label: "Serper" },
  { logo: "googlemaps", label: "Google Maps" },
  { logo: "apify", label: "Apify actors" },
  { logo: "openwebninja", label: "OpenWebNinja" },
  { logo: null, label: "Crunchbase" },
  { logo: null, label: "Product Hunt" },
  { logo: null, label: "Store Leads" },
  { logo: null, label: "Reddit" },
  { logo: null, label: "GitHub" },
];
const COMPANIES = [
  { name: "Brightwave Labs", keep: true },
  { name: "NorthPeak SaaS", keep: true },
  { name: "Coastal Analytics", keep: false },
  { name: "Vertex Robotics", keep: true },
];
// Enrichment stack — Clay routes providers; Prospeo FIRMO returns 35 fields in
// one call; smart-scrape (Serper→parallel.ai) reads the site; OpenAI writes vars.
const ENRICH_TOOLS: Tool[] = [
  { logo: "clay", label: "Clay" },
  { logo: "prospeo", label: "FIRMO" },
  { logo: "serper", label: "Serper" },
  { logo: "parallel", label: "parallel.ai" },
  { logo: "openwebninja", label: "OpenWebNinja" },
  { logo: "openai", label: "OpenAI" },
];
// Decision-maker finder — Prospeo first; on a miss, a sequential backup chain
// (Surfe → MixRank → OpenMart), first hit wins.
const DM_WATERFALL: Tool[] = [
  { logo: "prospeo", label: "Prospeo", note: "primary" },
  { logo: null, label: "Surfe" },
  { logo: null, label: "MixRank" },
  { logo: null, label: "OpenMart" },
];
// Email-finder waterfall — four finders in order, then a strict verify pass.
const EMAIL_WATERFALL: Tool[] = [
  { logo: "trykit", label: "Kitt" },
  { logo: "leadmagic", label: "LeadMagic" },
  { logo: "prospeo", label: "Prospeo" },
  { logo: "findymail", label: "Findymail" },
  { logo: "trykit", label: "TryKit verify", verify: true },
];

type Person = { initials: string; name: string; title: string; email: string; provider: Provider };
const CONTACTS: Person[] = [
  { initials: "EF", name: "Emma Farrell", title: "Head of Growth", email: "emma@brightwavelabs.com", provider: "gmail" },
  { initials: "PR", name: "Priya Rao", title: "Founder", email: "priya@northpeak.io", provider: "gmail" },
  { initials: "LC", name: "Liam Chen", title: "CEO", email: "liam@vertexrobotics.com", provider: "outlook" },
  { initials: "DM", name: "Derek McNamara", title: "VP Sales", email: "derek.m@brightwavelabs.com", provider: "outlook" },
  { initials: "NP", name: "Nina Patel", title: "VP Eng", email: "nina.p@vertexrobotics.com", provider: "gmail" },
];
const COUNTS = { sourced: 1240, qualified: 680, dms: 1700, emails: 1510 };

// ── beat timeline (seconds) ──
const T = {
  srcStart: 0.3,
  srcStagger: 0.12,
  coStart: 2.4,
  coStagger: 0.2,
  qualifyAt: 3.9,
  enrichStart: 4.7,
  dmStart: 5.8,
  dmTrialDur: 0.7,     // per-tool trial time (search → reveal)
  emailStart: 8.4,
  emailTrialDur: 0.55, // per-tool trial time
  contactStart: 12.2,
  contactStagger: 0.22,
};
// Which tool in each waterfall actually hits (rest before miss, rest after stay idle).
// Show the cascade concept clearly: try, miss, try, miss, HIT.
const DM_HIT_INDEX = 2;      // Prospeo miss → Surfe miss → MixRank HIT (OpenMart idle)
const EMAIL_HIT_INDEX = 3;   // Kitt miss → LeadMagic miss → Prospeo miss → Findymail HIT → TryKit verifies
const DURATION = 15.0;
const FLOW_PERIOD = 3.6; // ambient particle period (shared → seamless)

type Pt = { x: number; y: number };
type Layout = {
  w: number;
  h: number;
  sources: Pt[];
  funnel: Pt;
  companies: Pt[];
  enrich: Pt;
  dmHub: Pt;
  emailHub: Pt;
  contacts: Pt[];
};

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
      { n: "01", title: "Source from a vast network", detail: <p>Candidate companies pour in from 12+ channels at once — Prospeo, Apollo, Sales Navigator, an Apify scraper cluster (Maps, jobs, Shopify, Product Hunt…), Serper, communities and niche directories. Far wider than any one tool.</p> },
      { n: "02", title: "Qualify before we spend", detail: <p>We keep only right-fit companies for {businessName} — size, industry and buying signals — and drop the rest before paying to enrich a single one.</p> },
      { n: "03", title: "Enrich every keeper", detail: <p>Clay routes 100+ providers, Prospeo FIRMO returns 35 firmographic fields in one call, and a smart-scrape cascade (Serper → parallel.ai) reads each site. OpenAI turns it into per-lead variables.</p> },
      { n: "04", title: "Decision-makers, multiple methods", detail: <p>2–3 real buyers per company. Prospeo finds most in-house; on a miss a backup chain fires — <span className="text-white/80">Surfe → MixRank → OpenMart</span> — first hit wins.</p> },
      { n: "05", title: "Emails, LinkedIn & phone — verified", detail: <p>Each email runs a finder waterfall — <span className="text-white/80">Kitt → LeadMagic → Prospeo → Findymail</span> — then a strict <span className="text-white/80">TryKit</span> verify. We capture the <span className="text-white/80">LinkedIn profile and direct / mobile number</span> too, so the same buyer can be reached on every channel. Bounce rates stay near zero.</p> },
    ],
    [businessName]
  );

  const computeLayout = useCallback(() => {
    const root = rootRef.current;
    if (!root) return;
    const w = root.clientWidth;
    const h = root.clientHeight;
    const sources: Pt[] = SOURCES.map((_, i) => ({ x: w * 0.405, y: lerp(h * 0.13, h * 0.91, i / (SOURCES.length - 1)) }));
    const funnel: Pt = { x: w * 0.472, y: h * 0.52 };
    const companies: Pt[] = COMPANIES.map((_, i) => ({ x: w * 0.55, y: lerp(h * 0.31, h * 0.73, i / (COMPANIES.length - 1)) }));
    const enrich: Pt = { x: w * 0.55, y: h * 0.135 };
    const dmHub: Pt = { x: w * 0.648, y: h * 0.52 };
    const emailHub: Pt = { x: w * 0.748, y: h * 0.52 };
    const contacts: Pt[] = CONTACTS.map((_, i) => ({ x: w * 0.85, y: lerp(h * 0.2, h * 0.84, i / (CONTACTS.length - 1)) }));
    layoutRef.current = { w, h, sources, funnel, companies, enrich, dmHub, emailHub, contacts };
  }, []);

  // ── canvas: funnel + lanes; connectors draw once, packets loop forever ──
  const drawCanvas = useCallback((t: number) => {
    const ctx = ctxRef.current;
    const L = layoutRef.current;
    if (!ctx || !L) return;
    const { w, h, sources, funnel, companies, dmHub, emailHub, contacts } = L;
    ctx.clearRect(0, 0, w, h);

    const flow = (a: Pt, c1: Pt, c2: Pt, b: Pt, grow: number, color: string, pkColor: string, offset: number, n = 3, connected = false) => {
      if (grow <= 0) return;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      const segs = 36;
      const upTo = Math.max(1, Math.floor(segs * grow));
      for (let q = 1; q <= upTo; q++) {
        const f = q / segs;
        ctx.lineTo(bz(a.x, c1.x, c2.x, b.x, f), bz(a.y, c1.y, c2.y, b.y, f));
      }
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.2;
      ctx.stroke();
      if (connected) {
        for (let p = 0; p < n; p++) {
          const f = phase(t, FLOW_PERIOD, offset + p / n);
          const fade = Math.sin(Math.PI * f);
          const x = bz(a.x, c1.x, c2.x, b.x, f);
          const y = bz(a.y, c1.y, c2.y, b.y, f);
          ctx.beginPath();
          ctx.arc(x, y, 1.8, 0, Math.PI * 2);
          ctx.fillStyle = pkColor.replace("ALPHA", (0.9 * fade).toFixed(3));
          ctx.fill();
        }
      }
    };

    // sources → funnel (12 converging lines = a vast intake)
    sources.forEach((s, i) => {
      const grow = easeOut(seg(t, T.srcStart + i * T.srcStagger + 0.25, T.srcStart + i * T.srcStagger + 0.95));
      const c1 = { x: lerp(s.x, funnel.x, 0.55), y: s.y };
      const c2 = { x: lerp(s.x, funnel.x, 0.45), y: funnel.y };
      flow(s, c1, c2, funnel, grow, "rgba(255,90,77,0.2)", "rgba(255,150,135,ALPHA)", i * 0.09, 1, grow >= 1);
    });

    // funnel → companies (qualify keep/drop)
    companies.forEach((c, i) => {
      const grow = easeOut(seg(t, T.coStart + i * T.coStagger, T.coStart + i * T.coStagger + 0.7));
      const dropped = !COMPANIES[i].keep && t > T.qualifyAt + 0.4;
      const c1 = { x: lerp(funnel.x, c.x, 0.5), y: funnel.y };
      const c2 = { x: lerp(funnel.x, c.x, 0.5), y: c.y };
      const col = dropped ? "rgba(255,255,255,0.05)" : "rgba(255,90,77,0.22)";
      flow(funnel, c1, c2, c, grow, col, "rgba(255,150,135,ALPHA)", 0.4 + i * 0.13, 2, grow >= 1 && !dropped);
    });

    // kept companies → DM finder hub
    companies.forEach((c, i) => {
      if (!COMPANIES[i].keep) return;
      const a0 = T.dmStart + i * 0.12;
      const grow = easeOut(seg(t, a0, a0 + 0.7));
      const c1 = { x: lerp(c.x, dmHub.x, 0.5), y: c.y };
      const c2 = { x: lerp(c.x, dmHub.x, 0.5), y: dmHub.y };
      flow(c, c1, c2, dmHub, grow, "rgba(255,90,77,0.2)", "rgba(255,150,135,ALPHA)", 0.2 + i * 0.15, 2, grow >= 1);
    });

    // DM hub → email hub (the contact passes from "who" to "their email")
    {
      const grow = easeOut(seg(t, T.emailStart, T.emailStart + 0.7));
      const c1 = { x: lerp(dmHub.x, emailHub.x, 0.5), y: dmHub.y - 18 };
      const c2 = { x: lerp(dmHub.x, emailHub.x, 0.5), y: emailHub.y - 18 };
      flow(dmHub, c1, c2, emailHub, grow, "rgba(124,92,255,0.28)", "rgba(167,143,255,ALPHA)", 0.0, 2, grow >= 1);
    }

    // email hub → verified contacts (fan out)
    contacts.forEach((pt, i) => {
      const a0 = T.contactStart + i * T.contactStagger;
      const grow = easeOut(seg(t, a0, a0 + 0.6));
      const c1 = { x: lerp(emailHub.x, pt.x, 0.5), y: emailHub.y };
      const c2 = { x: lerp(emailHub.x, pt.x, 0.5), y: pt.y };
      flow(emailHub, c1, c2, pt, grow, "rgba(124,92,255,0.26)", "rgba(167,143,255,ALPHA)", 0.5 + i * 0.1, 2, grow >= 1);
    });

    // hub glows (seamless breathe, period == FLOW_PERIOD)
    const breathe = 1 + 0.08 * Math.sin((t / FLOW_PERIOD) * Math.PI * 2);
    const hubGlow = (p: Pt, ev: number, rgb: string) => {
      if (ev <= 0) return;
      const r = 52 * breathe;
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
      g.addColorStop(0, `rgba(${rgb},${0.1 * ev})`);
      g.addColorStop(1, `rgba(${rgb},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(p.x - r, p.y - r, r * 2, r * 2);
    };
    hubGlow(dmHub, easeOut(seg(t, T.dmStart, T.dmStart + 0.8)), "255,90,77");
    hubGlow(emailHub, easeOut(seg(t, T.emailStart, T.emailStart + 0.8)), "124,92,255");
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
  const activeNarration = dt < T.coStart ? 1 : dt < T.enrichStart ? 2 : dt < T.dmStart ? 3 : dt < T.emailStart ? 4 : 5;
  const cnt = (target: number, start: number, dur = 2.4) => Math.round(target * easeOut(clamp01((dt - start) / dur)));
  const sourced = cnt(COUNTS.sourced, T.srcStart + 0.2);
  const qualified = cnt(COUNTS.qualified, T.coStart);
  const dmsCount = cnt(COUNTS.dms, T.dmStart);
  const emailsCount = cnt(COUNTS.emails, T.contactStart);

  const L = layoutRef.current;
  const px = (v: number, total: number) => `${(v / total) * 100}%`;

  return (
    <div ref={rootRef} className="relative h-full w-full overflow-hidden bg-ink-950">
      <div className="absolute inset-0 bg-grid-fine opacity-[0.16]" />
      <div className="absolute inset-0" style={{ background: "radial-gradient(70% 70% at 60% 50%, rgba(255,90,77,0.06), transparent 60%)" }} />
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
          <Callout x={px(L.companies[0].x, L.w)} y={px(L.h * 0.235, L.h)} anchor="center" tone="accent" label="Qualified" value={qualified.toLocaleString()} appear={seg(dt, T.coStart, T.coStart + 0.8)} reduced={reduce} />
          <Callout x={px(L.dmHub.x + L.w * 0.006, L.w)} y={px(L.h * 0.075, L.h)} anchor="center" tone="accent" label="Decision-makers" value={dmsCount.toLocaleString()} appear={seg(dt, T.dmStart, T.dmStart + 0.8)} reduced={reduce} />
          <Callout x={px(L.contacts[0].x, L.w)} y={px(L.h * 0.085, L.h)} anchor="center" tone="violet" label="Verified contacts" value={emailsCount.toLocaleString()} appear={seg(dt, T.contactStart, T.contactStart + 0.8)} reduced={reduce} />

          {/* SOURCES cloud (the vast network) */}
          {SOURCES.map((s, i) => {
            const a = clamp01((dt - (T.srcStart + i * T.srcStagger)) / 0.4);
            if (a <= 0) return null;
            return (
              <NodeAt key={s.label} x={px(L.sources[i].x, L.w)} y={px(L.sources[i].y, L.h)} appear={a} reduced={reduce}>
                <ToolChip tool={s} compact />
              </NodeAt>
            );
          })}
          {/* sourced count + "the cloud is even bigger" hint, in the clear
              bottom gutter (the top is occupied by the nav) */}
          <div
            className="absolute z-20 flex items-center gap-2 whitespace-nowrap"
            style={{ left: px(L.sources[0].x, L.w), top: px(L.h * 0.97, L.h), transform: "translate(-50%,-50%)", opacity: clamp01((dt - (T.srcStart + 4 * T.srcStagger)) / 0.6) }}
          >
            <span className="font-display text-[16px] text-accent leading-none tabular-nums">{sourced.toLocaleString()}</span>
            <span className="text-[9px] font-mono uppercase tracking-[0.16em] text-white/40">sourced · + 28 more channels</span>
          </div>

          {/* ENRICH stack — a toolbar above the qualify column */}
          {(() => {
            const a = clamp01((dt - T.enrichStart) / 0.6);
            if (a <= 0) return null;
            return (
              <div className="absolute z-20" style={{ left: px(L.enrich.x, L.w), top: px(L.enrich.y, L.h), transform: "translate(-50%,-50%)", opacity: a }}>
                <div className="flex flex-col items-center gap-1">
                  <span className="text-[9px] font-mono uppercase tracking-[0.16em] text-accent/80">Enrich stack</span>
                  <div className="flex items-center gap-1 rounded-full bg-ink-900/85 border border-white/12 px-1.5 py-1 backdrop-blur-sm">
                    {ENRICH_TOOLS.map((e, j) => (
                      <span key={e.label} title={e.label} style={{ opacity: clamp01((dt - (T.enrichStart + j * 0.1)) / 0.3) }}>
                        <LogoTile tool={e} size={16} />
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            );
          })()}

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
                  style={{ opacity: dropped ? 0.38 : 1, borderColor: dropped ? "rgba(255,255,255,0.1)" : "rgba(255,90,77,0.3)" }}
                >
                  <span className="font-mono text-[11px] text-white whitespace-nowrap">{c.name}</span>
                  {decided && (
                    c.keep ? (
                      <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-accent/18 border border-accent/55">
                        <svg width="9" height="9" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="#ff5a4d" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>
                      </span>
                    ) : (
                      <span className="text-[10px] font-mono text-white/40">dropped</span>
                    )
                  )}
                </div>
              </NodeAt>
            );
          })}

          {/* DECISION-MAKER finder waterfall — sequential trial cascade */}
          <WaterfallCard
            x={px(L.dmHub.x, L.w)}
            y={px(L.dmHub.y, L.h)}
            title="DM finder"
            caption="first hit wins"
            tone="accent"
            tools={DM_WATERFALL}
            hitIndex={DM_HIT_INDEX}
            start={T.dmStart}
            trialDur={T.dmTrialDur}
            dt={dt}
          />

          {/* EMAIL finder waterfall — sequential trial + verify */}
          <WaterfallCard
            x={px(L.emailHub.x, L.w)}
            y={px(L.emailHub.y, L.h)}
            title="Email waterfall"
            caption="pay-on-success"
            tone="violet"
            tools={EMAIL_WATERFALL}
            hitIndex={EMAIL_HIT_INDEX}
            start={T.emailStart}
            trialDur={T.emailTrialDur}
            dt={dt}
          />

          {/* VERIFIED CONTACTS (person + email together) */}
          {CONTACTS.map((p, i) => {
            const a = clamp01((dt - (T.contactStart + i * T.contactStagger)) / 0.5);
            if (a <= 0) return null;
            return (
              <div
                key={p.email}
                className="absolute z-20"
                style={{ left: px(L.contacts[i].x, L.w), top: px(L.contacts[i].y, L.h), transform: "translate(0,-50%)", opacity: a }}
              >
                <div className="inline-flex items-center gap-2 rounded-lg bg-ink-800/92 border border-white/10 pl-1.5 pr-2.5 py-1 backdrop-blur-sm shadow-[0_4px_14px_rgba(0,0,0,0.4)]" style={{ transform: reduce ? "none" : `translateX(${(1 - easeOutBack(a)) * -14}px)` }}>
                  <span className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-mono text-ink-950 shrink-0" style={{ background: "linear-gradient(135deg,#ff5a4d,#7c5cff)" }}>{p.initials}</span>
                  <span className="flex flex-col leading-tight min-w-0">
                    <span className="flex items-center gap-1.5">
                      <span className="text-[11px] text-white whitespace-nowrap">{p.name}</span>
                      <span className="text-[9px] text-white/40 whitespace-nowrap">· {p.title}</span>
                    </span>
                    <span className="flex items-center gap-1 mt-0.5">
                      <ProviderLogo provider={p.provider} size={11} />
                      <span className="font-mono text-[9.5px] text-white/65 leading-none whitespace-nowrap">{p.email}</span>
                      <span className="inline-flex items-center justify-center w-3 h-3 rounded-full bg-accent/18 border border-accent/55 shrink-0">
                        <svg width="7" height="7" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="#ff5a4d" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
                      </span>
                    </span>
                  </span>
                </div>
              </div>
            );
          })}
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

/** A logo tile (white bg for the real mark) or a named fallback tile. */
function LogoTile({ tool, size = 15 }: { tool: Tool; size?: number }) {
  if (tool.logo) {
    return (
      <span className="inline-flex items-center justify-center rounded-md bg-white shrink-0" style={{ width: size + 8, height: size + 8 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/logos/${tool.logo}.png`} alt={tool.label} width={size} height={size} style={{ width: size, height: size }} className="object-contain" />
      </span>
    );
  }
  const letters = tool.label.replace(/[^A-Za-z]/g, "").slice(0, 2).toUpperCase();
  return (
    <span
      className="inline-flex items-center justify-center rounded-md bg-white/[0.08] border border-white/15 text-white/75 font-mono shrink-0"
      style={{ width: size + 8, height: size + 8, fontSize: size * 0.62 }}
    >
      {letters}
    </span>
  );
}

/** A source/tool chip: logo tile + label. */
function ToolChip({ tool, compact }: { tool: Tool; compact?: boolean }) {
  return (
    <div className={`inline-flex items-center gap-1.5 rounded-lg bg-ink-900/80 border border-white/10 backdrop-blur-sm ${compact ? "pl-1 pr-2 py-1" : "pl-1.5 pr-2.5 py-1.5"}`}>
      <LogoTile tool={tool} size={compact ? 13 : 15} />
      <span className={`${compact ? "text-[10.5px]" : "text-[11.5px]"} text-white/90 whitespace-nowrap leading-none`}>{tool.label}</span>
    </div>
  );
}

/** Vertical multi-method waterfall — shows a **sequential trial cascade** so
 *  anyone can see it try tool 1, miss, try tool 2, miss, try tool 3, HIT.
 *  Tools before hitIndex go: appear → trying → miss.
 *  Tool at hitIndex goes: appear → trying → hit ✓.
 *  Tools after hitIndex stay dim/idle (never reached).
 *  Verify tools (last, marked `verify: true`) fire after the hit, in the
 *  card's own color, showing the verification pass. */
type ToolState = "hidden" | "queued" | "trying" | "miss" | "hit" | "verifying" | "verified" | "idle";

function WaterfallCard({
  x, y, title, caption, tone, tools, hitIndex, start, trialDur, dt,
}: {
  x: string; y: string; title: string; caption: string;
  tone: "accent" | "violet";
  tools: Tool[];
  hitIndex: number;
  start: number;
  trialDur: number;
  dt: number;
}) {
  const cardAppear = clamp01((dt - (start - 0.4)) / 0.5);
  if (cardAppear <= 0) return null;

  const accent = tone === "accent" ? "text-accent" : "text-violet-glow";
  const ring = tone === "accent" ? "border-accent/30" : "border-violet-glow/35";
  const APPEAR_STAGGER = 0.06;
  const CASCADE_OFFSET = tools.length * APPEAR_STAGGER + 0.2; // let all appear first

  // Compute this tool's state at time dt
  const stateOf = (i: number, tl: Tool): ToolState => {
    // A tool with verify:true fires AFTER the hit, at the last position
    const isVerify = !!tl.verify;
    const nonVerifyHitIndex = hitIndex;

    const appearAt = start + i * APPEAR_STAGGER - 0.05;
    if (dt < appearAt) return "hidden";

    if (isVerify) {
      const vStart = start + CASCADE_OFFSET + (nonVerifyHitIndex + 1) * trialDur;
      if (dt < vStart) return "queued";
      if (dt < vStart + trialDur * 0.5) return "verifying";
      return "verified";
    }

    // Non-verify tool
    if (i > nonVerifyHitIndex) return "idle"; // never reached (fallback exists but not needed)
    const tStart = start + CASCADE_OFFSET + i * trialDur;
    if (dt < tStart) return "queued";
    if (dt < tStart + trialDur * 0.5) return "trying";
    return i < nonVerifyHitIndex ? "miss" : "hit";
  };

  return (
    <div className="absolute z-20" style={{ left: x, top: y, transform: "translate(-50%,-50%)", opacity: cardAppear }}>
      <div className={`rounded-xl bg-ink-900/85 border ${ring} px-2 py-2 backdrop-blur-sm shadow-[0_8px_24px_rgba(0,0,0,0.4)] min-w-[168px]`}>
        <div className={`text-[8.5px] font-mono uppercase tracking-[0.14em] ${accent} mb-1.5 px-0.5 text-center`}>{title}</div>
        <div className="flex flex-col gap-1">
          {tools.map((tl, i) => {
            const s = stateOf(i, tl);
            if (s === "hidden") return null;

            // Row-level visual props derived from state
            const isMiss = s === "miss";
            const isIdle = s === "idle";
            const isHit = s === "hit";
            const isTrying = s === "trying";
            const isVerifying = s === "verifying";
            const isVerified = s === "verified";
            const rowOpacity = isMiss ? 0.55 : isIdle ? 0.4 : 1;

            // Small right-hand-side indicator per state
            const dot = tone === "accent" ? "255,90,77" : "124,92,255";
            let indicator: React.ReactNode;
            if (isTrying || isVerifying) {
              indicator = (
                <span className="inline-flex items-center gap-0.5 shrink-0">
                  <TryDots color={dot} />
                </span>
              );
            } else if (isMiss) {
              indicator = (
                <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-white/[0.05] border border-white/20 shrink-0">
                  <svg width="7" height="7" viewBox="0 0 24 24" fill="none">
                    <path d="M6 6l12 12M6 18L18 6" stroke="rgba(255,255,255,0.55)" strokeWidth="3" strokeLinecap="round" />
                  </svg>
                </span>
              );
            } else if (isHit || isVerified) {
              const glow = tone === "accent" ? "shadow-[0_0_10px_rgba(255,90,77,0.55)]" : "shadow-[0_0_10px_rgba(124,92,255,0.55)]";
              const bg = tone === "accent" ? "bg-accent/22 border-accent/70" : "bg-violet-glow/22 border-violet-glow/70";
              const stroke = tone === "accent" ? "#ff5a4d" : "#7c5cff";
              indicator = (
                <span className={`inline-flex items-center justify-center w-3.5 h-3.5 rounded-full border shrink-0 ${bg} ${glow}`}>
                  <svg width="8" height="8" viewBox="0 0 24 24" fill="none">
                    <path d="M5 13l4 4L19 7" stroke={stroke} strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              );
            } else if (s === "queued" || isIdle) {
              indicator = <span className="text-white/25 text-[9px] shrink-0">↓</span>;
            }

            // Row highlight when trying (subtle border pulse)
            const rowRing =
              isTrying || isVerifying
                ? tone === "accent"
                  ? "ring-1 ring-accent/50"
                  : "ring-1 ring-violet-glow/50"
                : "";

            // Small status label — makes the intent unmissable
            const label: string | null =
              isTrying ? "searching…"
              : isVerifying ? "verifying…"
              : isMiss ? "not found"
              : isHit ? "found"
              : isVerified ? "verified"
              : null;
            const labelColor =
              isTrying || isHit ? "text-accent"
              : isVerifying || isVerified ? "text-violet-glow"
              : isMiss ? "text-white/45"
              : "text-white/30";

            return (
              <div
                key={tl.label + i}
                className={`flex items-center gap-1.5 rounded-md px-1 py-0.5 transition-all duration-200 ${rowRing}`}
                style={{ opacity: rowOpacity }}
              >
                <LogoTile tool={tl} size={12} />
                <span className="text-[9.5px] text-white/85 whitespace-nowrap leading-none">
                  {tl.label}
                </span>
                <span className={`text-[7px] font-mono uppercase tracking-[0.12em] ml-auto shrink-0 ${labelColor}`}>
                  {label}
                </span>
                {indicator}
              </div>
            );
          })}
        </div>
        <div className="text-[7.5px] font-mono uppercase tracking-[0.12em] text-white/35 mt-1.5 text-center">{caption}</div>
      </div>
    </div>
  );
}

/** Animated "..." trying dots — three coral/violet dots that pulse in sequence. */
function TryDots({ color }: { color: string }) {
  return (
    <span className="inline-flex items-center gap-[3px]">
      {[0, 1, 2].map((k) => (
        <span
          key={k}
          className="w-1 h-1 rounded-full"
          style={{
            background: `rgb(${color})`,
            animation: `waterfallDot 0.9s ${k * 0.15}s infinite ease-in-out`,
          }}
        />
      ))}
      <style>{`
        @keyframes waterfallDot {
          0%, 100% { opacity: 0.25; transform: scale(0.75); }
          50%      { opacity: 1;    transform: scale(1); }
        }
      `}</style>
    </span>
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
