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
  easeInOut,
  easeOutBack,
  clamp01,
  lerp,
} from "../lab/engine/useScrubClock";
import { NarrationRail, type NarrationStep } from "../lab/engine/NarrationRail";
import { MailboxCard } from "../lab/engine/MailboxCard";
import { ProviderLogo, type Provider } from "../lab/engine/ProviderLogo";

// ── Beat timeline (seconds). Everything is a pure function of these. ──
const T = {
  engineOn: [0.2, 1.4] as [number, number], // beat 1: warm-up engine switches on
  nodesIn: 1.5, // mailbox nodes begin to appear
  nodesStagger: 0.05, // per-node appear delay
  nodesDur: 0.7,
  daysStart: 2.6, // beat 2: day counter begins climbing
  daysEnd: 13.2, // day counter reaches 14 (then holds)
  repStart: 4.2, // beat 3: reputation gauge starts filling
  repEnd: 13.6, // reputation reaches 94
  readyAt: 14.0, // beat 4: trusted & ready
};
const DURATION = 16.0;

const N_DOMAINS = 7; // 7 sending domains → clusters
const PER_DOMAIN = 3; // 3 mailboxes each → 21 nodes
const N_MAILBOXES = N_DOMAINS * PER_DOMAIN; // 21
const N_TRUSTED = 3; // ambient "trusted network" peers
const REP_TARGET = 94;
const DAYS_TARGET = 14;

const providerOf = (i: number): Provider => (i === 3 ? "outlook" : "gmail");

type Pt = { x: number; y: number };
type Layout = {
  w: number;
  h: number;
  center: Pt;
  field: { cx: number; cy: number; rx: number; ry: number };
  nodes: Pt[]; // 21 mailbox positions
  trusted: Pt[]; // ambient trusted-network peers
  clusterCenters: Pt[]; // 7 cluster anchors
  gauge: Pt; // reputation gauge center (canvas arc only)
  panel: Pt; // ready/summary panel (right lane)
  cardLane: number; // x of the readable sample-mailbox lane (right side)
  railRight: number; // right edge of the narration rail (cards stay clear of it)
};

// Fixed inter-mailbox edges (calm, not all-pairs). Deterministic by index.
// Mix of intra-cluster (adjacent mailboxes) + a few cross-cluster links so the
// constellation reads as one connected warm-up network.
const EDGES: [number, number][] = (() => {
  const e: [number, number][] = [];
  // intra-cluster: chain the 3 mailboxes of each domain
  for (let c = 0; c < N_DOMAINS; c++) {
    const b = c * PER_DOMAIN;
    e.push([b, b + 1], [b + 1, b + 2]);
  }
  // cross-cluster: stitch neighboring clusters together (one link each)
  for (let c = 0; c < N_DOMAINS - 1; c++) {
    e.push([c * PER_DOMAIN + 2, (c + 1) * PER_DOMAIN]);
  }
  // a couple of long-range links for a networked feel
  e.push([1, N_MAILBOXES - 2], [PER_DOMAIN * 3 + 1, PER_DOMAIN * 5 + 2]);
  return e;
})();

// Micro-events ("opened" / "replied") — a STATIC, seeded schedule so the whole
// sequence is a pure function of t (audit-safe: no Math.random at render time).
type MicroEvent = { t: number; node: number; kind: "opened" | "replied" };
function buildEvents(): MicroEvent[] {
  // tiny deterministic LCG seeded by a constant — computed once at module load.
  let s = 0x9e3779b9 >>> 0;
  const rnd = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
  const out: MicroEvent[] = [];
  const windowStart = T.daysStart + 0.4;
  const windowEnd = T.repEnd + 0.2;
  const count = 16;
  for (let i = 0; i < count; i++) {
    const t = lerp(windowStart, windowEnd, (i + rnd() * 0.6) / count);
    out.push({
      t,
      node: Math.floor(rnd() * N_MAILBOXES),
      kind: rnd() > 0.62 ? "replied" : "opened",
    });
  }
  return out.sort((a, b) => a.t - b.t);
}
const EVENTS: MicroEvent[] = buildEvents();
const EVENT_LIFE = 1.25; // seconds a blip stays visible

export default function WarmupScreen({ businessName, slug, mainDomain, deckHandleRef, onDone }: ScreenProps) {
  const reduce = !!useReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const layoutRef = useRef<Layout | null>(null);
  const lastTRef = useRef(0);
  const [dt, setDt] = useState(0);
  const [replayKey, setReplayKey] = useState(0);

  const domainNames = useMemo(() => buildSendingDomains(slug), [slug]);
  const mailboxes = useMemo(() => buildMailboxes(domainNames, PER_DOMAIN), [domainNames]);

  const steps: NarrationStep[] = useMemo(
    () => [
      {
        n: "01",
        title: "Warm-up switches on",
        detail: (
          <p>
            Every mailbox is enrolled in a warm-up network the moment it&apos;s created — before a
            single prospect sees it.
          </p>
        ),
      },
      {
        n: "02",
        title: "14 days of natural conversation",
        detail: (
          <p>
            The inboxes send and reply to each other and a{" "}
            <span className="text-white/80">trusted network</span>, just like real people, gradually
            ramping volume day by day.
          </p>
        ),
      },
      {
        n: "03",
        title: "Reputation builds",
        detail: (
          <p>
            Providers learn these are real senders — opens, replies and zero spam complaints push the{" "}
            <span className="text-white/80">trust score</span> up.
          </p>
        ),
      },
      {
        n: "04",
        title: "Trusted & ready",
        detail: (
          <p>
            After ~14 days the inboxes have a healthy reputation and are ready to send to{" "}
            <span className="text-white/80">{businessName}</span>&apos;s prospects.
          </p>
        ),
      },
    ],
    [businessName]
  );

  // ── layout from container size: a calm constellation of 21 nodes ──
  const computeLayout = useCallback(() => {
    const root = rootRef.current;
    if (!root) return;
    const w = root.clientWidth;
    const h = root.clientHeight;

    // The narration rail owns the left ~34% (≤440px). The constellation sits
    // centre-left of the remaining space; a dedicated readable card lane lives
    // on the far right so nothing collides with the rail (left) or panel.
    const railRight = Math.min(w * 0.34, 440);
    const fcx = lerp(railRight, w, 0.42); // centre of the field, clear of rail
    const fcy = h * 0.5;
    const frx = Math.min((w - railRight) * 0.3, 280);
    const fry = Math.min(h * 0.34, 230);

    const clusterCenters: Pt[] = Array.from({ length: N_DOMAINS }, (_, c) => {
      const ang = -Math.PI / 2 + (c / N_DOMAINS) * Math.PI * 2;
      return { x: fcx + Math.cos(ang) * frx, y: fcy + Math.sin(ang) * fry };
    });

    // 3 mailbox nodes per cluster, splayed in a small triangle around the anchor.
    const nodeR = Math.min(w, h) * 0.052;
    const nodes: Pt[] = [];
    for (let c = 0; c < N_DOMAINS; c++) {
      const cc = clusterCenters[c];
      for (let j = 0; j < PER_DOMAIN; j++) {
        const ang = (-Math.PI / 2) + (j / PER_DOMAIN) * Math.PI * 2 + c * 0.6;
        nodes.push({ x: cc.x + Math.cos(ang) * nodeR, y: cc.y + Math.sin(ang) * nodeR });
      }
    }

    // Ambient "trusted network" peers, sitting just outside the field on the
    // top/right/bottom arc (never hard-left, where the narration rail lives).
    const trusted: Pt[] = Array.from({ length: N_TRUSTED }, (_, k) => {
      // spread across [-60°, +60°] off the rightward axis → always clear of rail
      const ang = (-Math.PI / 3) + (k / Math.max(1, N_TRUSTED - 1)) * ((2 * Math.PI) / 3);
      return { x: fcx + Math.cos(ang) * frx * 1.46, y: fcy + Math.sin(ang) * fry * 1.5 };
    });

    layoutRef.current = {
      w,
      h,
      center: { x: fcx, y: fcy },
      field: { cx: fcx, cy: fcy, rx: frx, ry: fry },
      nodes,
      trusted,
      clusterCenters,
      gauge: { x: fcx, y: fcy },
      panel: { x: fcx, y: fcy }, // ready panel centres on the field focal point
      cardLane: fcx, // readable sample cards sit in a row below the field
      railRight,
    };
  }, []);

  // node appear time (staggered settle)
  const nodeAppear = (i: number) => T.nodesIn + i * T.nodesStagger;

  // ── canvas: connectors + inter-mailbox packets + glow (pure fn of t) ──
  const drawCanvas = useCallback((t: number) => {
    const ctx = ctxRef.current;
    const L = layoutRef.current;
    if (!ctx || !L) return;
    const { w, h, nodes, trusted, center } = L;
    ctx.clearRect(0, 0, w, h);

    const engine = easeOut(seg(t, T.engineOn[0], T.engineOn[1]));
    // calm-down as the ready panel takes focus (mirrors the DOM `calm`).
    const calm = 1 - 0.45 * easeInOut(seg(t, T.readyAt - 0.2, T.readyAt + 0.6));

    // central field glow — the "warm-up engine"
    if (engine > 0) {
      const g = ctx.createRadialGradient(center.x, center.y, 0, center.x, center.y, L.field.rx * 1.25);
      g.addColorStop(0, `rgba(124,245,208,${0.1 * engine})`);
      g.addColorStop(0.55, `rgba(124,92,255,${0.05 * engine})`);
      g.addColorStop(1, "rgba(124,245,208,0)");
      ctx.fillStyle = g;
      ctx.fillRect(center.x - L.field.rx * 1.3, center.y - L.field.rx * 1.3, L.field.rx * 2.6, L.field.rx * 2.6);
    }

    // node-presence helper (0..1) — used to gate edges/particles
    const present = (i: number) => clamp01((t - nodeAppear(i)) / T.nodesDur);

    // volume ramp 0..1 across the conversation window — packets/opacity scale up.
    const ramp = easeInOut(seg(t, T.daysStart, T.repEnd));

    // ambient links to the trusted network (soft, dashed)
    if (engine > 0.4) {
      for (let k = 0; k < trusted.length; k++) {
        const tp = trusted[k];
        // each trusted peer links to one cluster center
        const cc = L.clusterCenters[(k * 2) % N_DOMAINS];
        ctx.beginPath();
        ctx.moveTo(cc.x, cc.y);
        ctx.lineTo(tp.x, tp.y);
        ctx.strokeStyle = `rgba(255,255,255,${0.07 * engine})`;
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 5]);
        ctx.stroke();
        ctx.setLineDash([]);

        // a slow packet drifting outward to the trusted peer
        if (ramp > 0) {
          const f = (t * 0.22 + k * 0.31) % 1;
          const px = lerp(cc.x, tp.x, f);
          const py = lerp(cc.y, tp.y, f);
          ctx.beginPath();
          ctx.arc(px, py, 1.5, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(200,209,222,${0.5 * ramp * (1 - Math.abs(f - 0.5) * 1.4)})`;
          ctx.fill();
        }
      }
    }

    // inter-mailbox connectors + flowing packets (inbox-to-inbox)
    for (let ei = 0; ei < EDGES.length; ei++) {
      const [a, b] = EDGES[ei];
      const pa = present(a);
      const pb = present(b);
      const live = Math.min(pa, pb);
      if (live <= 0) continue;
      const A = nodes[a];
      const B = nodes[b];

      // gentle curved connector
      const mx = (A.x + B.x) / 2;
      const my = (A.y + B.y) / 2 - 14;
      ctx.beginPath();
      ctx.moveTo(A.x, A.y);
      ctx.quadraticCurveTo(mx, my, B.x, B.y);
      ctx.strokeStyle = `rgba(124,245,208,${0.12 * live * calm})`;
      ctx.lineWidth = 1;
      ctx.stroke();

      // packets flow once both endpoints are settled and the conversation has begun
      if (live >= 1 && ramp > 0) {
        // packet count grows with the volume ramp (1 → 2)
        const pk = 1 + Math.round(ramp);
        for (let k = 0; k < pk; k++) {
          // deterministic phase per edge+packet — direction alternates per edge
          const dir = ei % 2 === 0 ? 1 : -1;
          let f = (t * (0.3 + 0.12 * ramp) + (k / pk) + ei * 0.137) % 1;
          if (dir < 0) f = 1 - f;
          const u = 1 - f;
          const px = u * u * A.x + 2 * u * f * mx + f * f * B.x;
          const py = u * u * A.y + 2 * u * f * my + f * f * B.y;
          const edge = 1 - Math.abs(f - 0.5) * 1.5;
          ctx.beginPath();
          ctx.arc(px, py, 1.8, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(164,255,225,${(0.5 + 0.4 * ramp) * clamp01(edge) * calm})`;
          ctx.fill();
        }
      }
    }

    // node halos (so the 21 read as glowing inboxes under the DOM dots)
    for (let i = 0; i < nodes.length; i++) {
      const p = present(i);
      if (p <= 0) continue;
      const n = nodes[i];
      const halo = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, 16);
      halo.addColorStop(0, `rgba(124,245,208,${0.22 * p})`);
      halo.addColorStop(1, "rgba(124,245,208,0)");
      ctx.fillStyle = halo;
      ctx.fillRect(n.x - 18, n.y - 18, 36, 36);
    }

    // micro-event blip rings (opened / replied) — pure fn of t via static schedule
    for (let i = 0; i < EVENTS.length; i++) {
      const ev = EVENTS[i];
      const age = t - ev.t;
      if (age < 0 || age > EVENT_LIFE) continue;
      const n = nodes[ev.node];
      const k = age / EVENT_LIFE; // 0..1
      const r = 6 + k * 22;
      const col = ev.kind === "replied" ? "124,92,255" : "124,245,208";
      ctx.beginPath();
      ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(${col},${0.55 * (1 - k)})`;
      ctx.lineWidth = 1.6;
      ctx.stroke();
    }

    // reputation gauge arc (canvas draws ONLY the arc/glow; the number is DOM).
    // The whole gauge fades out as the centred "ready" panel takes over, so the
    // final/reduced-motion frame is a clean panel with nothing ghosting behind.
    const repFill = easeOut(seg(t, T.repStart, T.repEnd));
    const gaugeFade = 1 - easeInOut(seg(t, T.readyAt - 0.3, T.readyAt + 0.3));
    if (repFill > 0 && gaugeFade > 0.01) {
      const G = L.gauge;
      const radius = Math.min(w, h) * 0.082;
      const start = Math.PI * 0.75;
      const sweep = Math.PI * 1.5;
      // track
      ctx.beginPath();
      ctx.arc(G.x, G.y, radius, start, start + sweep);
      ctx.strokeStyle = `rgba(255,255,255,${0.08 * gaugeFade})`;
      ctx.lineWidth = 5;
      ctx.lineCap = "round";
      ctx.stroke();
      // filled portion → scales to 94/100
      const frac = (REP_TARGET / 100) * repFill;
      ctx.save();
      ctx.globalAlpha = gaugeFade;
      const grad = ctx.createLinearGradient(G.x - radius, G.y, G.x + radius, G.y);
      grad.addColorStop(0, "#7c5cff");
      grad.addColorStop(1, "#7cf5d0");
      ctx.beginPath();
      ctx.arc(G.x, G.y, radius, start, start + sweep * frac);
      ctx.strokeStyle = grad;
      ctx.lineWidth = 5;
      ctx.lineCap = "round";
      ctx.stroke();
      // soft glow at the gauge head
      const headAng = start + sweep * frac;
      const hx = G.x + Math.cos(headAng) * radius;
      const hy = G.y + Math.sin(headAng) * radius;
      const hg = ctx.createRadialGradient(hx, hy, 0, hx, hy, 10);
      hg.addColorStop(0, "rgba(124,245,208,0.8)");
      hg.addColorStop(1, "rgba(124,245,208,0)");
      ctx.fillStyle = hg;
      ctx.fillRect(hx - 12, hy - 12, 24, 24);
      ctx.restore();
    }
  }, []);

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

  // ── derived overlay state from display-time (all pure fns of dt) ──
  const nodesPresent = (() => {
    let c = 0;
    for (let i = 0; i < N_MAILBOXES; i++) if (dt >= nodeAppear(i)) c++;
    return c;
  })();

  // day counter climbs 0 → 14 over the conversation window, then HOLDS at 14.
  const dayProgress = easeInOut(seg(dt, T.daysStart, T.daysEnd));
  const day = Math.min(DAYS_TARGET, Math.round(dayProgress * DAYS_TARGET));

  // reputation climbs to exactly 94, then holds.
  const repProgress = easeOut(seg(dt, T.repStart, T.repEnd));
  const reputation = Math.round(repProgress * REP_TARGET);

  const ready = dt >= T.readyAt - 0.05;
  // calm-down factor: nodes/edges gently dim as the ready panel takes focus.
  const calm = 1 - 0.45 * easeInOut(seg(dt, T.readyAt - 0.2, T.readyAt + 0.6));

  // active narration: 1 (engine) → 2 (conversation) → 3 (reputation) → 4 (ready)
  const activeNarration =
    dt >= T.readyAt - 0.4 ? 4 : dt >= T.repStart ? 3 : dt >= T.daysStart ? 2 : dt >= T.engineOn[0] ? 1 : 0;

  // most-recent micro-event for the live ticker line (pure fn of dt)
  const lastEvent = (() => {
    let found: MicroEvent | null = null;
    for (let i = 0; i < EVENTS.length; i++) {
      if (EVENTS[i].t <= dt && (!found || EVENTS[i].t > found.t)) found = EVENTS[i];
    }
    return found;
  })();

  const L = layoutRef.current;
  const pct = (v: number, total: number) => `${(v / total) * 100}%`;

  return (
    <div ref={rootRef} className="relative h-full w-full overflow-hidden bg-ink-950">
      <div className="absolute inset-0 bg-grid-fine opacity-[0.16]" />
      <div
        className="absolute inset-0"
        style={{ background: "radial-gradient(64% 60% at 62% 50%, rgba(124,92,255,0.08), transparent 62%)" }}
      />
      <div className="noise" />
      <canvas ref={canvasRef} className="absolute inset-0" />

      {/* narration rail */}
      <NarrationRail
        eyebrow={<><span className="dot" /> Step 02 · Warm-up · 14 days</>}
        headline={
          <>
            <span className="text-gradient">We warm the inboxes</span>
            <br />
            <span className="text-gradient-accent">so they land in the inbox.</span>
          </>
        }
        steps={steps}
        activeCount={activeNarration}
        reduced={reduce}
      />

      {/* top-right status chips: day + inboxes warmed */}
      <div className="absolute top-10 right-10 z-20 flex items-center gap-2">
        <div className="flex items-center gap-2 chip">
          <span className="font-display text-[20px] text-white leading-none tabular-nums">{day}</span>
          <span className="text-white/45">/ 14 days</span>
        </div>
        <div className="flex items-center gap-2 chip">
          <span className="font-display text-[20px] text-white leading-none tabular-nums">{nodesPresent}</span>
          <span className="text-white/45">/ 21 inboxes</span>
        </div>
      </div>

      {L && (
        <>
          {/* trusted-network ambient peers (labels) */}
          {L.trusted.map((tp, k) => {
            const a = clamp01(seg(dt, T.engineOn[1], T.engineOn[1] + 0.8));
            return (
              <div
                key={`trusted-${k}`}
                className="absolute z-10"
                style={{
                  left: pct(tp.x, L.w),
                  top: pct(tp.y, L.h),
                  transform: "translate(-50%,-50%)",
                  opacity: a * 0.85,
                }}
              >
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.04] border border-white/10 px-2.5 py-1 text-[9px] font-mono uppercase tracking-[0.16em] text-white/50">
                  <span className="w-1.5 h-1.5 rounded-full bg-white/40" /> trusted peer
                </span>
              </div>
            );
          })}

          {/* the 21 mailbox nodes — compact provider dots (readable, not crammed) */}
          {L.nodes.map((n, i) => {
            const a = clamp01((dt - nodeAppear(i)) / T.nodesDur);
            if (a <= 0) return null;
            const prov = providerOf(Math.floor(i / PER_DOMAIN));
            // active blip pulse if this node has a live micro-event
            const ev = EVENTS.find((e) => e.node === i && dt - e.t >= 0 && dt - e.t < EVENT_LIFE);
            const active = !!ev;
            return (
              <div
                key={`node-${i}`}
                className="absolute z-20"
                style={{
                  left: pct(n.x, L.w),
                  top: pct(n.y, L.h),
                  transform: `translate(-50%,-50%) scale(${reduce ? 1 : lerp(0.4, 1, easeOutBack(a))})`,
                  opacity: a * calm,
                }}
              >
                <span
                  className="block rounded-md bg-white shadow-[0_2px_8px_rgba(0,0,0,0.5)] transition-all"
                  style={{
                    width: 14,
                    height: 14,
                    boxShadow: active
                      ? `0 0 0 2px ${ev!.kind === "replied" ? "rgba(124,92,255,0.7)" : "rgba(124,245,208,0.7)"}, 0 2px 8px rgba(0,0,0,0.5)`
                      : "0 2px 8px rgba(0,0,0,0.5)",
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/logos/${prov}.png`}
                    alt={prov === "gmail" ? "Google" : "Microsoft"}
                    className="object-contain"
                    style={{ width: 14, height: 14, padding: 2 }}
                  />
                </span>
              </div>
            );
          })}

          {/* a few READABLE sample mailbox cards in a row below the field, so a
              newcomer sees real addresses (not just dots). They appear during the
              conversation beat and fade out as the ready panel takes over. */}
          {[0, 7, 14].map((mi, k) => {
            const appear = T.daysStart + 0.3 + k * 0.45;
            const a = clamp01((dt - appear) / 0.5);
            const out = clamp01((dt - (T.readyAt - 0.3)) / 0.4); // fade for ready beat
            const op = a * (1 - out);
            if (op <= 0) return null;
            const m = mailboxes[mi];
            const prov = providerOf(Math.floor(mi / PER_DOMAIN));
            // Lay the 3-card row out across the post-rail band: centre it on the
            // band midpoint (not the field centre) and space cards by 258px so a
            // full ~240px email card never overlaps its neighbour OR the rail.
            const bandMid = (L.railRight + L.w) / 2;
            const rowX = bandMid + (k - 1) * 258;
            const rowY = Math.min(L.h - 46, L.field.cy + L.field.ry + 56);
            return (
              <div
                key={`card-${mi}`}
                className="absolute z-30"
                style={{
                  left: pct(rowX, L.w),
                  top: pct(rowY, L.h),
                  transform: `translate(-50%,-50%) translateY(${(1 - easeOutBack(a)) * 16}px)`,
                  opacity: op,
                }}
              >
                <MailboxCard email={m.handle} name={m.name} provider={prov} className="max-w-[240px]" />
              </div>
            );
          })}

          {/* reputation read-out — DOM number centered on the canvas gauge arc.
              Hidden once the ready panel takes the centre (no overlap). */}
          {dt >= T.repStart && !ready && (
            <div
              className="absolute z-30 pointer-events-none"
              style={{
                left: pct(L.gauge.x, L.w),
                top: pct(L.gauge.y, L.h),
                transform: "translate(-50%,-50%)",
                textAlign: "center",
                opacity: clamp01((T.readyAt - dt) / 0.3),
              }}
            >
              <div className="font-display text-[34px] leading-none text-white tabular-nums">{reputation}</div>
              <div className="text-[9px] font-mono uppercase tracking-[0.2em] text-accent/70 mt-1">reputation</div>
            </div>
          )}

          {/* live event ticker (above the field) */}
          {lastEvent && dt - lastEvent.t < EVENT_LIFE + 0.4 && (
            <div
              className="absolute z-30"
              style={{
                left: pct(L.field.cx, L.w),
                top: pct(L.field.cy - L.field.ry - 38, L.h),
                transform: "translate(-50%,-50%)",
                opacity: clamp01(1 - (dt - lastEvent.t) / (EVENT_LIFE + 0.4)),
              }}
            >
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-mono"
                style={{
                  color: lastEvent.kind === "replied" ? "#a99bff" : "#7cf5d0",
                  background: lastEvent.kind === "replied" ? "rgba(124,92,255,0.12)" : "rgba(124,245,208,0.1)",
                  border: `1px solid ${lastEvent.kind === "replied" ? "rgba(124,92,255,0.4)" : "rgba(124,245,208,0.35)"}`,
                }}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: "currentColor" }} />
                {lastEvent.kind === "replied" ? "replied" : "opened"}
              </span>
            </div>
          )}

          {/* SUMMARY / READY PANEL */}
          {ready && (
            <div
              className="absolute z-40"
              style={{
                left: pct(L.field.cx, L.w),
                top: pct(L.field.cy, L.h),
                transform: "translate(-50%,-50%)",
                width: "min(320px, 26vw)",
                opacity: clamp01((dt - T.readyAt) / 0.5),
              }}
            >
              <div className="rounded-2xl glass p-5 shadow-[0_20px_60px_rgba(0,0,0,0.55)]">
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                  <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-accent">
                    Trusted &amp; ready
                  </span>
                </div>
                <div className="space-y-1.5 text-[12px] font-mono text-white/65">
                  <Row label="Day" value="14" />
                  <Row label="Reputation" value="94 / 100" />
                  <Row label="Inboxes warmed" value="21" />
                  <Row label="Spam complaints" value="0" />
                </div>
                <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-accent/15 border border-accent/40 px-3 py-1.5 text-[11px] font-mono text-accent">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent" /> Ready to launch
                </div>
              </div>
            </div>
          )}
        </>
      )}

      <button
        onClick={() => {
          setReplayKey((k) => k + 1);
          controls.play();
        }}
        className="absolute bottom-6 right-6 z-50 inline-flex items-center gap-2 rounded-full glass px-4 py-2.5 text-[11px] font-mono uppercase tracking-[0.18em] text-white/70 hover:text-accent transition cursor-pointer"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <path d="M3 12a9 9 0 1 0 3-6.7M3 4v4h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Replay
      </button>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-white/40">{label}</span>
      <span className="text-white">{value}</span>
    </div>
  );
}
