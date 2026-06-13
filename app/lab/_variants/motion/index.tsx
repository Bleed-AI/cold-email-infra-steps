"use client";

import { useEffect, useMemo, useState } from "react";
import {
  motion,
  useReducedMotion,
  type Variants,
  type Transition,
} from "framer-motion";
import type { SetupVariantProps } from "../../types";
import { buildSendingDomains, buildMailboxes } from "../../../lib/domains";

/**
 * MOTION-DESIGN ASSEMBLY — the isometric build.
 *
 * Where the cinematic reference is FLAT and reads left→right on one SVG
 * timeline, this direction is a layered, isometric product-explainer: panels
 * are stamped 2D cards floating on a tilted plane, and the whole system is
 * CONSTRUCTED by travel. The primary domain drops onto the conveyor at the
 * back, then forks into seven sending-domain panels that ride down an
 * isometric staircase into formation. Three mailbox tiles SLOT into each panel
 * from its right edge. Auth seals slide in from off-stage and stamp; SPF/DKIM/
 * DMARC checks pop. Redirect threads draw from every panel back up to the
 * primary, and the rig goes live with a count to 21.
 *
 * Construct, not reveal: every animated child travels (x/y) from a directional
 * source into its real layout slot. Isometric transforms live on WRAPPERS;
 * Framer animates x/y/scale on the CHILDREN inside them, so the two transform
 * systems never fight over one node.
 */

const DNS = ["SPF", "DKIM", "DMARC"] as const;
const PROVIDER_OF = (di: number) => (di === 3 ? "outlook" : "gmail");

// Ordered assembly beats. A single step state, advanced by timers, drives
// every subtree's variant — trivial to sequence, replay, and reduce.
const STEPS = {
  IDLE: 0,
  TITLE: 1, // title + primary seed lands on the conveyor
  FORK: 2, // seven domain panels travel down the staircase
  MAILBOXES: 3, // 3 mailbox tiles slot into each panel; counter climbs
  AUTH: 4, // seals slide in & stamp; SPF/DKIM/DMARC checks pop
  REDIRECT: 5, // redirect threads draw back to the primary
  LIVE: 6, // go-live glow + final state
} as const;
type Step = (typeof STEPS)[keyof typeof STEPS];

// Beat → delay-after (ms). Tuned so the whole sequence lands ~8.5s, matching
// the reference's density without dragging.
const BEAT_MS: Record<number, number> = {
  [STEPS.IDLE]: 250,
  [STEPS.TITLE]: 1100,
  [STEPS.FORK]: 1600,
  [STEPS.MAILBOXES]: 2000,
  [STEPS.AUTH]: 1500,
  [STEPS.REDIRECT]: 1100,
};

const SPRING: Transition = { type: "spring", stiffness: 260, damping: 26, mass: 0.9 };
const SPRING_SOFT: Transition = { type: "spring", stiffness: 180, damping: 22 };
const POP: Transition = { type: "spring", stiffness: 420, damping: 20, mass: 0.6 };

export default function MotionSetup({ businessName, slug, mainDomain }: SetupVariantProps) {
  const reduce = !!useReducedMotion();
  const [replayKey, setReplayKey] = useState(0);

  const domains = useMemo(() => buildSendingDomains(slug), [slug]);
  const mailboxes = useMemo(() => buildMailboxes(domains, 3), [domains]);

  return (
    <div className="relative h-full w-full overflow-hidden bg-ink-950">
      {/* Ambient background — loops gated on motion. */}
      <div className="absolute inset-0 bg-grid-fine opacity-[0.18]" />
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 90% at 50% 8%, rgba(124,92,255,0.12), transparent 55%), radial-gradient(90% 80% at 50% 118%, rgba(124,245,208,0.10), transparent 60%)",
        }}
      />
      <div className="noise" />

      <Assembly
        key={replayKey}
        reduce={reduce}
        businessName={businessName}
        mainDomain={mainDomain}
        domains={domains}
        mailboxes={mailboxes}
      />

      <ReplayBtn onClick={() => setReplayKey((n) => n + 1)} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The assembly subtree — remounted by key bump on replay.            */
/* ------------------------------------------------------------------ */

type AssemblyProps = {
  reduce: boolean;
  businessName: string;
  mainDomain: string;
  domains: string[];
  mailboxes: ReturnType<typeof buildMailboxes>;
};

function Assembly({ reduce, businessName, mainDomain, domains, mailboxes }: AssemblyProps) {
  const [step, setStep] = useState<Step>(reduce ? STEPS.LIVE : STEPS.IDLE);

  // Timer-driven beat spine. All timers are cleared on unmount so a replay
  // remount never gets double-fired by a stale timer from the old mount.
  useEffect(() => {
    if (reduce) {
      setStep(STEPS.LIVE);
      return;
    }
    const timers: ReturnType<typeof setTimeout>[] = [];
    let elapsed = 0;
    const order: Step[] = [
      STEPS.IDLE,
      STEPS.TITLE,
      STEPS.FORK,
      STEPS.MAILBOXES,
      STEPS.AUTH,
      STEPS.REDIRECT,
      STEPS.LIVE,
    ];
    // Schedule each beat at its cumulative offset.
    for (let i = 1; i < order.length; i++) {
      elapsed += BEAT_MS[order[i - 1]];
      const target = order[i];
      timers.push(setTimeout(() => setStep(target), elapsed));
    }
    return () => timers.forEach(clearTimeout);
  }, [reduce]);

  const live = step >= STEPS.LIVE;

  return (
    <div className="absolute inset-0">
      <TitlePanel businessName={businessName} step={step} reduce={reduce} live={live} />
      <AuthBoard step={step} reduce={reduce} />
      <Stage
        step={step}
        reduce={reduce}
        mainDomain={mainDomain}
        domains={domains}
        mailboxes={mailboxes}
        live={live}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Title + counter (top-left).                                        */
/* ------------------------------------------------------------------ */

function TitlePanel({
  businessName,
  step,
  reduce,
  live,
}: {
  businessName: string;
  step: Step;
  reduce: boolean;
  live: boolean;
}) {
  const show = step >= STEPS.TITLE;
  const lineV: Variants = {
    hidden: { opacity: 0, x: reduce ? 0 : -26 },
    show: { opacity: 1, x: 0 },
  };
  return (
    <div className="absolute top-10 left-10 z-30 max-w-[330px] select-none md:top-12 md:left-12">
      <motion.div
        className="chip mb-4"
        variants={lineV}
        initial="hidden"
        animate={show ? "show" : "hidden"}
        transition={SPRING_SOFT}
      >
        <span className="dot" /> Step 01 · Setup · ~1 day
      </motion.div>

      <h2 className="font-display text-[28px] leading-[0.98] tracking-[-0.02em] md:text-[38px]">
        <motion.span
          className="block text-gradient"
          variants={lineV}
          initial="hidden"
          animate={show ? "show" : "hidden"}
          transition={{ ...SPRING_SOFT, delay: reduce ? 0 : 0.05 }}
        >
          We assemble {businessName}&apos;s
        </motion.span>
        <motion.span
          className="block text-gradient-accent"
          variants={lineV}
          initial="hidden"
          animate={show ? "show" : "hidden"}
          transition={{ ...SPRING_SOFT, delay: reduce ? 0 : 0.13 }}
        >
          sending infrastructure.
        </motion.span>
      </h2>

      {/* Counter — climbs to 21 as the mailboxes slot in. */}
      <motion.div
        className="mt-5 flex items-end gap-2"
        variants={lineV}
        initial="hidden"
        animate={step >= STEPS.MAILBOXES ? "show" : "hidden"}
        transition={SPRING_SOFT}
      >
        <Counter target={21} run={step >= STEPS.MAILBOXES} reduce={reduce} />
        <span className="pb-1.5 text-[11px] font-mono leading-tight text-white/45">
          mailboxes
          <br />7 domains × 3
        </span>
      </motion.div>

      {/* Zapmail provenance. */}
      <motion.div
        className="mt-4 inline-flex items-center gap-2 chip"
        variants={lineV}
        initial="hidden"
        animate={step >= STEPS.MAILBOXES ? "show" : "hidden"}
        transition={{ ...SPRING_SOFT, delay: reduce ? 0 : 0.08 }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logos/zapmail.png"
          alt=""
          width={14}
          height={14}
          style={{ width: 14, height: 14 }}
          className="object-contain"
        />
        provisioned via Zapmail
      </motion.div>

      {/* Go-live badge. */}
      <motion.div
        className="mt-5 inline-flex items-center gap-2 rounded-full border border-accent/40 bg-accent/[0.08] px-3 py-1.5 text-[10px] font-mono uppercase tracking-[0.18em] text-accent/90"
        initial={{ opacity: 0, y: reduce ? 0 : 12 }}
        animate={live ? { opacity: 1, y: 0 } : { opacity: 0, y: reduce ? 0 : 12 }}
        transition={SPRING_SOFT}
      >
        <motion.span
          className="h-1.5 w-1.5 rounded-full bg-accent"
          style={{ boxShadow: "0 0 10px #7cf5d0" }}
          animate={live && !reduce ? { opacity: [1, 0.35, 1] } : { opacity: 1 }}
          transition={live && !reduce ? { duration: 1.6, repeat: Infinity, ease: "easeInOut" } : undefined}
        />
        live &amp; redirecting
      </motion.div>
    </div>
  );
}

function Counter({ target, run, reduce }: { target: number; run: boolean; reduce: boolean }) {
  const [val, setVal] = useState(reduce ? target : 0);
  useEffect(() => {
    if (!run) return;
    if (reduce) {
      setVal(target);
      return;
    }
    let raf = 0;
    const dur = 1500;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / dur);
      // easeOut for a satisfying settle.
      const eased = 1 - Math.pow(1 - t, 3);
      setVal(Math.round(eased * target));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [run, reduce, target]);
  return <span className="font-display text-[44px] leading-none text-white tabular-nums">{val}</span>;
}

/* ------------------------------------------------------------------ */
/* Authentication board (top-right) — seals slide in and stamp.       */
/* ------------------------------------------------------------------ */

function AuthBoard({ step, reduce }: { step: Step; reduce: boolean }) {
  const show = step >= STEPS.AUTH;
  return (
    <div className="absolute top-10 right-10 z-30 flex flex-col items-end gap-2 md:top-12 md:right-12">
      <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/35">Authentication</div>
      <div className="flex gap-2">
        {DNS.map((rec, i) => (
          <motion.span
            key={rec}
            className="inline-flex items-center gap-1.5 rounded-md border border-violet-glow/45 bg-violet-glow/10 px-2.5 py-1.5 text-[11px] font-mono text-violet-glow"
            initial={{ opacity: 0, x: reduce ? 0 : 180, rotate: reduce ? 0 : 6 }}
            animate={
              show
                ? { opacity: 1, x: 0, rotate: 0, scale: reduce ? 1 : [1, 1.16, 1] }
                : { opacity: 0, x: reduce ? 0 : 180, rotate: reduce ? 0 : 6 }
            }
            transition={
              reduce
                ? { duration: 0 }
                : { ...SPRING, delay: i * 0.14, scale: { delay: i * 0.14 + 0.25, duration: 0.28 } }
            }
          >
            <span className="text-accent">✓</span>
            {rec}
          </motion.span>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The isometric stage — primary seed + staircase of domain panels.   */
/* ------------------------------------------------------------------ */

// Isometric plane params. Tuned so all 7 panels + primary fit ~720p tall with
// no scroll. The plane wrapper carries the 3D tilt; children travel on top.
const ISO = {
  perspective: 1400,
  rotateX: 34,
  rotateZ: -28,
};

function Stage({
  step,
  reduce,
  mainDomain,
  domains,
  mailboxes,
  live,
}: {
  step: Step;
  reduce: boolean;
  mainDomain: string;
  domains: string[];
  mailboxes: ReturnType<typeof buildMailboxes>;
  live: boolean;
}) {
  const showFork = step >= STEPS.FORK;
  const showRedirect = step >= STEPS.REDIRECT;

  // Staircase layout in plane-local coordinates. Each panel steps down-right.
  // Index → {x,y} offset (px) inside the iso plane; the primary sits at top.
  // STEP_Y is tuned so all 7 panels + the deck clear a ~720p viewport with the
  // isometric tilt; the plane is lifted up so the staircase centers vertically.
  const STEP_X = 22;
  const STEP_Y = 70;

  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
      {/* Iso plane wrapper: carries perspective + 3D tilt only. Framer never
          touches this node's transform, so the isometric look is stable.
          translateY lifts the deck so the downward staircase reads centered. */}
      <div
        style={{
          perspective: `${ISO.perspective}px`,
          perspectiveOrigin: "50% 42%",
          transform: "translateY(-58px)",
        }}
        className="relative"
      >
        <div
          style={{
            transformStyle: "preserve-3d",
            transform: `rotateX(${ISO.rotateX}deg) rotateZ(${ISO.rotateZ}deg)`,
          }}
          className="relative"
        >
          {/* Conveyor deck under the panels — depth shadow / build surface. */}
          <motion.div
            className="absolute rounded-2xl"
            style={{
              left: -150,
              top: -70,
              width: 640,
              height: STEP_Y * domains.length + 150,
              background:
                "linear-gradient(180deg, rgba(124,92,255,0.06), rgba(124,245,208,0.04))",
              border: "1px solid rgba(255,255,255,0.06)",
              boxShadow: "0 60px 120px -40px rgba(0,0,0,0.8)",
            }}
            initial={{ opacity: 0, scale: reduce ? 1 : 0.94 }}
            animate={step >= STEPS.TITLE ? { opacity: 1, scale: 1 } : { opacity: 0, scale: reduce ? 1 : 0.94 }}
            transition={SPRING_SOFT}
          />

          {/* Connector threads: primary → each panel (feed) and panel →
              primary (redirect). Drawn in plane space so they tilt with it. */}
          <ConnectorLayer
            count={domains.length}
            stepX={STEP_X}
            stepY={STEP_Y}
            showFeed={showFork}
            showRedirect={showRedirect}
            reduce={reduce}
          />

          {/* Primary domain — the source. Drops in from above the deck. */}
          <PrimaryPanel mainDomain={mainDomain} step={step} reduce={reduce} live={live} />

          {/* Seven sending-domain panels travel down the staircase. */}
          {domains.map((d, di) => (
            <DomainPanel
              key={d}
              domain={d}
              index={di}
              stepX={STEP_X}
              stepY={STEP_Y}
              provider={PROVIDER_OF(di)}
              mailboxes={mailboxes.slice(di * 3, di * 3 + 3)}
              step={step}
              reduce={reduce}
              showFork={showFork}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/* Primary domain card — sits at the head of the staircase. */
function PrimaryPanel({
  mainDomain,
  step,
  reduce,
  live,
}: {
  mainDomain: string;
  step: Step;
  reduce: boolean;
  live: boolean;
}) {
  const show = step >= STEPS.TITLE;
  return (
    <div
      className="absolute"
      style={{ left: -32, top: -64, transformStyle: "preserve-3d" }}
    >
      <motion.div
        initial={{ opacity: 0, y: reduce ? 0 : -160, z: reduce ? 0 : 120, scale: reduce ? 1 : 0.6 }}
        animate={
          show
            ? { opacity: 1, y: 0, z: 40, scale: 1 }
            : { opacity: 0, y: reduce ? 0 : -160, z: reduce ? 0 : 120, scale: reduce ? 1 : 0.6 }
        }
        transition={reduce ? { duration: 0 } : { ...SPRING, stiffness: 220 }}
        className="relative flex items-center gap-2.5 rounded-xl border border-accent/55 bg-accent/[0.10] px-4 py-3 font-mono backdrop-blur-sm"
        style={{
          boxShadow: live
            ? "0 0 50px rgba(124,245,208,0.45), 0 24px 50px -20px rgba(0,0,0,0.9)"
            : "0 24px 50px -20px rgba(0,0,0,0.9)",
          transition: "box-shadow 0.6s ease",
        }}
      >
        <span
          className="h-2.5 w-2.5 rounded-full bg-accent"
          style={{ boxShadow: "0 0 12px #7cf5d0" }}
        />
        <div className="leading-tight">
          <div className="text-[14px] text-white">{mainDomain}</div>
          <div className="text-[9px] uppercase tracking-[0.22em] text-accent/70">primary domain · source</div>
        </div>
      </motion.div>
    </div>
  );
}

/* A single sending-domain panel + its three mailbox tiles. */
function DomainPanel({
  domain,
  index,
  stepX,
  stepY,
  provider,
  mailboxes,
  step,
  reduce,
  showFork,
}: {
  domain: string;
  index: number;
  stepX: number;
  stepY: number;
  provider: string;
  mailboxes: ReturnType<typeof buildMailboxes>;
  step: Step;
  reduce: boolean;
  showFork: boolean;
}) {
  // Final slot of this panel inside the iso plane.
  const finalX = index * stepX;
  const finalY = index * stepY;

  // Travel source: stacked at the primary's position (top of staircase), so
  // panels visibly fork OUT and ride down into formation.
  const fromX = -28 - finalX;
  const fromY = -52 - finalY;

  const showMailboxes = step >= STEPS.MAILBOXES;
  const showAuth = step >= STEPS.AUTH;

  return (
    <div className="absolute left-0 top-0" style={{ transformStyle: "preserve-3d" }}>
      <motion.div
        initial={{
          x: reduce ? finalX : fromX,
          y: reduce ? finalY : fromY,
          z: reduce ? 0 : 90,
          opacity: 0,
          scale: reduce ? 1 : 0.4,
        }}
        animate={
          showFork
            ? { x: finalX, y: finalY, z: 0, opacity: 1, scale: 1 }
            : {
                x: reduce ? finalX : fromX,
                y: reduce ? finalY : fromY,
                z: reduce ? 0 : 90,
                opacity: 0,
                scale: reduce ? 1 : 0.4,
              }
        }
        transition={reduce ? { duration: 0 } : { ...SPRING, delay: index * 0.09 }}
        className="relative"
        style={{ transformStyle: "preserve-3d" }}
      >
        <div
          className="flex items-center gap-2.5 rounded-lg border border-white/10 bg-white/[0.045] px-3 py-2 backdrop-blur-sm"
          style={{ boxShadow: "0 18px 36px -18px rgba(0,0,0,0.85)" }}
        >
          {/* Provider logo + auth check stamp. */}
          <div className="relative shrink-0">
            <motion.span
              className="absolute -left-1.5 -top-1.5 z-10 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-[9px] font-bold text-ink-950"
              style={{ boxShadow: "0 0 10px #7cf5d0" }}
              initial={{ scale: reduce ? 1 : 0, opacity: reduce ? 1 : 0 }}
              animate={showAuth ? { scale: 1, opacity: 1 } : { scale: reduce ? 1 : 0, opacity: reduce ? 1 : 0 }}
              transition={reduce ? { duration: 0 } : { ...POP, delay: index * 0.05 }}
            >
              ✓
            </motion.span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/logos/${provider}.png`}
              alt={provider}
              width={18}
              height={18}
              style={{ width: 18, height: 18 }}
              className="object-contain"
            />
          </div>

          <div className="w-[136px] shrink-0 truncate font-mono text-[12px] text-white">{domain}</div>

          {/* Mailbox tiles slot in from the panel's right edge. */}
          <div className="flex items-center gap-1.5">
            {mailboxes.map((m, mi) => (
              <motion.span
                key={mi}
                className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-ink-900/80 py-1 pl-1 pr-2"
                title={m.handle}
                initial={{ x: reduce ? 0 : 40, opacity: 0, scale: reduce ? 1 : 0.3 }}
                animate={
                  showMailboxes
                    ? { x: 0, opacity: 1, scale: 1 }
                    : { x: reduce ? 0 : 40, opacity: 0, scale: reduce ? 1 : 0.3 }
                }
                transition={
                  reduce ? { duration: 0 } : { ...POP, delay: index * 0.05 + mi * 0.07 }
                }
              >
                <span
                  className="flex h-5 w-5 items-center justify-center rounded-full text-[8px] font-mono text-white"
                  style={{ background: `conic-gradient(from ${m.hue}deg, #7cf5d0, #7c5cff, #7cf5d0)` }}
                >
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-ink-900">
                    {m.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")}
                  </span>
                </span>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/logos/${provider}.png`}
                  alt=""
                  width={11}
                  height={11}
                  style={{ width: 11, height: 11 }}
                  className="object-contain opacity-90"
                />
              </motion.span>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Connector threads drawn in iso-plane space (SVG, animated draw).   */
/* ------------------------------------------------------------------ */

function ConnectorLayer({
  count,
  stepX,
  stepY,
  showFeed,
  showRedirect,
  reduce,
}: {
  count: number;
  stepX: number;
  stepY: number;
  showFeed: boolean;
  showRedirect: boolean;
  reduce: boolean;
}) {
  // SVG sized to cover the staircase, positioned in plane-local space.
  const W = 360;
  const H = stepY * count + 140;
  const OX = 150; // svg left offset inside plane
  const OY = 70; // svg top offset inside plane

  // Primary anchor (matches PrimaryPanel left/top + a little inset), in svg space.
  const px = -32 + OX + 30;
  const py = -64 + OY + 24;

  return (
    <svg
      className="absolute"
      style={{ left: -OX, top: -OY, transformStyle: "preserve-3d" }}
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      fill="none"
    >
      <defs>
        <linearGradient id="motionFeed" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#7cf5d0" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#7c5cff" stopOpacity="0.5" />
        </linearGradient>
      </defs>
      {Array.from({ length: count }).map((_, i) => {
        // Panel anchor in svg space.
        const dx = i * stepX + OX + 8;
        const dy = i * stepY + OY + 16;
        const midY = (py + dy) / 2;
        const feed = `M ${px} ${py} C ${px} ${midY}, ${dx} ${midY}, ${dx} ${dy}`;
        const back = `M ${dx + 40} ${dy + 6} C ${dx + 40} ${midY + 30}, ${px + 36} ${midY + 30}, ${px + 8} ${py + 8}`;
        return (
          <g key={i}>
            <motion.path
              d={feed}
              stroke="url(#motionFeed)"
              strokeWidth={1.4}
              initial={{ pathLength: reduce ? 1 : 0, opacity: reduce ? 0.8 : 0 }}
              animate={
                showFeed
                  ? { pathLength: 1, opacity: 0.8 }
                  : { pathLength: reduce ? 1 : 0, opacity: reduce ? 0.8 : 0 }
              }
              transition={reduce ? { duration: 0 } : { duration: 0.6, delay: i * 0.08, ease: "easeInOut" }}
            />
            <motion.path
              d={back}
              stroke="rgba(124,92,255,0.55)"
              strokeWidth={1.1}
              strokeDasharray="3 4"
              initial={{ pathLength: reduce ? 1 : 0, opacity: reduce ? 0.6 : 0 }}
              animate={
                showRedirect
                  ? { pathLength: 1, opacity: 0.6 }
                  : { pathLength: reduce ? 1 : 0, opacity: reduce ? 0.6 : 0 }
              }
              transition={reduce ? { duration: 0 } : { duration: 0.5, delay: i * 0.06, ease: "easeInOut" }}
            />
          </g>
        );
      })}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Replay button (bottom-right, global glass).                        */
/* ------------------------------------------------------------------ */

function ReplayBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="absolute bottom-6 right-6 z-40 inline-flex items-center gap-2 rounded-full glass px-4 py-2.5 text-[11px] font-mono uppercase tracking-[0.18em] text-white/70 transition hover:text-accent"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
        <path
          d="M3 12a9 9 0 1 0 3-6.7M3 4v4h4"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      Replay
    </button>
  );
}
