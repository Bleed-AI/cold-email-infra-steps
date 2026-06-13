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
import { ProviderLogo, type Provider } from "../lab/engine/ProviderLogo";
import { buildProspects, PER_INBOX_PER_DAY } from "./prospects";

// ── Beat timeline (seconds). Everything is a pure function of these. ──
const T = {
  // Beat 1 — campaign goes live in Instantly
  campaignIn: [0.2, 1.4] as [number, number],
  inboxGridStart: 0.9,
  inboxGridStagger: 0.045, // ×21 ≈ 0.95s to fill the grid
  inboxGridDur: 0.5,
  // Beat 2 — metered sending begins
  sendStart: 2.6,
  sendEnd: 13.6, // emission runs to DURATION — sending never dies during the live hold
  // Beat 3/4 — prospects receive + replies route back
  receiveStart: 4.2,
  receivePer: 0.95, // per-prospect arrival cadence
  // steady-state summary settles
  summaryStart: 11.9,
};
const DURATION = 13.6;

const N_DOMAINS = 7;
const N_INBOXES = 21;
const N_PROSPECTS = 7;

// Metered cadence: how many emails "released" across the whole emission window.
// Counter = floor(rate * elapsed) — discrete, paced, never a flood.
const SENT_TOTAL = 312;
const SEND_WINDOW = T.sendEnd - T.sendStart;
const SEND_RATE = SENT_TOTAL / SEND_WINDOW; // emails/sec on screen
const PARTICLE_TRANSIT = 1.15; // sec a single packet takes to cross center

const providerOf = (i: number): Provider => (i % 7 === 3 ? "outlook" : "gmail");

// emails sent at display-time t (pure, monotonic, clamped)
function sentAt(t: number) {
  if (t < T.sendStart) return 0;
  const elapsed = Math.min(t, T.sendEnd) - T.sendStart;
  return Math.min(SENT_TOTAL, Math.floor(elapsed * SEND_RATE));
}

type Layout = {
  w: number;
  h: number;
  campaign: { x: number; y: number };
  grid: { x: number; y: number };
  gridCell: { w: number; h: number; cols: number };
  prospects: { x: number; y: number }[];
  panel: { x: number; y: number };
};

export default function SendingScreen({ businessName, slug, mainDomain, deckHandleRef, onDone }: ScreenProps) {
  const reduce = !!useReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const layoutRef = useRef<Layout | null>(null);
  const lastTRef = useRef(0);
  const [dt, setDt] = useState(0);
  const [replayKey, setReplayKey] = useState(0);

  const domainNames = useMemo(() => buildSendingDomains(slug), [slug]);
  const inboxes = useMemo(() => buildMailboxes(domainNames, 3), [domainNames]);
  const prospects = useMemo(() => buildProspects(), []);

  const steps: NarrationStep[] = useMemo(
    () => [
      {
        n: "01",
        title: "Campaign goes live",
        detail: (
          <p>
            After warm-up, {businessName}&apos;s first campaign launches in{" "}
            <span className="text-white/80">Instantly</span> across all 21 mailboxes.
          </p>
        ),
      },
      {
        n: "02",
        title: "Sent at a safe cadence",
        detail: (
          <p>
            Around {PER_INBOX_PER_DAY} emails per inbox per day, spaced out — never a blast — so
            providers keep trusting your domains.
          </p>
        ),
      },
      {
        n: "03",
        title: "Landing in the inbox",
        detail: (
          <p>
            Because the domains are warmed and authenticated, messages land in the primary inbox,
            not spam.
          </p>
        ),
      },
      {
        n: "04",
        title: "Replies route back to you",
        detail: (
          <p>
            Positive replies come straight back to{" "}
            <span className="text-white/80">you@{mainDomain}</span>, and sending auto-pauses on reply
            so no prospect is ever double-messaged.
          </p>
        ),
      },
    ],
    [businessName, mainDomain]
  );

  // ── layout from container size ──
  const computeLayout = useCallback(() => {
    const root = rootRef.current;
    if (!root) return;
    const w = root.clientWidth;
    const h = root.clientHeight;

    // Stage lives clear of the narration rail (left 34%). Use 0.40 → 1.0.
    const campaign = { x: w * 0.475, y: h * 0.235 };
    const gridCols = 3;
    const gridCellW = Math.min(64, w * 0.052);
    const gridCellH = 30;
    const grid = { x: w * 0.475, y: h * 0.58 }; // top-left anchor of inbox grid

    // prospects column on the right
    const pTop = h * 0.165;
    const pBot = h * 0.86;
    const stepY = N_PROSPECTS > 1 ? (pBot - pTop) / (N_PROSPECTS - 1) : 0;
    const prospects = Array.from({ length: N_PROSPECTS }, (_, i) => ({
      x: w * 0.84,
      y: pTop + stepY * i,
    }));

    layoutRef.current = {
      w,
      h,
      campaign,
      grid,
      gridCell: { w: gridCellW, h: gridCellH, cols: gridCols },
      prospects,
      panel: { x: w * 0.84, y: h * 0.5 },
    };
  }, []);

  // position of inbox tile i (center) in canvas px
  const inboxPos = (L: Layout, i: number) => {
    const { cols, w: cw, h: ch } = L.gridCell;
    const col = i % cols;
    const row = Math.floor(i / cols);
    const gap = 8;
    return {
      x: L.grid.x + col * (cw + gap) + cw / 2,
      y: L.grid.y + row * (ch + gap) + ch / 2,
    };
  };

  // ── canvas: campaign glow + metered packet stream + receive pulses (pure fn of t) ──
  const drawCanvas = useCallback(
    (t: number) => {
      const ctx = ctxRef.current;
      const L = layoutRef.current;
      if (!ctx || !L) return;
      const { w, h, campaign, prospects: pros } = L;
      ctx.clearRect(0, 0, w, h);

      // campaign card glow
      const cIn = easeOut(seg(t, T.campaignIn[0], T.campaignIn[1]));
      if (cIn > 0) {
        const g = ctx.createRadialGradient(campaign.x, campaign.y, 0, campaign.x, campaign.y, 120);
        g.addColorStop(0, `rgba(124,92,255,${0.18 * cIn})`);
        g.addColorStop(1, "rgba(124,92,255,0)");
        ctx.fillStyle = g;
        ctx.fillRect(campaign.x - 130, campaign.y - 130, 260, 260);
      }

      // emission "source" point — center of the inbox grid block
      const rows = Math.ceil(N_INBOXES / L.gridCell.cols);
      const src = {
        x: L.grid.x + (L.gridCell.cols * (L.gridCell.w + 8)) / 2,
        y: L.grid.y + (rows * (L.gridCell.h + 8)) / 2 - L.gridCell.h / 2,
      };

      // faint guide lines from the inbox block toward each prospect (the "lanes")
      const lanesOn = easeOut(seg(t, T.sendStart - 0.4, T.sendStart + 0.8));
      if (lanesOn > 0) {
        for (let p = 0; p < pros.length; p++) {
          const d = pros[p];
          const midx = (src.x + d.x) / 2;
          ctx.beginPath();
          ctx.moveTo(src.x, src.y);
          ctx.bezierCurveTo(midx, src.y, midx, d.y, d.x - 14, d.y);
          ctx.strokeStyle = `rgba(124,245,208,${0.07 * lanesOn})`;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }

      // ── metered packet stream: discrete emissions, one every 1/EMIT_RATE sec ──
      // Visual emission rate is gentler than the counter rate so it reads "paced".
      const EMIT_RATE = 4.2; // packets/sec on screen — rhythmic, not a flood
      if (t > T.sendStart) {
        const firstK = Math.max(0, Math.ceil((t - PARTICLE_TRANSIT - T.sendStart) * EMIT_RATE));
        const lastK = Math.floor((Math.min(t, T.sendEnd + 0.001) - T.sendStart) * EMIT_RATE);
        for (let k = firstK; k <= lastK; k++) {
          const emit = T.sendStart + k / EMIT_RATE;
          const f = (t - emit) / PARTICLE_TRANSIT;
          if (f <= 0 || f >= 1) continue;
          // deterministic lane + small vertical offset from index k (no randomness)
          const lane = k % pros.length;
          const d = pros[lane];
          const jitter = ((k * 53) % 13) / 13 - 0.5; // [-0.5,0.5) from index
          const sy = src.y + jitter * 22;
          const dy = d.y + jitter * 6;
          const midx = (src.x + d.x) / 2;
          const x = bez(src.x, midx, midx, d.x - 16, f);
          const y = bez(sy, sy, dy, dy, f);
          const fade = Math.sin(Math.PI * f); // bright mid-flight
          // little envelope packet (a soft glowing dot — text stays in the DOM)
          ctx.beginPath();
          ctx.arc(x, y, 2.1, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(164,255,225,${0.9 * fade})`;
          ctx.fill();
          ctx.beginPath();
          ctx.arc(x, y, 4.2, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(124,245,208,${0.16 * fade})`;
          ctx.fill();
        }
      }

      // receive pulses at each prospect as their mail lands
      for (let p = 0; p < pros.length; p++) {
        const arrive = T.receiveStart + p * T.receivePer;
        const pulse = clamp01((t - arrive) / 0.7);
        if (pulse > 0 && pulse < 1) {
          const d = pros[p];
          ctx.beginPath();
          ctx.arc(d.x - 8, d.y, 6 + pulse * 26, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(124,245,208,${0.5 * (1 - pulse)})`;
          ctx.lineWidth = 2;
          ctx.stroke();
        }
        // reply spark travelling back for repliers
        if (pros[p] && prospects[p]?.replies) {
          const replyAt = arrive + 0.9;
          const rf = (t - replyAt) / 1.0;
          if (rf > 0 && rf < 1) {
            const d = pros[p];
            const midx = (src.x + d.x) / 2;
            const x = bez(d.x - 16, midx, midx, src.x, rf);
            const y = bez(d.y, d.y, src.y, src.y, rf);
            const fade = Math.sin(Math.PI * rf);
            ctx.beginPath();
            ctx.arc(x, y, 2.4, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(124,92,255,${0.95 * fade})`;
            ctx.fill();
          }
        }
      }
    },
    [prospects]
  );

  const onFrame = useCallback(
    (t: number) => {
      lastTRef.current = t;
      drawCanvas(t);
      setDt(t);
    },
    [drawCanvas]
  );

  // canvas setup + resize (runs BEFORE useScrubClock autoplay below)
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
  }, [computeLayout, drawCanvas, replayKey]);

  const controls = useScrubClock(onFrame, { duration: DURATION, reduced: reduce, autoPlay: !deckHandleRef, onDone });
  useDeckHandle(controls, deckHandleRef);

  // ── derived overlay state from display-time ──
  const liveInboxes = (() => {
    let c = 0;
    for (let i = 0; i < N_INBOXES; i++) {
      if (dt >= T.inboxGridStart + i * T.inboxGridStagger) c++;
    }
    return c;
  })();
  const campaignLive = dt >= T.campaignIn[1] - 0.2;
  const sent = sentAt(dt);
  const replyShown = (p: number) =>
    prospects[p]?.replies && dt >= T.receiveStart + p * T.receivePer + 1.9;
  const repliesSoFar = prospects.reduce(
    (acc, _, p) => acc + (replyShown(p) ? 1 : 0),
    0
  );
  const steady = dt >= T.summaryStart;

  // Headings reveal as their visual beat plays:
  //  1 launch → 2 metered send (~sendStart) → 3 first landing (~receiveStart)
  //  → 4 first reply spark (index-1 replier launches at arrive+0.9 ≈ 6.05).
  const activeNarration =
    dt >= 6.0
      ? 4
      : dt >= T.receiveStart - 0.2
      ? 3
      : dt >= T.sendStart - 0.2
      ? 2
      : dt >= 0.4
      ? 1
      : 0;

  const L = layoutRef.current;
  const pct = (v: number, total: number) => `${(v / total) * 100}%`;

  return (
    <div ref={rootRef} className="relative h-full w-full overflow-hidden bg-ink-950">
      <div className="absolute inset-0 bg-grid-fine opacity-[0.16]" />
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(70% 60% at 60% 50%, rgba(124,245,208,0.07), transparent 60%)",
        }}
      />
      <div className="noise" />
      <canvas ref={canvasRef} className="absolute inset-0" />

      {/* narration rail */}
      <NarrationRail
        eyebrow={
          <>
            <span className="dot" /> Step 05 · Live sending
          </>
        }
        headline={
          <>
            <span className="text-gradient">We go live</span>
            <br />
            <span className="text-gradient-accent">and the replies come in.</span>
          </>
        }
        steps={steps}
        activeCount={activeNarration}
        reduced={reduce}
      />

      {/* live "emails sent" counter chip */}
      <div className="absolute top-10 right-10 z-30 flex items-center gap-2 chip">
        <span className="w-1.5 h-1.5 rounded-full bg-accent shadow-[0_0_10px_#7cf5d0] animate-pulse" />
        <span className="font-display text-[20px] text-white leading-none tabular-nums">
          {sent.toLocaleString()}
        </span>
        <span className="text-white/45">emails sent</span>
      </div>

      {L && (
        <>
          {/* ── LEFT: Instantly campaign-live card ── */}
          <div
            className="absolute z-20"
            style={{
              left: pct(L.campaign.x, L.w),
              top: pct(L.campaign.y, L.h),
              transform: `translate(-50%,-50%) scale(${
                reduce ? 1 : lerp(0.82, 1, clamp01(seg(dt, T.campaignIn[0], T.campaignIn[1])))
              })`,
              opacity: clamp01(seg(dt, T.campaignIn[0], T.campaignIn[1])),
              width: "min(300px, 24vw)",
            }}
          >
            <div className="rounded-2xl glass p-4 shadow-[0_20px_60px_rgba(0,0,0,0.5)]">
              <div className="flex items-center gap-2.5 mb-3">
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-white shrink-0 shadow-[0_1px_4px_rgba(0,0,0,0.4)]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/logos/instantly.png"
                    alt="Instantly"
                    width={20}
                    height={20}
                    style={{ width: 20, height: 20 }}
                    className="object-contain"
                  />
                </span>
                <div className="leading-tight min-w-0">
                  <div className="font-mono text-[13px] text-white truncate">Instantly</div>
                  <div className="text-[10px] text-white/45 truncate">
                    {businessName} · cold outreach
                  </div>
                </div>
                <span
                  className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-accent/15 border border-accent/40 px-2.5 py-1 text-[10px] font-mono text-accent transition-opacity"
                  style={{ opacity: campaignLive ? 1 : 0 }}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" /> LIVE
                </span>
              </div>
              <div className="space-y-1.5 text-[12px] font-mono text-white/65">
                <Row label="Campaign" value="Q3 · Founders" />
                <Row label="Mailboxes" value={`${liveInboxes} / ${N_INBOXES}`} />
                <Row
                  label="Status"
                  value={campaignLive ? "Sending" : "Starting…"}
                  accent={campaignLive}
                />
              </div>
            </div>
          </div>

          {/* ── LEFT: the 21 sending inboxes (compact provider-dot grid) ── */}
          <div
            className="absolute z-20"
            style={{
              left: pct(L.grid.x, L.w),
              top: pct(L.grid.y, L.h),
            }}
          >
            <div
              className="grid"
              style={{
                gridTemplateColumns: `repeat(${L.gridCell.cols}, ${L.gridCell.w}px)`,
                gap: 8,
              }}
            >
              {inboxes.map((m, i) => {
                const a = clamp01(
                  seg(dt, T.inboxGridStart + i * T.inboxGridStagger, T.inboxGridStart + i * T.inboxGridStagger + T.inboxGridDur)
                );
                const sending = dt >= T.sendStart && i % 3 === Math.floor(dt * 2.5) % 3;
                return (
                  <div
                    key={m.handle}
                    className="flex items-center gap-1.5 rounded-md bg-ink-800/85 border border-white/10 px-1.5"
                    style={{
                      height: L.gridCell.h,
                      opacity: a,
                      transform: `scale(${reduce ? 1 : lerp(0.6, 1, easeOutBack(a))})`,
                    }}
                    title={m.handle}
                  >
                    <ProviderLogo provider={providerOf(i)} size={16} />
                    <span
                      className="w-1 h-1 rounded-full shrink-0"
                      style={{
                        background: "#7cf5d0",
                        boxShadow: sending ? "0 0 8px #7cf5d0" : "none",
                        opacity: sending ? 1 : 0.4,
                        transition: "opacity .15s",
                      }}
                    />
                  </div>
                );
              })}
            </div>
            <div className="mt-2 text-[9px] font-mono uppercase tracking-[0.18em] text-white/35">
              21 mailboxes · {N_DOMAINS} domains
            </div>
          </div>

          {/* ── CENTER: cadence gauge (sits in the clear flow lane between the
                 inbox grid and the prospect column, labelling the metered stream) ── */}
          <div
            className="absolute z-20"
            style={{
              left: "69%",
              top: "50%",
              transform: "translate(-50%,-50%)",
              opacity: clamp01(seg(dt, T.sendStart - 0.3, T.sendStart + 0.9)),
            }}
          >
            <CadenceGauge active={dt >= T.sendStart} />
          </div>

          {/* ── RIGHT: prospect receive rows ── */}
          {L.prospects.map((p, i) => {
            const arrive = T.receiveStart + i * T.receivePer;
            const a = clamp01(seg(dt, arrive - 0.55, arrive + 0.1)); // slide in just before landing
            const landed = dt >= arrive + 0.45;
            const replied = replyShown(i);
            return (
              <div
                key={i}
                className="absolute z-20"
                style={{
                  left: pct(p.x, L.w),
                  top: pct(p.y, L.h),
                  transform: `translate(-50%,-50%) translateX(${(1 - easeOut(a)) * 26}px)`,
                  opacity: a,
                  width: "min(252px, 20vw)",
                }}
              >
                <div
                  className="rounded-xl bg-ink-800/95 border px-3 py-2 backdrop-blur-sm shadow-[0_8px_24px_rgba(0,0,0,0.45)] transition-colors"
                  style={{
                    borderColor: replied
                      ? "rgba(124,92,255,0.5)"
                      : landed
                      ? "rgba(124,245,208,0.32)"
                      : "rgba(255,255,255,0.10)",
                  }}
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className="inline-flex items-center justify-center w-7 h-7 rounded-full shrink-0 text-[11px] font-mono text-white/80"
                      style={{
                        background: `hsl(${(i * 47) % 360} 45% 22%)`,
                        border: "1px solid rgba(255,255,255,0.12)",
                      }}
                    >
                      {prospects[i].name
                        .split(" ")
                        .map((s) => s[0])
                        .join("")}
                    </span>
                    <div className="leading-tight min-w-0 flex-1">
                      <div className="text-[12.5px] text-white truncate">{prospects[i].name}</div>
                      <div className="text-[10px] text-white/45 truncate">
                        {prospects[i].role} · {prospects[i].company}
                      </div>
                    </div>
                    {/* landed / replied badge */}
                    <span className="shrink-0">
                      {replied ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-violet-glow/15 border border-violet-glow/45 px-2 py-0.5 text-[9.5px] font-mono text-violet-glow">
                          <ReplyIcon /> replied
                        </span>
                      ) : (
                        <span
                          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9.5px] font-mono transition-all"
                          style={{
                            opacity: landed ? 1 : 0.0,
                            background: "rgba(124,245,208,0.12)",
                            border: "1px solid rgba(124,245,208,0.4)",
                            color: "#7cf5d0",
                          }}
                        >
                          <CheckIcon /> inbox
                        </span>
                      )}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}

          {/* ── RIGHT: steady-state summary panel (replaces nothing; sits below prospects, appears at end) ── */}
          <div
            className="absolute z-30"
            style={{
              left: pct(L.panel.x, L.w),
              top: "94%",
              transform: "translate(-50%,-100%)",
              width: "min(252px, 20vw)",
              opacity: clamp01(seg(dt, T.summaryStart - 0.4, T.summaryStart + 0.6)),
              pointerEvents: steady ? "auto" : "none",
            }}
          >
            <div className="rounded-2xl glass p-4 shadow-[0_20px_60px_rgba(0,0,0,0.5)]">
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/40">
                  Live &amp; steady
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/15 border border-accent/40 px-2 py-0.5 text-[9.5px] font-mono text-accent">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" /> sending
                </span>
              </div>
              <div className="space-y-1.5 text-[12px] font-mono text-white/65">
                <Row label="Cadence" value={`~${PER_INBOX_PER_DAY}/inbox/day`} />
                <Row label="Deliverability" value="primary inbox" accent />
                <Row label="Replies" value={`${repliesSoFar}`} accent={repliesSoFar > 0} />
              </div>
            </div>
          </div>
        </>
      )}

      <button
        onClick={() => {
          setReplayKey((k) => k + 1);
          controls.play();
        }}
        className="absolute bottom-6 right-6 z-40 inline-flex items-center gap-2 rounded-full glass px-4 py-2.5 text-[11px] font-mono uppercase tracking-[0.18em] text-white/70 hover:text-accent transition cursor-pointer"
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
    </div>
  );
}

// ── Cadence gauge: a small "metered / paced" rate dial. Pure-ish: the sweep
//    animates via CSS only while active; its readable label never depends on
//    motion having played, so the end frame is complete on its own. ──
function CadenceGauge({ active }: { active: boolean }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl glass px-4 py-3 shadow-[0_16px_50px_rgba(0,0,0,0.5)]">
      <div className="relative w-[84px] h-[44px] overflow-hidden">
        {/* arc track */}
        <svg width="84" height="44" viewBox="0 0 84 44" className="absolute inset-0">
          <path
            d="M8 42 A 34 34 0 0 1 76 42"
            fill="none"
            stroke="rgba(255,255,255,0.12)"
            strokeWidth="4"
            strokeLinecap="round"
          />
          <path
            d="M8 42 A 34 34 0 0 1 76 42"
            fill="none"
            stroke="#7cf5d0"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray="107"
            strokeDashoffset={active ? 107 * 0.45 : 107}
            style={{ transition: "stroke-dashoffset .9s ease-out" }}
          />
        </svg>
        {/* metered ticks pulsing — pure CSS, decorative only */}
        <div
          className="absolute left-1/2 bottom-0 w-[2px] h-[18px] -translate-x-1/2 origin-bottom"
          style={{
            background: "#a4ffe1",
            transform: "translateX(-50%) rotate(-18deg)",
            boxShadow: "0 0 8px #7cf5d0",
          }}
        />
      </div>
      <div className="text-center leading-tight">
        <div className="font-display text-[15px] text-white tabular-nums">
          ~{PER_INBOX_PER_DAY}
          <span className="text-[10px] text-white/45 font-mono"> / inbox / day</span>
        </div>
        <div className="text-[9px] font-mono uppercase tracking-[0.2em] text-accent/80">
          metered · paced
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-white/40 shrink-0">{label}</span>
      <span className={`truncate ${accent ? "text-accent" : "text-white"}`}>{value}</span>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M20 6L9 17l-5-5"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ReplyIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M9 17l-5-5 5-5M4 12h11a5 5 0 0 1 5 5v1"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// cubic bezier helper (1D) for the connector packets
function bez(p0: number, p1: number, p2: number, p3: number, t: number) {
  const u = 1 - t;
  return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
}
