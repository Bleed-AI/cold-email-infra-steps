"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import type { ScreenProps } from "../lab/types";
import { useScrubClock, useDeckHandle, seg, easeOut, clamp01, lerp } from "../lab/engine/useScrubClock";
import { NarrationRail, type NarrationStep } from "../lab/engine/NarrationRail";
import { MailboxCard } from "../lab/engine/MailboxCard";
import { ProviderLogo } from "../lab/engine/ProviderLogo";

const STATIONS = ["Sources", "Qualify", "Enrich", "Decision-makers", "Emails"] as const;
const STAGE_T = [0, 3.0, 5.6, 8.4, 11.4] as const; // start time of each stage
const DURATION = 15.8;

const SOURCES = [
  { logo: "apollo", label: "Apollo" },
  { logo: "apify", label: "Apify" },
  { logo: "linkedin", label: "LinkedIn" },
  { logo: "googlemaps", label: "Google Maps" },
  { logo: null as string | null, label: "Niche directories" },
];
const ENRICH = [
  { logo: "clay", label: "Clay" },
  { logo: "parallel", label: "parallel.ai" },
  { logo: "serper", label: "Serper" },
];
const ENRICH_BADGES = ["Website scraped", "Tech stack", "LinkedIn signals", "Recent funding"];
const SAMPLE_CO = { name: "Brightwave Labs", meta: "B2B SaaS · 40–60 staff · Austin, TX" };
const DMS = [
  { initials: "EF", name: "Emma Farrell", title: "Head of Growth" },
  { initials: "DM", name: "Derek McNamara", title: "VP Sales" },
  { initials: "PR", name: "Priya Rao", title: "Founder" },
];
const EMAILS = [
  { email: "emma.farrell@brightwavelabs.com", name: "Emma Farrell", provider: "gmail" as const },
  { email: "derek@brightwavelabs.com", name: "Derek McNamara", provider: "outlook" as const },
  { email: "priya.rao@brightwavelabs.com", name: "Priya Rao", provider: "gmail" as const },
];
const COMPANIES = [
  { name: "Brightwave Labs", keep: true },
  { name: "NorthPeak SaaS", keep: true },
  { name: "Coastal Analytics", keep: false },
  { name: "Vertex Robotics", keep: true },
  { name: "Lumen Retail", keep: false },
];
const COUNTS = { sourced: 1240, qualified: 680, dms: 1700, emails: 1510 };

export default function ListBuildingScreen({ businessName, slug, deckHandleRef, onDone }: ScreenProps) {
  const reduce = !!useReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const sizeRef = useRef({ w: 0, h: 0 });
  const lastTRef = useRef(0);
  const [dt, setDt] = useState(0);

  const steps: NarrationStep[] = useMemo(
    () => [
      { n: "01", title: "Source from everywhere", detail: <p>We pull candidate companies from Apollo, Apify, LinkedIn, Google Maps and niche directories — far more coverage than any single tool.</p> },
      { n: "02", title: "Qualify the companies", detail: <p>We keep only the right-fit companies for {businessName} — correct size, industry and signals — and drop the rest before spending a cent enriching them.</p> },
      { n: "03", title: "Enrich every one", detail: <p>We scrape each company&apos;s website and socials (via Clay, parallel.ai and Serper) for the real signals that make an email feel one-to-one.</p> },
      { n: "04", title: "Find the decision-makers", detail: <p>2–3 real decision-makers per company — the people who can actually say yes — with their title and role.</p> },
      { n: "05", title: "Find their emails", detail: <p>A verified waterfall — Prospeo first, then three backup methods — finds and validates each email, so bounce rates stay near zero.</p> },
    ],
    [businessName]
  );

  const stageOf = (t: number) => {
    let s = 0;
    for (let i = 0; i < STAGE_T.length; i++) if (t >= STAGE_T[i]) s = i;
    return s;
  };

  const drawCanvas = useCallback((t: number) => {
    const ctx = ctxRef.current;
    const { w, h } = sizeRef.current;
    if (!ctx || !w) return;
    ctx.clearRect(0, 0, w, h);
    const x0 = w * 0.40;
    const x1 = w * 0.92;
    const y = h * 0.22;
    // base pipe
    ctx.beginPath();
    ctx.moveTo(x0, y);
    ctx.lineTo(x1, y);
    ctx.strokeStyle = "rgba(255,255,255,0.10)";
    ctx.lineWidth = 2;
    ctx.stroke();
    // progress fill up to current stage
    const stage = stageOf(t);
    const prog = clamp01((t - STAGE_T[Math.min(stage, 4)]) / 2.4);
    const reach = (stage + prog) / (STATIONS.length - 1);
    ctx.beginPath();
    ctx.moveTo(x0, y);
    ctx.lineTo(lerp(x0, x1, clamp01(reach)), y);
    ctx.strokeStyle = "rgba(124,245,208,0.6)";
    ctx.lineWidth = 2.5;
    ctx.stroke();
    // flowing particles along the filled pipe
    if (t > 0.3) {
      for (let k = 0; k < 14; k++) {
        const f = (t * 0.18 + k / 14) % 1;
        if (f > clamp01(reach)) continue;
        const px = lerp(x0, x1, f);
        ctx.beginPath();
        ctx.arc(px, y, 1.8, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(164,255,225,0.8)";
        ctx.fill();
      }
    }
  }, []);

  const onFrame = useCallback((t: number) => {
    lastTRef.current = t;
    drawCanvas(t);
    setDt(t);
  }, [drawCanvas]);

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

  const controls = useScrubClock(onFrame, { duration: DURATION, reduced: reduce, autoPlay: !deckHandleRef, onDone });
  useDeckHandle(controls, deckHandleRef);

  const stage = stageOf(dt);
  const activeNarration = dt < STAGE_T[1] ? 1 : dt < STAGE_T[2] ? 2 : dt < STAGE_T[3] ? 3 : dt < STAGE_T[4] ? 4 : 5;
  const count = (target: number, start: number, dur = 2.2) =>
    Math.round(target * easeOut(clamp01((dt - start) / dur)));

  const sourced = count(COUNTS.sourced, 0.4);
  const qualified = count(COUNTS.qualified, STAGE_T[1]);
  const dmsCount = count(COUNTS.dms, STAGE_T[3]);
  const emailsCount = count(COUNTS.emails, STAGE_T[4]);

  const stationStats = [sourced, qualified, qualified, dmsCount, emailsCount];

  return (
    <div ref={rootRef} className="relative h-full w-full overflow-hidden bg-ink-950">
      <div className="absolute inset-0 bg-grid-fine opacity-[0.16]" />
      <div className="absolute inset-0" style={{ background: "radial-gradient(70% 60% at 64% 40%, rgba(124,245,208,0.07), transparent 60%)" }} />
      <div className="noise" />
      <canvas ref={canvasRef} className="absolute inset-0" />

      <NarrationRail
        eyebrow={<><span className="dot" /> Step 03 · Building the list</>}
        headline={<><span className="text-gradient">We find</span><br /><span className="text-gradient-accent">{businessName}&apos;s buyers.</span></>}
        steps={steps}
        activeCount={activeNarration}
        reduced={reduce}
      />

      {/* pipeline stations */}
      <div className="absolute z-20" style={{ left: "40%", right: "4%", top: "22%", transform: "translateY(-50%)" }}>
        <div className="flex items-start justify-between">
          {STATIONS.map((s, i) => {
            const on = stage >= i;
            return (
              <div key={s} className="flex flex-col items-center text-center" style={{ width: "19%", opacity: on ? 1 : 0.35, transition: "opacity .4s" }}>
                <span className={`w-3.5 h-3.5 rounded-full mb-2 ${stage === i ? "ring-2 ring-accent/60" : ""}`} style={{ background: on ? "#7cf5d0" : "#2a3140", boxShadow: on ? "0 0 10px #7cf5d0" : "none" }} />
                <span className="text-[11px] font-mono text-white leading-tight">{s}</span>
                <span className="font-display text-[18px] text-accent tabular-nums leading-tight mt-0.5">{stationStats[i].toLocaleString()}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* focus detail panel */}
      <div className="absolute z-20" style={{ left: "66%", top: "53%", transform: "translate(-50%,-50%)", width: "min(560px, 46vw)" }}>
        <div className="rounded-2xl glass p-5 shadow-[0_20px_60px_rgba(0,0,0,0.5)] min-h-[230px]">
          {stage === 0 && <SourcesPanel dt={dt} />}
          {stage === 1 && <QualifyPanel dt={dt} />}
          {stage === 2 && <EnrichPanel dt={dt} />}
          {stage === 3 && <DecisionMakersPanel dt={dt} />}
          {stage === 4 && <EmailsPanel dt={dt} />}
        </div>
      </div>

      <ReplayBtn onClick={() => controls.play()} />
    </div>
  );
}

function PanelTitle({ children }: { children: React.ReactNode }) {
  return <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/40 mb-4">{children}</div>;
}

function SourcesPanel({ dt }: { dt: number }) {
  return (
    <>
      <PanelTitle>Pulling companies from 5 sources</PanelTitle>
      <div className="grid grid-cols-2 gap-2.5">
        {SOURCES.map((s, i) => {
          const a = clamp01((dt - (0.3 + i * 0.35)) / 0.4);
          return (
            <div key={s.label} className="flex items-center gap-2.5 rounded-lg bg-white/[0.04] border border-white/8 px-3 py-2.5" style={{ opacity: a, transform: `translateY(${(1 - a) * 8}px)` }}>
              {s.logo ? (
                <span className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-white shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/logos/${s.logo}.png`} alt="" width={18} height={18} style={{ width: 18, height: 18 }} className="object-contain" />
                </span>
              ) : (
                <span className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-violet-glow/15 border border-violet-glow/40 text-violet-glow text-[12px] shrink-0">▤</span>
              )}
              <span className="text-[12px] text-white">{s.label}</span>
            </div>
          );
        })}
      </div>
    </>
  );
}

function QualifyPanel({ dt }: { dt: number }) {
  return (
    <>
      <PanelTitle>Right-fit companies only</PanelTitle>
      <div className="space-y-2">
        {COMPANIES.map((c, i) => {
          const a = clamp01((dt - (STAGE_T[1] + 0.2 + i * 0.22)) / 0.35);
          const decided = dt > STAGE_T[1] + 0.5 + i * 0.22 + 0.4;
          return (
            <div key={c.name} className="flex items-center justify-between rounded-lg bg-white/[0.04] border border-white/8 px-3 py-2.5" style={{ opacity: c.keep ? a : a * (decided ? 0.4 : 1), transform: `translateX(${(1 - a) * 14}px)` }}>
              <span className="text-[12px] text-white font-mono">{c.name}</span>
              {decided && (
                c.keep
                  ? <span className="text-[11px] font-mono text-accent">✓ kept</span>
                  : <span className="text-[11px] font-mono text-white/40">✗ dropped</span>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

function EnrichPanel({ dt }: { dt: number }) {
  return (
    <>
      <PanelTitle>Enriching {SAMPLE_CO.name}</PanelTitle>
      <div className="rounded-lg bg-white/[0.04] border border-white/8 px-3.5 py-3 mb-3">
        <div className="text-[13px] text-white font-mono">{SAMPLE_CO.name}</div>
        <div className="text-[11px] text-white/45">{SAMPLE_CO.meta}</div>
      </div>
      <div className="flex flex-wrap gap-2 mb-3">
        {ENRICH_BADGES.map((b, i) => {
          const a = clamp01((dt - (STAGE_T[2] + 0.4 + i * 0.4)) / 0.35);
          return <span key={b} className="inline-flex items-center gap-1.5 rounded-md bg-accent/10 border border-accent/30 px-2.5 py-1.5 text-[11px] font-mono text-accent" style={{ opacity: a, transform: `scale(${lerp(0.85, 1, a)})` }}><span>✓</span>{b}</span>;
        })}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-mono text-white/35">via</span>
        {ENRICH.map((e) => (
          <span key={e.label} className="inline-flex items-center gap-1.5 chip !py-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/logos/${e.logo}.png`} alt="" width={13} height={13} style={{ width: 13, height: 13 }} className="object-contain" />{e.label}
          </span>
        ))}
      </div>
    </>
  );
}

function DecisionMakersPanel({ dt }: { dt: number }) {
  return (
    <>
      <PanelTitle>2–3 decision-makers · {SAMPLE_CO.name}</PanelTitle>
      <div className="space-y-2.5">
        {DMS.map((d, i) => {
          const a = clamp01((dt - (STAGE_T[3] + 0.3 + i * 0.4)) / 0.4);
          return (
            <div key={d.name} className="flex items-center gap-3 rounded-lg bg-white/[0.04] border border-white/8 px-3 py-2.5" style={{ opacity: a, transform: `translateX(${(1 - a) * 16}px)` }}>
              <span className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-mono text-ink-950" style={{ background: "linear-gradient(135deg,#7cf5d0,#7c5cff)" }}>{d.initials}</span>
              <div className="leading-tight">
                <div className="text-[13px] text-white">{d.name}</div>
                <div className="text-[11px] text-white/45">{d.title}</div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function EmailsPanel({ dt }: { dt: number }) {
  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/40">Verified emails</span>
        <span className="inline-flex items-center gap-1.5 rounded-md bg-violet-glow/10 border border-violet-glow/40 px-2 py-1 text-[10px] font-mono text-violet-glow">
          Prospeo + 3 backups
        </span>
      </div>
      <div className="space-y-2">
        {EMAILS.map((m, i) => {
          const a = clamp01((dt - (STAGE_T[4] + 0.3 + i * 0.4)) / 0.4);
          return (
            <div key={m.email} style={{ opacity: a, transform: `translateX(${(1 - a) * 18}px)` }}>
              <MailboxCard email={m.email} name={m.name} provider={m.provider} className="w-full" />
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex items-center gap-2">
        {["prospeo", "leadmagic", "findymail", "trykit"].map((l, i) => (
          <span key={l} className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-white shrink-0" style={{ opacity: i === 0 ? 1 : 0.55 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/logos/${l}.png`} alt="" width={15} height={15} style={{ width: 15, height: 15 }} className="object-contain" />
          </span>
        ))}
        <span className="text-[10px] font-mono text-white/35">waterfall · pay-on-success</span>
      </div>
    </>
  );
}

function ReplayBtn({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="absolute bottom-6 right-6 z-40 inline-flex items-center gap-2 rounded-full glass px-4 py-2.5 text-[11px] font-mono uppercase tracking-[0.18em] text-white/70 hover:text-accent transition cursor-pointer">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M3 12a9 9 0 1 0 3-6.7M3 4v4h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
      Replay
    </button>
  );
}
