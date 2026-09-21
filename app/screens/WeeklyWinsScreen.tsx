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
} from "../lab/engine/useScrubClock";
import { NarrationRail, type NarrationStep } from "../lab/engine/NarrationRail";

/**
 * WEEK-OVER-WEEK OPTIMIZATION (Step 09) — a tournament read top-to-bottom.
 *
 * Each week is a full-width row of 3 candidates competing on real metrics.
 * A big "WINNER ADVANCES ↓" arrow (with a traveling dot) drops from the
 * winner of each row into the next round's header, so the flow is obvious
 * on any screen size. Champion combo lands at the bottom as the payoff.
 */

type Candidate = { label: string; metric: number; metricLabel: string };
type Round = { week: number; testing: string; candidates: Candidate[]; winnerIdx: number };

const ROUNDS: Round[] = [
  {
    week: 1,
    testing: "Lists",
    candidates: [
      { label: "SaaS · Series A",   metric: 47, metricLabel: "replies" },
      { label: "Shopify Plus",       metric: 31, metricLabel: "replies" },
      { label: "Agencies · 10–50",   metric: 22, metricLabel: "replies" },
    ],
    winnerIdx: 0,
  },
  {
    week: 2,
    testing: "Offers",
    candidates: [
      { label: "Save your team hours",  metric: 12, metricLabel: "booked" },
      { label: "5× your pipeline",       metric: 24, metricLabel: "booked" },
      { label: "Kill your BDR ramp",     metric: 8,  metricLabel: "booked" },
    ],
    winnerIdx: 1,
  },
  {
    week: 3,
    testing: "CTAs",
    candidates: [
      { label: "\"Worth a chat?\"",     metric: 8,  metricLabel: "replies" },
      { label: "\"15-min Friday?\"",     metric: 18, metricLabel: "replies" },
      { label: "\"See our results?\"",   metric: 12, metricLabel: "replies" },
    ],
    winnerIdx: 1,
  },
];
const NR = ROUNDS.length;

// ── beat timeline (seconds) ──
const T = {
  roundStart: 0.4,
  roundDur: 2.6,           // per-round duration (cards in → winner revealed)
  candidateStagger: 0.2,
  candidateDur: 0.45,
  metricRampAt: 0.8,
  metricRampDur: 1.0,
  winnerRevealAt: 2.0,     // within a round, when winner glows
  arrowAppearAt: 2.15,     // within a round, when the advance-arrow to next row appears
  championAt: 8.6,
  championDur: 0.8,
};
const DURATION = 10.8;

export default function WeeklyWinsScreen({ businessName, deckHandleRef, onDone }: ScreenProps) {
  const reduce = !!useReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const lastTRef = useRef(0);
  const pushedRef = useRef(-1);
  const [dt, setDt] = useState(0);

  const steps: NarrationStep[] = useMemo(
    () => [
      { n: "01", title: "Week 1: which list wins?", detail: <p>We take {businessName}&apos;s campaigns and split by list. 3 audiences compete on reply rate. Only one moves on.</p> },
      { n: "02", title: "Week 2: best offer on the winning list", detail: <p>Now we lock the winning list and test 3 offers on it. Whichever books the most meetings, we keep.</p> },
      { n: "03", title: "Week 3: best CTA on winning list + offer", detail: <p>Same drill for CTAs. Same list, same offer, three different closing asks, and the one that gets people to click Book wins.</p> },
      { n: "04", title: "Champion combo scales", detail: <p>Best list × best offer × best CTA = the champion campaign. We 3× its volume and it just keeps producing.</p> },
      { n: "05", title: "Every few weeks, a new tournament", detail: <p>The market shifts. So we start a new round, retesting whatever we suspect is drifting, and the current champion has to defend the title.</p> },
    ],
    [businessName]
  );

  const roundStartT = (r: number) => T.roundStart + r * T.roundDur;

  const onFrame = useCallback((t: number) => {
    const prev = lastTRef.current;
    if (t < prev - 0.5) pushedRef.current = -1;
    lastTRef.current = t;
    if (pushedRef.current < DURATION) {
      const clamped = Math.min(t, DURATION);
      pushedRef.current = clamped;
      setDt(clamped);
    }
  }, []);

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

  return (
    <div ref={rootRef} className="relative h-full w-full overflow-hidden bg-ink-950">
      <div className="absolute inset-0 bg-grid-fine opacity-[0.16]" />
      <div
        className="absolute inset-0"
        style={{ background: "radial-gradient(65% 60% at 60% 55%, rgba(255,90,77,0.07), transparent 62%)" }}
      />
      <div className="noise" />

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

      {/* Right-side content — vertical flow: 3 week rows + 3 arrows + champion */}
      <div
        className="absolute z-20 flex flex-col gap-1 pointer-events-none justify-center"
        style={{
          left: "min(34%, 440px)",
          right: 24,
          top: 64,
          bottom: 64,
          paddingLeft: 32,
          paddingRight: 8,
        }}
      >
        {ROUNDS.map((round, r) => {
          const rStart = roundStartT(r);
          const rRevealed = dt >= rStart + T.winnerRevealAt;
          const rArrowAt = rStart + T.arrowAppearAt;
          const rowAppear = clamp01((dt - rStart) / 0.5);
          if (rowAppear <= 0) return null;

          return (
            <div key={round.week} className="flex flex-col gap-1.5">
              <WeekRow
                round={round}
                r={r}
                dt={dt}
                rStart={rStart}
                rRevealed={rRevealed}
                rowAppear={rowAppear}
                reduced={reduce}
                winnerAdvancesTo={r < NR - 1 ? `Week ${round.week + 1}` : "Champion"}
              />
              {/* Advance arrow to next row (or to champion after row 3) */}
              <AdvanceArrow
                dt={dt}
                appearAt={rArrowAt}
                toChampion={r === NR - 1}
                winnerLabel={round.candidates[round.winnerIdx].label}
                nextTargetLabel={
                  r < NR - 1 ? `Week ${round.week + 1} · Test ${ROUNDS[r + 1].testing}` : "Champion combo scales"
                }
              />
            </div>
          );
        })}

        {/* Champion combo card */}
        <ChampionCard dt={dt} reduced={reduce} />
      </div>
    </div>
  );
}

/** One week's tournament — header + 3 candidates side-by-side. */
function WeekRow({
  round, r, dt, rStart, rRevealed, rowAppear, reduced, winnerAdvancesTo,
}: {
  round: Round; r: number; dt: number; rStart: number;
  rRevealed: boolean; rowAppear: number; reduced: boolean;
  winnerAdvancesTo: string;
}) {
  const inheritedWinners = ROUNDS.slice(0, r).map((p) => ({
    week: p.week,
    label: p.candidates[p.winnerIdx].label,
  }));
  return (
    <div
      className="pointer-events-auto"
      style={{ opacity: rowAppear, transform: reduced ? "none" : `translateY(${(1 - easeOut(rowAppear)) * 12}px)` }}
    >
      {/* Row header — compact single line */}
      <div className="flex flex-wrap items-center gap-1.5 mb-1">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-accent/10 border border-accent/40 px-2.5 py-0.5 backdrop-blur-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-accent" />
          <span className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-accent whitespace-nowrap">
            Week {round.week} · Test {round.testing}
          </span>
        </div>
        {inheritedWinners.length > 0 && (
          <>
            <span className="text-[8px] font-mono uppercase tracking-[0.16em] text-white/40">using:</span>
            {inheritedWinners.map((w) => (
              <span key={w.week} className="text-[9px] font-mono text-white/70 whitespace-nowrap">
                <span className="text-accent/80">W{w.week}</span> {w.label}
              </span>
            ))}
          </>
        )}
      </div>

      {/* 3 candidate cards side-by-side (responsive grid) */}
      <div className="grid grid-cols-3 gap-2">
        {round.candidates.map((c, i) => {
          const a0 = rStart + 0.15 + i * T.candidateStagger;
          const a = clamp01((dt - a0) / T.candidateDur);
          if (a <= 0) return <div key={i} />;
          const isWinner = i === round.winnerIdx;
          const showResult = rRevealed;
          const dim = showResult && !isWinner ? 0.4 : 1;

          const rampStart = rStart + T.metricRampAt;
          const mA = easeOut(clamp01((dt - rampStart) / T.metricRampDur));
          const shown = Math.round(c.metric * mA);

          return (
            <div
              key={i}
              className="min-w-0"
              style={{
                opacity: a * dim,
                transform: reduced ? "none" : `translateY(${(1 - easeOutBack(a)) * 10}px)`,
                transition: "opacity 0.5s ease",
              }}
            >
              <div
                className={[
                  "rounded-lg bg-ink-900/85 border pl-2.5 pr-2.5 py-1.5 backdrop-blur-sm h-full",
                  showResult && isWinner
                    ? "border-accent/70 shadow-[0_0_0_1px_rgba(255,90,77,0.24),0_6px_18px_rgba(255,90,77,0.2)]"
                    : "border-white/14",
                ].join(" ")}
              >
                <div className="flex items-center justify-between gap-1.5">
                  <div className="flex flex-col leading-tight min-w-0 flex-1">
                    <span className="text-[8px] font-mono uppercase tracking-[0.14em] text-white/45">
                      Cand {String.fromCharCode(65 + i)}
                    </span>
                    <span className="font-mono text-[10.5px] text-white whitespace-nowrap overflow-hidden text-ellipsis">
                      {c.label}
                    </span>
                  </div>
                  {showResult && isWinner && (
                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-accent/22 border border-accent/70 shrink-0 shadow-[0_0_8px_rgba(255,90,77,0.55)]">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
                        <path d="M6 3h12l-1 6a5 5 0 0 1-10 0L6 3z" stroke="#ff5a4d" strokeWidth="1.7" strokeLinejoin="round" />
                        <path d="M9 21h6M12 15v6" stroke="#ff5a4d" strokeWidth="1.7" strokeLinecap="round" />
                      </svg>
                    </span>
                  )}
                </div>
                <div className="mt-0.5 flex items-baseline gap-1">
                  <span
                    className={[
                      "font-display leading-none tabular-nums text-[15px]",
                      showResult && isWinner ? "text-accent" : "text-white/85",
                    ].join(" ")}
                  >
                    {shown}
                  </span>
                  <span className="text-[9px] font-mono text-white/45">{c.metricLabel}</span>
                  {showResult && isWinner && (
                    <span className="ml-auto text-[7.5px] font-mono uppercase tracking-[0.16em] text-accent bg-accent/12 border border-accent/40 px-1.5 py-[1px] rounded-full whitespace-nowrap">
                      → {winnerAdvancesTo}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * BIG unmissable "winner advances" indicator between rows. Center-stage pill
 * with the winning candidate's name + a large animated down-arrow with a
 * traveling glowing dot.
 */
function AdvanceArrow({
  dt, appearAt, toChampion, winnerLabel, nextTargetLabel,
}: {
  dt: number; appearAt: number; toChampion?: boolean; winnerLabel: string; nextTargetLabel: string;
}) {
  const a = clamp01((dt - appearAt) / 0.5);
  if (a <= 0) return <div style={{ height: 12 }} />;

  // Dot travels top->bottom over ~1s, then rests (seamless loop via mod)
  const cyclePeriod = 1.8;
  const cyclePhase = ((dt - appearAt) % cyclePeriod) / cyclePeriod;
  const dotActive = cyclePhase < 0.6;
  const dotProgress = dotActive ? cyclePhase / 0.6 : 0; // 0..1
  const dotFade = dotActive ? Math.sin(Math.PI * dotProgress) : 0;

  return (
    <div
      className="flex items-center justify-center gap-3 pointer-events-none py-0.5"
      style={{ opacity: a }}
    >
      {/* Left dashed spacer */}
      <div className="flex-1 border-t border-dashed border-accent/25" />

      {/* Compact single-line pill: trophy · winner · animated arrow · destination */}
      <div className="flex items-center gap-2.5 rounded-full bg-ink-900/90 border border-accent/50 px-3 py-1 backdrop-blur-md shadow-[0_0_14px_rgba(255,90,77,0.22)]">
        {/* Trophy icon */}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="shrink-0">
          <path d="M6 3h12l-1 6a5 5 0 0 1-10 0L6 3z" stroke="#ff5a4d" strokeWidth="1.8" strokeLinejoin="round" />
          <path d="M9 21h6M12 15v6" stroke="#ff5a4d" strokeWidth="1.8" strokeLinecap="round" />
        </svg>

        {/* Winner label inline */}
        <span className="font-mono text-[10px] text-white whitespace-nowrap">{winnerLabel}</span>

        {/* Compact horizontal arrow with traveling dot */}
        <div className="relative flex items-center shrink-0" style={{ width: 42, height: 12 }}>
          <div
            className="absolute left-0 right-2 top-1/2 -translate-y-1/2"
            style={{
              height: 2,
              background: "linear-gradient(90deg, rgba(255,90,77,0.35), rgba(255,90,77,0.9))",
              borderRadius: 1,
              boxShadow: "0 0 6px rgba(255,90,77,0.4)",
            }}
          />
          {/* Arrowhead */}
          <svg width="8" height="10" viewBox="0 0 8 10" className="absolute right-0 top-1/2 -translate-y-1/2" style={{ filter: "drop-shadow(0 0 4px rgba(255,90,77,0.6))" }}>
            <path d="M0 0L8 5L0 10Z" fill="#ff5a4d" />
          </svg>
          {/* Traveling dot */}
          {dotActive && (
            <div
              className="absolute top-1/2 rounded-full"
              style={{
                left: `${dotProgress * 34}px`,
                width: 6,
                height: 6,
                background: "#fff",
                boxShadow: `0 0 8px rgba(255,150,135,${0.9 * dotFade})`,
                opacity: dotFade,
                transform: "translate(-50%, -50%)",
              }}
            />
          )}
        </div>

        {/* Destination */}
        <span
          className={[
            "font-mono text-[9.5px] whitespace-nowrap",
            toChampion ? "text-accent font-bold" : "text-accent/85",
          ].join(" ")}
        >
          {toChampion ? "combines into Champion" : nextTargetLabel}
        </span>
      </div>

      {/* Right dashed spacer */}
      <div className="flex-1 border-t border-dashed border-accent/25" />
    </div>
  );
}

/** Champion combo card — the celebratory final payoff. Bigger, brighter, trophy front-and-center. */
function ChampionCard({ dt, reduced }: { dt: number; reduced: boolean }) {
  const a = clamp01((dt - T.championAt) / T.championDur);
  const winnerLabels = ROUNDS.map((r) => r.candidates[r.winnerIdx].label);
  return (
    <div
      className="pointer-events-auto"
      style={{
        opacity: a,
        transform: reduced ? "none" : `translateY(${(1 - easeOutBack(a)) * 16}px) scale(${lerp(0.94, 1, a)})`,
      }}
    >
      <div className="rounded-xl bg-gradient-to-br from-accent/18 via-accent/10 to-accent/5 border-2 border-accent/70 px-4 py-2.5 backdrop-blur-sm shadow-[0_0_24px_rgba(255,90,77,0.32)]">
        <div className="flex items-center gap-3">
          {/* Trophy */}
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-accent/22 border-2 border-accent/70 shrink-0 shadow-[0_0_10px_rgba(255,90,77,0.45)]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M6 3h12l-1 6a5 5 0 0 1-10 0L6 3z" stroke="#ff5a4d" strokeWidth="1.8" strokeLinejoin="round" fill="rgba(255,90,77,0.15)" />
              <path d="M9 21h6M12 15v6" stroke="#ff5a4d" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </span>

          {/* Title */}
          <div className="flex flex-col leading-tight shrink-0">
            <span className="font-mono text-[8.5px] uppercase tracking-[0.2em] text-accent/85">The winner</span>
            <span className="font-display text-[15px] text-white leading-tight">Champion campaign</span>
          </div>

          {/* Winners inline: L × O × CTA */}
          <div className="flex-1 flex items-center gap-2 min-w-0 border-l border-accent/25 pl-3 ml-1">
            {["List", "Offer", "CTA"].map((label, i) => (
              <div key={label} className="min-w-0 flex-1">
                <div className="text-[7.5px] font-mono uppercase tracking-[0.16em] text-accent/70">Best {label}</div>
                <div className="font-mono text-[10.5px] text-white leading-tight whitespace-nowrap overflow-hidden text-ellipsis">
                  {winnerLabels[i]}
                </div>
              </div>
            ))}
          </div>

          {/* Live status */}
          <span className="inline-flex items-center gap-1.5 text-[9px] font-mono uppercase tracking-[0.16em] text-accent bg-accent/12 border border-accent/45 px-2 py-1 rounded-full shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
            live · 3×
          </span>
        </div>
      </div>
    </div>
  );
}
