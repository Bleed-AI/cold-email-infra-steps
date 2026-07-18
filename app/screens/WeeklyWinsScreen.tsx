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
 * WEEK-OVER-WEEK OPTIMIZATION — the tournament that finds the champion.
 * Each week is a round: 3 candidates compete, the winner advances.
 * Week 1: Lists → best List
 * Week 2: Offers (on the winning list) → best Offer
 * Week 3: CTAs (on winning list + offer) → best CTA
 * Champion campaign = winning list + winning offer + winning CTA — scales.
 */
type Candidate = { label: string; metric: number; metricLabel: string };
type Round = { week: number; testing: string; icon: string; candidates: Candidate[]; winnerIdx: number };

const ROUNDS: Round[] = [
  {
    week: 1,
    testing: "Lists",
    icon: "list",
    candidates: [
      { label: "SaaS · Series A",       metric: 47, metricLabel: "replies" },
      { label: "Shopify Plus",           metric: 31, metricLabel: "replies" },
      { label: "Agencies · 10–50",       metric: 22, metricLabel: "replies" },
    ],
    winnerIdx: 0,
  },
  {
    week: 2,
    testing: "Offers",
    icon: "offer",
    candidates: [
      { label: "Save your team hours",   metric: 12, metricLabel: "booked" },
      { label: "5× your pipeline",        metric: 24, metricLabel: "booked" },
      { label: "Kill your BDR ramp",      metric: 8,  metricLabel: "booked" },
    ],
    winnerIdx: 1,
  },
  {
    week: 3,
    testing: "CTAs",
    icon: "cta",
    candidates: [
      { label: "\"Worth a chat?\"",       metric: 8,  metricLabel: "replies" },
      { label: "\"15-min Friday?\"",      metric: 18, metricLabel: "replies" },
      { label: "\"See our results?\"",    metric: 12, metricLabel: "replies" },
    ],
    winnerIdx: 1,
  },
];
const NR = ROUNDS.length;

// ── beat timeline (seconds) ──
const T = {
  roundStart: 0.4,
  roundDur: 3.2,          // per round
  candidateStagger: 0.35, // within a round, candidates appear staggered
  candidateDur: 0.5,
  metricRampAt: 1.1,      // within a round, when the metric starts ramping
  metricRampDur: 1.4,
  winnerRevealAt: 2.4,    // within a round, when the winner glows and losers dim
  championAt: 10.6,       // champion combo card appears
  championDur: 0.9,
};
const DURATION = 13.6;

type Pt = { x: number; y: number };
type Layout = {
  w: number;
  h: number;
  colXs: number[];               // x-center of each round column
  rowYs: number[];               // y-center of each candidate row (max 3)
  championY: number;
  railRight: number;
};

export default function WeeklyWinsScreen({ businessName, deckHandleRef, onDone }: ScreenProps) {
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
      { n: "01", title: "Week 1 — which list wins?", detail: <p>We take {businessName}&apos;s campaigns and split by list. 3 audiences compete on reply rate. Only one moves on.</p> },
      { n: "02", title: "Week 2 — best offer on the winning list", detail: <p>Now we lock the winning list and test 3 offers on it. Whichever books the most meetings, we keep.</p> },
      { n: "03", title: "Week 3 — best CTA on winning list + offer", detail: <p>Same drill for CTAs. Same list, same offer, three different closing asks — the one that gets people to click Book wins.</p> },
      { n: "04", title: "Champion combo scales", detail: <p>Best list × best offer × best CTA = the champion campaign. We 3× its volume and it just keeps producing.</p> },
      { n: "05", title: "Every few weeks, a new tournament", detail: <p>The market shifts. So we start a new round — retesting whatever we suspect is drifting — and the current champion has to defend the title.</p> },
    ],
    [businessName]
  );

  const roundStartT = (r: number) => T.roundStart + r * T.roundDur;
  const candidateStartT = (r: number, i: number) => roundStartT(r) + i * T.candidateStagger;

  const computeLayout = useCallback(() => {
    const root = rootRef.current;
    if (!root) return;
    const w = root.clientWidth;
    const h = root.clientHeight;
    const railRight = Math.min(w * 0.34, 440);
    const canvasLeft = railRight + 24;
    const canvasRight = w - 24;
    const canvasW = canvasRight - canvasLeft;

    // Three columns for weeks (pulled inward so cards stay clear of screen edges)
    const colXs = [0.16, 0.44, 0.72].map((f) => canvasLeft + canvasW * f);
    const rowYs = [0.28, 0.44, 0.6].map((f) => h * f);
    const championY = h * 0.83;

    layoutRef.current = { w, h, colXs, rowYs, championY, railRight };
  }, []);

  /** Canvas: draw brackets (winner → next round header + champion) */
  const drawCanvas = useCallback((t: number) => {
    const ctx = ctxRef.current;
    const L = layoutRef.current;
    if (!ctx || !L) return;
    const { w, h, colXs, rowYs, championY } = L;
    ctx.clearRect(0, 0, w, h);

    // Draw winner→next-round connector lines with flowing pulse
    for (let r = 0; r < NR - 1; r++) {
      const winnerY = rowYs[ROUNDS[r].winnerIdx];
      const revealAt = roundStartT(r) + T.winnerRevealAt;
      const nextRoundHeaderAt = roundStartT(r + 1);
      const a = clamp01((t - revealAt) / 0.9);
      if (a <= 0) continue;

      const startX = colXs[r] + 130;
      const startY = winnerY;
      const endX = colXs[r + 1] - 130;
      const endY = h * 0.06; // header of next round column
      const c1: Pt = { x: lerp(startX, endX, 0.55), y: startY };
      const c2: Pt = { x: lerp(startX, endX, 0.45), y: endY };
      const segs = 24;
      const upTo = Math.max(1, Math.floor(segs * a));
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      for (let q = 1; q <= upTo; q++) {
        const f = q / segs;
        ctx.lineTo(bz(startX, c1.x, c2.x, endX, f), bz(startY, c1.y, c2.y, endY, f));
      }
      ctx.strokeStyle = `rgba(255,90,77,${0.35 * a})`;
      ctx.lineWidth = 1.4;
      ctx.stroke();

      // Flowing packet on the connector (after next round begins)
      if (t >= nextRoundHeaderAt) {
        const f = phase(t, 3.2, r * 0.13);
        const fade = Math.sin(Math.PI * f);
        const px = bz(startX, c1.x, c2.x, endX, f);
        const py = bz(startY, c1.y, c2.y, endY, f);
        ctx.beginPath();
        ctx.arc(px, py, 2, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,150,135,${0.85 * fade})`;
        ctx.fill();
      }
    }

    // Draw last-round winner → champion card connector
    const lastRoundRevealAt = roundStartT(NR - 1) + T.winnerRevealAt;
    const cA = clamp01((t - lastRoundRevealAt) / 0.9);
    if (cA > 0) {
      const winnerY = rowYs[ROUNDS[NR - 1].winnerIdx];
      const startX = colXs[NR - 1];
      const startY = winnerY;
      const endX = colXs[NR - 1];
      const endY = championY;
      const segs = 18;
      const upTo = Math.max(1, Math.floor(segs * cA));
      ctx.beginPath();
      ctx.moveTo(startX, startY + 24);
      for (let q = 1; q <= upTo; q++) {
        const f = q / segs;
        ctx.lineTo(startX, lerp(startY + 24, endY - 24, f));
      }
      ctx.strokeStyle = `rgba(255,90,77,${0.4 * cA})`;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // Champion pulse (breathes)
    if (t >= T.championAt) {
      const p = phase(t, 3.2, 0);
      const r = 46 + p * 26;
      const fade = (1 - p) * 0.55;
      ctx.beginPath();
      ctx.arc(colXs[NR - 1], championY, r, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255,90,77,${fade})`;
      ctx.lineWidth = 1.2;
      ctx.stroke();
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

  const activeNarration =
    dt >= T.championAt ? 4
    : dt >= roundStartT(2) ? 3
    : dt >= roundStartT(1) ? 2
    : 1;

  const L = layoutRef.current;
  const px = (v: number, total: number) => `${(v / total) * 100}%`;

  // Champion picks (for final card)
  const winnerLabels = ROUNDS.map((r) => r.candidates[r.winnerIdx].label);

  return (
    <div ref={rootRef} className="relative h-full w-full overflow-hidden bg-ink-950">
      <div className="absolute inset-0 bg-grid-fine opacity-[0.16]" />
      <div
        className="absolute inset-0"
        style={{ background: "radial-gradient(65% 60% at 55% 55%, rgba(255,90,77,0.07), transparent 62%)" }}
      />
      <div className="noise" />
      <canvas ref={canvasRef} className="absolute inset-0" />

      <NarrationRail
        eyebrow={<><span className="dot" /> Step 09 · Week-over-week · a tournament, every week</>}
        headline={
          <>
            <span className="text-gradient">Every week is a tournament.</span>
            <br />
            <span className="text-gradient-accent">We compound what wins.</span>
          </>
        }
        steps={steps}
        activeCount={activeNarration}
        reduced={reduce}
      />

      {L && (
        <>
          {/* Round columns */}
          {ROUNDS.map((round, r) => {
            const roundBegan = dt >= roundStartT(r);
            if (!roundBegan) return null;
            const revealAt = roundStartT(r) + T.winnerRevealAt;
            const revealed = dt >= revealAt;

            return (
              <div key={round.week}>
                {/* Round header + "USING" chip showing what's inherited from previous rounds */}
                <div
                  className="absolute z-20"
                  style={{
                    left: px(L.colXs[r], L.w),
                    top: px(L.h * 0.13, L.h),
                    transform: "translate(-50%,-50%)",
                    opacity: clamp01((dt - roundStartT(r)) / 0.4),
                  }}
                >
                  <div className="flex flex-col items-center gap-1.5">
                    <div className="inline-flex items-center gap-1.5 rounded-full bg-accent/10 border border-accent/40 px-3 py-1 backdrop-blur-sm">
                      <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent whitespace-nowrap">
                        Week {round.week} · Test {round.testing}
                      </span>
                    </div>
                    <span className="text-[8.5px] font-mono uppercase tracking-[0.14em] text-white/40">3 candidates · 1 winner</span>
                    {r > 0 && (
                      <div className="mt-1.5 flex flex-col items-center gap-0.5">
                        <span className="text-[7.5px] font-mono uppercase tracking-[0.18em] text-white/35">using winners from</span>
                        <div className="flex flex-wrap items-center justify-center gap-1 max-w-[240px]">
                          {ROUNDS.slice(0, r).map((prev) => (
                            <span
                              key={prev.week}
                              className="inline-flex items-center gap-1 rounded-md bg-accent/10 border border-accent/40 px-1.5 py-0.5"
                            >
                              <span className="text-[7.5px] font-mono uppercase tracking-[0.14em] text-accent/85">
                                W{prev.week}
                              </span>
                              <span className="text-[9px] font-mono text-white/85 whitespace-nowrap">
                                {prev.candidates[prev.winnerIdx].label}
                              </span>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Candidates */}
                {round.candidates.map((c, i) => {
                  const a0 = candidateStartT(r, i);
                  const a = clamp01((dt - a0) / T.candidateDur);
                  if (a <= 0) return null;
                  const isWinner = i === round.winnerIdx;
                  const dim = revealed && !isWinner ? 0.42 : 1;

                  // metric counts up over metricRampDur
                  const rampStart = roundStartT(r) + T.metricRampAt;
                  const mA = easeOut(clamp01((dt - rampStart) / T.metricRampDur));
                  const shown = Math.round(c.metric * mA);

                  return (
                    <div
                      key={round.week + "-" + c.label}
                      className="absolute z-20"
                      style={{
                        left: px(L.colXs[r], L.w),
                        top: px(L.rowYs[i], L.h),
                        transform: `translate(-50%,-50%) scale(${reduce ? 1 : lerp(0.9, 1, easeOutBack(a))})`,
                        opacity: a * dim,
                        transition: "opacity 0.5s ease",
                      }}
                    >
                      <div
                        className={[
                          "rounded-lg bg-ink-900/85 border pl-2.5 pr-3 py-2 backdrop-blur-sm min-w-[210px]",
                          revealed && isWinner
                            ? "border-accent/70 shadow-[0_0_0_1px_rgba(255,90,77,0.28),0_10px_24px_rgba(255,90,77,0.2)]"
                            : "border-white/14",
                        ].join(" ")}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex flex-col leading-tight min-w-0">
                            <span className="text-[8.5px] font-mono uppercase tracking-[0.14em] text-white/45 mb-0.5">
                              Candidate {String.fromCharCode(65 + i)}
                            </span>
                            <span className="font-mono text-[11px] text-white whitespace-nowrap">{c.label}</span>
                          </div>
                          {revealed && isWinner && (
                            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-accent/22 border border-accent/70 shrink-0 shadow-[0_0_10px_rgba(255,90,77,0.55)]">
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                                <path d="M5 13l4 4L19 7" stroke="#ff5a4d" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            </span>
                          )}
                        </div>
                        <div className="mt-1.5 flex items-baseline gap-1">
                          <span
                            className={[
                              "font-display leading-none tabular-nums text-[18px]",
                              revealed && isWinner ? "text-accent" : "text-white/85",
                            ].join(" ")}
                          >
                            {shown}
                          </span>
                          <span className="text-[9.5px] font-mono text-white/45">{c.metricLabel}</span>
                          {revealed && isWinner && (
                            <span className="ml-auto text-[8.5px] font-mono uppercase tracking-[0.16em] text-accent">winner</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}

          {/* Champion combo card — appears after all rounds */}
          <div
            className="absolute z-30"
            style={{
              left: px(L.colXs[NR - 1], L.w),
              top: px(L.championY, L.h),
              transform: `translate(-50%,-50%) scale(${clamp01((dt - T.championAt) / T.championDur)})`,
              opacity: clamp01((dt - T.championAt) / T.championDur),
            }}
          >
            <div className="rounded-2xl bg-accent/14 border border-accent/60 px-5 py-3 backdrop-blur-sm shadow-[0_0_36px_rgba(255,90,77,0.32)] min-w-[280px]">
              <div className="flex items-center gap-2 mb-2">
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-accent/22 border border-accent/70">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                    <path d="M12 2l3 6 6 1-4.5 4.5L18 20l-6-3-6 3 1.5-6.5L3 9l6-1z" stroke="#ff5a4d" strokeWidth="1.7" strokeLinejoin="round" />
                  </svg>
                </span>
                <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent whitespace-nowrap">Champion combo</span>
              </div>
              <div className="text-[9.5px] font-mono uppercase tracking-[0.14em] text-white/45">List</div>
              <div className="font-mono text-[11.5px] text-white leading-tight mb-1.5">{winnerLabels[0]}</div>
              <div className="text-[9.5px] font-mono uppercase tracking-[0.14em] text-white/45">Offer</div>
              <div className="font-mono text-[11.5px] text-white leading-tight mb-1.5">{winnerLabels[1]}</div>
              <div className="text-[9.5px] font-mono uppercase tracking-[0.14em] text-white/45">CTA</div>
              <div className="font-mono text-[11.5px] text-white leading-tight mb-1.5">{winnerLabels[2]}</div>
              <div className="mt-2 pt-2 border-t border-accent/25 flex items-center justify-between gap-2">
                <span className="text-[9px] font-mono uppercase tracking-[0.14em] text-white/55">scales · 3× volume</span>
                <span className="inline-flex items-center gap-1 text-[8.5px] font-mono uppercase tracking-[0.14em] text-accent">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                  live
                </span>
              </div>
            </div>
          </div>

          {/* Top callouts */}
          <Callout
            x={px((L.colXs[0] + L.colXs[NR - 1]) / 2, L.w)}
            y={px(L.h * 0.2, L.h)}
            anchor="center"
            tone="accent"
            label="tournament · winner advances"
            appear={seg(dt, roundStartT(0) + T.winnerRevealAt + 0.2, roundStartT(0) + T.winnerRevealAt + 1.0)}
            reduced={reduce}
            className="[&_*]:!normal-case"
          />
          <Callout
            x={px(L.colXs[NR - 1], L.w)}
            y={px(L.h * 0.71, L.h)}
            anchor="center"
            tone="violet"
            label="best list × best offer × best CTA"
            appear={seg(dt, T.championAt - 0.2, T.championAt + 0.6)}
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

function bz(p0: number, p1: number, p2: number, p3: number, t: number) {
  const u = 1 - t;
  return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
}
