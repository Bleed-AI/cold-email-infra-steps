"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import type { ScreenProps } from "../lab/types";
import { useScrubClock, useDeckHandle, seg, easeOut, clamp01, lerp, phase } from "../lab/engine/useScrubClock";
import { NarrationRail, type NarrationStep } from "../lab/engine/NarrationRail";
import { Callout } from "../lab/engine/Callout";

// Two variable types (grounded in the real copy methodology):
//   DATA = pulled straight from the row/enrichment (deterministic)
//   AI   = written per-lead from scraped research (incl. the subject line)
const DATA_VARS = [
  { name: "first_name", val: "Emma" },
  { name: "company", val: "Brightwave Labs" },
  { name: "product_name", val: "Brightwave" },
  { name: "employee_count", val: "38" },
];
const AI_VARS = [
  { name: "subject_line", val: "outbound at Brightwave?" },
  { name: "timing_observation", val: "you closed your Series A ~6 months ago" },
  { name: "case_study_line", val: "booked 11 meetings in 30 days" },
  { name: "ps_line", val: "reply rates run 5–14%" },
];

type Src = "data" | "ai" | null;
type Tok = { t: string; s?: Src };
// the assembled email — each token tagged by its source so the merge is visible
const SUBJECT: Tok[] = [{ t: "outbound at " }, { t: "Brightwave", s: "data" }, { t: "?" }];
const BODY: Tok[][] = [
  [{ t: "Emma", s: "data" }, { t: ", " }, { t: "you closed your Series A about six months ago", s: "ai" }, { t: ". That usually means pipeline pressure is next." }],
  [{ t: "We run the full outbound pipeline for Series A SaaS teams that aren't ready to hire an SDR: list building, copy, sequences, and reply management." }],
  [{ t: "A similar team ", }, { t: "booked 11 meetings in their first 30 days", s: "ai" }, { t: "." }],
  [{ t: "Worth a 20-minute call to see if it's a fit for " }, { t: "Brightwave Labs", s: "data" }, { t: "?" }],
];
const PS: Tok[] = [{ t: "P.S. " }, { t: "reply rates across SaaS campaigns run 5 to 14%", s: "ai" }, { t: ", depending on how tight the list is." }];

const VARIANTS = [
  { id: "A", angle: "Save time", note: "no SDR to hire & ramp" },
  { id: "B", angle: "Make money", note: "pipeline in 30 days" },
  { id: "C", angle: "Save money", note: "vs a $90k SDR + stack" },
];
const FOLLOWUPS = [
  { tag: "E1 · day 0", text: "The opener (above)" },
  { tag: "E2 · day 3", text: "New angle + a concrete data play" },
  { tag: "E3 · day 7", text: "Fresh thread, different value lens" },
];

const T = {
  dataStart: 0.3,
  dataStagger: 0.3,
  aiStart: 2.4,
  aiStagger: 0.34,
  emailStart: 5.0,
  lineStagger: 0.7,
  variantStart: 9.2,
  followStart: 10.6,
};
const DURATION = 13.0;
const FLOW_PERIOD = 3.4;

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
      { n: "02", title: "AI writes the personal lines", detail: <p>From the enrichment we scraped, the AI drafts a one-to-one observation, the proof line and the P.S. — grounded in real facts, not guesses.</p> },
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
      dataSrc: { x: w * 0.41, y: h * 0.3 },
      aiSrc: { x: w * 0.41, y: h * 0.73 },
      emailIn: { x: w * 0.56, y: h * 0.48 },
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
      ctx.strokeStyle = pk === "data" ? "rgba(124,245,208,0.22)" : "rgba(124,92,255,0.26)";
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
          ctx.fillStyle = pk === "data" ? `rgba(164,255,225,${0.9 * fade})` : `rgba(167,143,255,${0.9 * fade})`;
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
      g.addColorStop(0, `rgba(150,200,255,${0.12 * mv})`);
      g.addColorStop(1, "rgba(150,200,255,0)");
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

  const activeNarration = dt < T.aiStart ? 1 : dt < T.emailStart ? 2 : dt < T.variantStart ? 3 : dt < T.followStart ? 4 : 5;
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
          {/* AI variable source */}
          <VarSource
            x={px(L.aiSrc.x, L.w)}
            y={px(L.aiSrc.y, L.h)}
            tone="ai"
            title="AI variables"
            sub="written from research"
            vars={AI_VARS}
            t0={T.aiStart}
            stagger={T.aiStagger}
            dt={dt}
          />

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

function bz(p0: number, p1: number, p2: number, p3: number, t: number) {
  const u = 1 - t;
  return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
}
