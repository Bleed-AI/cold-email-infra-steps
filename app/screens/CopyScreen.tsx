"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import type { ScreenProps } from "../lab/types";
import { useScrubClock, useDeckHandle, seg, easeOut, clamp01, lerp, phase } from "../lab/engine/useScrubClock";
import { NarrationRail, type NarrationStep } from "../lab/engine/NarrationRail";
import { Callout } from "../lab/engine/Callout";

// Two variable types (grounded in the real /copy methodology):
//   DATA = pulled straight from the row/enrichment (deterministic facts)
//   AI   = written per-lead by reasoning over scraped research (incl. subject)
const DATA_VARS = [
  { name: "first_name", val: "Emma" },
  { name: "company", val: "Brightwave Labs" },
  { name: "product_name", val: "Brightwave" },
  { name: "employee_count", val: "38" },
];

// The showcase beat: AI reads 3 scraped facts and INFERS a tension none of them
// state outright, then writes the opener from it. This is the "AI writes a line
// from research" moment the founder wanted captured.
const RESEARCH_FACTS = [
  { src: "Crunchbase", fact: "Series A · closed ~6mo ago" },
  { src: "LinkedIn", fact: "no VP Sales / Head of Growth" },
  { src: "LinkedIn", fact: "headcount 38" },
];
const AI_LINE =
  "you closed your Series A about six months ago, which is usually right when the board starts asking for repeatable pipeline, not just founder-led deals";

type Src = "data" | "ai" | null;
type Tok = { t: string; s?: Src };
// the assembled email — each token tagged by its source so the merge is visible
const SUBJECT: Tok[] = [{ t: "who's filling the pipeline at " }, { t: "Brightwave", s: "data" }, { t: "?" }];
const BODY: Tok[][] = [
  [{ t: "Emma", s: "data" }, { t: ", " }, { t: AI_LINE, s: "ai" }, { t: "." }],
  [{ t: "Most teams your size rush to hire an SDR, then spend two quarters and ~$90k watching them ramp. We run the whole outbound motion for you instead: list, copy, sending, replies." }],
  [{ t: "A Series A team a lot like " }, { t: "Brightwave", s: "data" }, { t: " " }, { t: "booked 11 meetings in their first 30 days", s: "ai" }, { t: ", before they'd have finished onboarding a rep." }],
  [{ t: "Want me to map out the first 30 days for " }, { t: "Brightwave", s: "data" }, { t: " specifically? No call yet, I can just send it over." }],
];
const PS: Tok[] = [{ t: "P.S. " }, { t: "reply rates across these SaaS campaigns run 5 to 14%", s: "ai" }, { t: ", depending on how tight the list is." }];

const VARIANTS = [
  { id: "A", angle: "Save time", note: "skip the SDR ramp" },
  { id: "B", angle: "Make money", note: "pipeline in 30 days" },
  { id: "C", angle: "Save money", note: "vs a $90k SDR + stack" },
];
const FOLLOWUPS = [
  { tag: "E1 · day 0", text: "Inferred-tension opener (above)" },
  { tag: "E2 · day 3", text: "Reframe: buy proof before headcount" },
  { tag: "E3 · day 7", text: "New thread: the cost of a flat quarter" },
];

const T = {
  dataStart: 0.3,
  dataStagger: 0.28,
  factStart: 1.9,
  factStagger: 0.26,
  typeStart: 3.0,
  typeDur: 1.9,
  emailStart: 6.0,
  lineStagger: 0.66,
  variantStart: 10.0,
  followStart: 11.4,
};
const DURATION = 14.0;
const FLOW_PERIOD = 3.4;
// progress (0..1) of the AI typing out its composed line
const typeProgress = (dt: number) => clamp01((dt - T.typeStart) / T.typeDur);

type Pt = { x: number; y: number };
type Layout = { w: number; h: number; dataSrc: Pt; aiSrc: Pt; emailIn: Pt };

export default function CopyScreen({ businessName, deckHandleRef, onDone }: ScreenProps) {
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
      { n: "01", title: "Two kinds of variables", detail: <p>Some come straight from the data (name, company, headcount). Others are written by AI from each lead&apos;s research — even the subject line.</p> },
      { n: "02", title: "AI writes the line from research", detail: <p>It reads the scraped facts — Series A timing, no sales hire yet, headcount — and infers the tension <em>none of them state outright</em>, then writes the opener from it. Not a slotted token: a sentence composed for one person.</p> },
      { n: "03", title: "Merge both into the copy", detail: <p>Data variables and AI variables slot into a proven template, so every email reads like it was written by hand for that one person.</p> },
      { n: "04", title: "A/B/C value angles", detail: <p>The same offer runs through three value lenses — save time, make money, save money — so the best-performing message wins on real replies.</p> },
      { n: "05", title: "Follow-ups", detail: <p>Each angle becomes a short sequence over the next week, every touch adding something new — so {businessName} stays top-of-mind without nagging.</p> },
    ],
    [businessName]
  );

  const computeLayout = useCallback(() => {
    const root = rootRef.current;
    if (!root) return;
    const w = root.clientWidth;
    const h = root.clientHeight;
    layoutRef.current = {
      w,
      h,
      dataSrc: { x: w * 0.44, y: h * 0.26 },
      aiSrc: { x: w * 0.44, y: h * 0.66 },
      emailIn: { x: w * 0.57, y: h * 0.46 },
    };
  }, []);

  const drawCanvas = useCallback((t: number) => {
    const ctx = ctxRef.current;
    const L = layoutRef.current;
    if (!ctx || !L) return;
    const { w, h, dataSrc, aiSrc, emailIn } = L;
    ctx.clearRect(0, 0, w, h);

    const drawFlow = (a: Pt, b: Pt, grow: number, pk: string, offset: number) => {
      if (grow <= 0) return;
      const c1 = { x: lerp(a.x, b.x, 0.5), y: a.y };
      const c2 = { x: lerp(a.x, b.x, 0.5), y: b.y };
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      const segs = 30;
      const upTo = Math.max(1, Math.floor(segs * grow));
      for (let q = 1; q <= upTo; q++) {
        const f = q / segs;
        ctx.lineTo(bz(a.x, c1.x, c2.x, b.x, f), bz(a.y, c1.y, c2.y, b.y, f));
      }
      ctx.strokeStyle = pk === "data" ? "rgba(255,90,77,0.22)" : "rgba(124,92,255,0.26)";
      ctx.lineWidth = 1.2;
      ctx.stroke();
      if (grow >= 1) {
        for (let p = 0; p < 3; p++) {
          const f = phase(t, FLOW_PERIOD, offset + p / 3);
          const fade = Math.sin(Math.PI * f);
          const x = bz(a.x, c1.x, c2.x, b.x, f);
          const y = bz(a.y, c1.y, c2.y, b.y, f);
          ctx.beginPath();
          ctx.arc(x, y, 2, 0, Math.PI * 2);
          ctx.fillStyle = pk === "data" ? `rgba(255,150,135,${0.9 * fade})` : `rgba(167,143,255,${0.9 * fade})`;
          ctx.fill();
        }
      }
    };

    const dataGrow = easeOut(seg(t, T.emailStart - 0.6, T.emailStart + 0.4));
    const aiGrow = easeOut(seg(t, T.emailStart - 0.2, T.emailStart + 0.8));
    drawFlow(dataSrc, emailIn, dataGrow, "data", 0.0);
    drawFlow(aiSrc, emailIn, aiGrow, "ai", 0.5);

    // merge node glow at the email inlet (seamless breathe, period == FLOW_PERIOD)
    const mv = easeOut(seg(t, T.emailStart - 0.4, T.emailStart + 0.6));
    if (mv > 0) {
      const breathe = 1 + 0.08 * Math.sin((t / FLOW_PERIOD) * Math.PI * 2);
      const r = 30 * breathe;
      const g = ctx.createRadialGradient(emailIn.x, emailIn.y, 0, emailIn.x, emailIn.y, r);
      g.addColorStop(0, `rgba(255,190,170,${0.13 * mv})`);
      g.addColorStop(1, "rgba(255,190,170,0)");
      ctx.fillStyle = g;
      ctx.fillRect(emailIn.x - r, emailIn.y - r, r * 2, r * 2);
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

  const activeNarration = dt < T.typeStart ? 1 : dt < T.emailStart ? 2 : dt < T.variantStart ? 3 : dt < T.followStart ? 4 : 5;
  const bodyShown = BODY.filter((_, i) => dt > T.emailStart + 0.5 + i * T.lineStagger).length;
  const psShown = dt > T.emailStart + 0.5 + BODY.length * T.lineStagger;
  const showVariants = dt > T.variantStart;
  const showFollow = dt > T.followStart;

  const L = layoutRef.current;
  const px = (v: number, total: number) => `${(v / total) * 100}%`;
  const spanCls = (s?: Src) =>
    s === "data" ? "text-accent font-medium" : s === "ai" ? "text-violet-glow font-medium" : "text-white/72";

  return (
    <div ref={rootRef} className="relative h-full w-full overflow-hidden bg-ink-950">
      <div className="absolute inset-0 bg-grid-fine opacity-[0.16]" />
      <div className="absolute inset-0" style={{ background: "radial-gradient(66% 60% at 64% 48%, rgba(124,92,255,0.08), transparent 60%)" }} />
      <div className="noise" />
      <canvas ref={canvasRef} className="absolute inset-0" />

      <NarrationRail
        eyebrow={<><span className="dot" /> Step 04 · AI copy</>}
        headline={<><span className="text-gradient">We write it,</span><br /><span className="text-gradient-accent">personally — at scale.</span></>}
        steps={steps}
        activeCount={activeNarration}
        reduced={reduce}
      />

      {L && (
        <>
          {/* DATA variable source */}
          <VarSource
            x={px(L.dataSrc.x, L.w)}
            y={px(L.dataSrc.y, L.h)}
            tone="data"
            title="DATA variables"
            sub="from the row"
            vars={DATA_VARS}
            t0={T.dataStart}
            stagger={T.dataStagger}
            dt={dt}
          />
          {/* AI compose station — reads scraped research, infers the tension,
              and TYPES the personalized opener. The showcase of "AI writes a
              line from research." */}
          <AiComposeStation x={px(L.aiSrc.x, L.w)} y={px(L.aiSrc.y, L.h)} dt={dt} reduced={reduce} />

          {/* EMAIL — the merge of both variable types */}
          <div
            className="absolute z-20"
            style={{ left: px(L.w * 0.72, L.w), top: "50%", transform: "translate(-50%,-50%)", width: "min(440px,34vw)", opacity: clamp01((dt - (T.emailStart - 0.3)) / 0.5) }}
          >
            {/* variant tabs */}
            <div className="flex items-center gap-1.5 mb-2" style={{ opacity: showVariants ? 1 : 0, transition: "opacity .4s" }}>
              {VARIANTS.map((v, i) => (
                <span key={v.id} className={`inline-flex items-center gap-1.5 rounded-t-lg px-2.5 py-1.5 text-[10px] font-mono ${i === 0 ? "bg-ink-800 text-accent border-t border-x border-white/12" : "bg-white/[0.03] text-white/45"}`}>
                  <span className="font-bold">{v.id}</span> {v.angle}
                </span>
              ))}
            </div>

            <div className="rounded-2xl glass p-5 shadow-[0_20px_60px_rgba(0,0,0,0.5)]">
              <div className="flex items-center justify-between border-b border-white/8 pb-3 mb-3">
                <div className="min-w-0">
                  <div className="text-[10px] font-mono text-white/35">Subject</div>
                  <div className="text-[13px] truncate">
                    {SUBJECT.map((tok, j) => (
                      <span key={j} className={spanCls(tok.s)}>{tok.t}</span>
                    ))}
                  </div>
                </div>
                <span className="text-[10px] font-mono text-white/30 shrink-0 ml-3">to Emma</span>
              </div>
              <div className="space-y-2.5 text-[12.5px] leading-relaxed min-h-[150px]">
                {BODY.map((line, i) => (
                  <p key={i} style={{ opacity: i < bodyShown ? 1 : 0, transform: `translateY(${i < bodyShown ? 0 : 6}px)`, transition: "opacity .4s, transform .4s" }}>
                    {line.map((tok, j) => (
                      <span key={j} className={spanCls(tok.s)}>{tok.t}</span>
                    ))}
                  </p>
                ))}
                <p style={{ opacity: psShown ? 1 : 0, transition: "opacity .4s" }} className="text-[11.5px] text-white/45 pt-1">
                  {PS.map((tok, j) => (
                    <span key={j} className={tok.s ? spanCls(tok.s) : "text-white/45"}>{tok.t}</span>
                  ))}
                </p>
              </div>
              <div className="mt-3 pt-3 border-t border-white/8 flex items-center gap-2 text-[10px] font-mono text-white/35">
                <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-accent/80" /> data</span>
                <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-violet-glow/80" /> AI-written</span>
                <span className="ml-auto">reads 1:1 · ×1,510 prospects</span>
              </div>
            </div>

            {/* follow-up thread */}
            <div className="mt-2.5 space-y-1.5" style={{ opacity: showFollow ? 1 : 0, transition: "opacity .4s" }}>
              {FOLLOWUPS.map((f, i) => {
                const a = clamp01((dt - (T.followStart + 0.2 + i * 0.35)) / 0.4);
                return (
                  <div key={f.tag} className="flex items-center gap-2.5 rounded-lg bg-white/[0.03] border border-white/8 px-3 py-1.5" style={{ opacity: showFollow ? a : 0, transform: `translateX(${(1 - a) * 12}px)` }}>
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${i === 0 ? "bg-accent" : "bg-white/25"}`} />
                    <span className="text-[10px] font-mono text-white/40 shrink-0 w-[68px]">{f.tag}</span>
                    <span className="text-[11px] text-white/65 truncate">{f.text}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* inline label at the merge-flow convergence */}
          <Callout
            x={px(L.w * 0.54, L.w)}
            y={px(L.h * 0.575, L.h)}
            anchor="center"
            tone="violet"
            label="Merged 1:1"
            sub="data + AI into one email"
            appear={seg(dt, T.emailStart + 0.3, T.emailStart + 1.1)}
            reduced={reduce}
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

function VarSource({
  x,
  y,
  tone,
  title,
  sub,
  vars,
  t0,
  stagger,
  dt,
}: {
  x: string;
  y: string;
  tone: "data" | "ai";
  title: string;
  sub: string;
  vars: { name: string; val: string }[];
  t0: number;
  stagger: number;
  dt: number;
}) {
  const accent = tone === "data" ? "text-accent" : "text-violet-glow";
  const border = tone === "data" ? "border-accent/35" : "border-violet-glow/40";
  return (
    <div className="absolute z-20" style={{ left: x, top: y, transform: "translate(-50%,-50%)", width: 224 }}>
      <div className={`text-[10px] font-mono uppercase tracking-[0.16em] ${accent} mb-1`}>
        {title}
        <span className="text-white/35 normal-case tracking-normal ml-1.5 lowercase">· {sub}</span>
      </div>
      <div className="space-y-1.5">
        {vars.map((v, i) => {
          const a = clamp01((dt - (t0 + i * stagger)) / 0.45);
          if (a <= 0) return null;
          return (
            <div
              key={v.name}
              className={`flex items-center gap-1.5 rounded-md bg-ink-900/80 border ${border} px-2 py-1 backdrop-blur-sm`}
              style={{ opacity: a, transform: `translateX(${(1 - a) * -12}px)` }}
            >
              <span className={`font-mono text-[10px] ${accent} shrink-0`}>{`{{${v.name}}}`}</span>
              <span className="text-white/30 text-[10px] shrink-0">→</span>
              <span className="text-[10.5px] text-white/85 truncate">{v.val}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** The "AI writes a line from research" station: scraped facts → inferred line. */
function AiComposeStation({ x, y, dt, reduced }: { x: string; y: string; dt: number; reduced?: boolean }) {
  const station = clamp01((dt - (T.factStart - 0.4)) / 0.5);
  if (station <= 0) return null;
  const prog = typeProgress(dt);
  const chars = Math.floor(prog * AI_LINE.length);
  const typed = AI_LINE.slice(0, chars);
  const typing = prog > 0 && prog < 1;
  const lineRevealed = dt > T.typeStart - 0.2;

  return (
    <div className="absolute z-20" style={{ left: x, top: y, transform: "translate(-50%,-50%)", width: 234, opacity: station }}>
      <div className="text-[10px] font-mono uppercase tracking-[0.16em] text-violet-glow mb-1.5 flex items-center gap-1.5">
        <Spark /> AI <span className="text-white/35 normal-case tracking-normal lowercase">· reads the research</span>
      </div>

      {/* scraped facts (hard data, red) the AI reasons over */}
      <div className="space-y-1">
        {RESEARCH_FACTS.map((f, i) => {
          const a = clamp01((dt - (T.factStart + i * T.factStagger)) / 0.45);
          if (a <= 0) return null;
          return (
            <div
              key={f.fact}
              className="flex items-center gap-1.5 rounded-md bg-ink-900/80 border border-accent/30 px-2 py-1 backdrop-blur-sm"
              style={{ opacity: a, transform: reduced ? "none" : `translateX(${(1 - a) * -10}px)` }}
            >
              <span className="text-[8px] font-mono uppercase tracking-[0.1em] text-accent/75 shrink-0">{f.src}</span>
              <span className="text-[10px] text-white/85 truncate">{f.fact}</span>
            </div>
          );
        })}
      </div>

      {/* infer → compose */}
      {lineRevealed && (
        <>
          <div className="my-1.5 flex items-center gap-1.5 text-[9px] font-mono uppercase tracking-[0.14em] text-violet-glow/80">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M12 5v14M5 12l7 7 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            infers the tension, writes the opener
          </div>
          <div className="rounded-lg bg-violet-glow/[0.08] border border-violet-glow/35 px-2.5 py-2 min-h-[52px]">
            <p className="text-[11px] leading-snug text-violet-glow">
              {typed}
              {typing && <span className="inline-block w-[2px] h-[12px] -mb-[1px] ml-[1px] bg-violet-glow animate-pulse" />}
            </p>
          </div>
        </>
      )}
    </div>
  );
}

function Spark() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z" fill="currentColor" />
    </svg>
  );
}

function bz(p0: number, p1: number, p2: number, p3: number, t: number) {
  const u = 1 - t;
  return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
}
