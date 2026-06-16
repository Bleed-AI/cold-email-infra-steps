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
  phase,
} from "../lab/engine/useScrubClock";
import { NarrationRail, type NarrationStep } from "../lab/engine/NarrationRail";
import { Callout } from "../lab/engine/Callout";
import { GmailMark } from "../lab/engine/ProviderLogo";

const N_DOMAINS = 7;
const PER_DOMAIN = 3;
const N_MAILBOXES = N_DOMAINS * PER_DOMAIN; // 21
const REP_FROM = 58;
const REP_TARGET = 94;
const DAYS_TARGET = 14;

// ── beat timeline (seconds) ──
const T = {
  engineOn: [0.2, 1.4] as [number, number],
  nodesIn: 1.4,
  nodesStagger: 0.05,
  nodesDur: 0.7,
  daysStart: 2.2,
  daysEnd: 11.2, // day counter reaches 14, then holds
  repStart: 3.0,
  repEnd: 11.6,
  readyAt: 12.0, // "ready to launch" badge (does NOT stop the scene)
};
const DURATION = 13.0;
const DAY_PERIOD = 4.5; // one day↔night cycle (ambient, seamless)
const P_PKT = 1.5; // inbox-to-inbox packet period (DAY_PERIOD / 3 → seamless)

const providerIsOutlook = (cluster: number) => cluster === 3;

type Pt = { x: number; y: number };
type Layout = {
  w: number;
  h: number;
  field: { cx: number; cy: number; rx: number; ry: number };
  nodes: Pt[];
  clusterCenters: Pt[];
  arc: { left: number; right: number; baseY: number; rise: number };
  railRight: number;
};

// calm, deterministic inter-mailbox edges (not all-pairs)
const EDGES: [number, number][] = (() => {
  const e: [number, number][] = [];
  for (let c = 0; c < N_DOMAINS; c++) {
    const b = c * PER_DOMAIN;
    e.push([b, b + 1], [b + 1, b + 2]);
  }
  for (let c = 0; c < N_DOMAINS - 1; c++) e.push([c * PER_DOMAIN + 2, (c + 1) * PER_DOMAIN]);
  e.push([1, N_MAILBOXES - 2], [PER_DOMAIN * 3 + 1, PER_DOMAIN * 5 + 2]);
  return e;
})();

// "opened" / "replied" blips — a static seeded schedule (pure fn of t, build-only)
type MicroEvent = { t: number; node: number; kind: "opened" | "replied" };
const EVENTS: MicroEvent[] = (() => {
  let s = 0x9e3779b9 >>> 0;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0), s / 0xffffffff);
  const out: MicroEvent[] = [];
  for (let i = 0; i < 16; i++) {
    out.push({
      t: lerp(T.daysStart + 0.6, T.repEnd, (i + rnd() * 0.6) / 16),
      node: Math.floor(rnd() * N_MAILBOXES),
      kind: rnd() > 0.62 ? "replied" : "opened",
    });
  }
  return out.sort((a, b) => a.t - b.t);
})();
const EVENT_LIFE = 1.3;

export default function WarmupScreen({ businessName, slug, deckHandleRef, onDone }: ScreenProps) {
  const reduce = !!useReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const layoutRef = useRef<Layout | null>(null);
  const lastTRef = useRef(0);
  const pushedRef = useRef(-1);
  const [dt, setDt] = useState(0);

  const domainNames = useMemo(() => buildSendingDomains(slug), [slug]);
  const mailboxes = useMemo(() => buildMailboxes(domainNames, PER_DOMAIN), [domainNames]);

  const steps: NarrationStep[] = useMemo(
    () => [
      { n: "01", title: "Warm-up switches on", detail: <p>Every mailbox is enrolled in a warm-up network the moment it&apos;s created — before a single prospect sees it.</p> },
      { n: "02", title: "14 days of natural conversation", detail: <p>The inboxes send and reply to each other like real people, day after day, gradually ramping volume.</p> },
      { n: "03", title: "Reputation builds", detail: <p>Providers learn these are real senders — opens, replies and zero spam complaints push the <span className="text-white/80">trust score</span> up.</p> },
      { n: "04", title: "Ready to launch", detail: <p>After ~14 days the inboxes have a healthy reputation and are ready to send to <span className="text-white/80">{businessName}</span>&apos;s prospects.</p> },
    ],
    [businessName]
  );

  const computeLayout = useCallback(() => {
    const root = rootRef.current;
    if (!root) return;
    const w = root.clientWidth;
    const h = root.clientHeight;
    const railRight = Math.min(w * 0.34, 440);
    const fcx = lerp(railRight, w, 0.44);
    const fcy = h * 0.56;
    const frx = Math.min((w - railRight) * 0.32, 290);
    const fry = Math.min(h * 0.27, 210);
    const clusterCenters: Pt[] = Array.from({ length: N_DOMAINS }, (_, c) => {
      const ang = -Math.PI / 2 + (c / N_DOMAINS) * Math.PI * 2;
      return { x: fcx + Math.cos(ang) * frx, y: fcy + Math.sin(ang) * fry };
    });
    const nodeR = Math.min(w, h) * 0.05;
    const nodes: Pt[] = [];
    for (let c = 0; c < N_DOMAINS; c++) {
      const cc = clusterCenters[c];
      for (let j = 0; j < PER_DOMAIN; j++) {
        const ang = -Math.PI / 2 + (j / PER_DOMAIN) * Math.PI * 2 + c * 0.6;
        nodes.push({ x: cc.x + Math.cos(ang) * nodeR, y: cc.y + Math.sin(ang) * nodeR });
      }
    }
    layoutRef.current = {
      w,
      h,
      field: { cx: fcx, cy: fcy, rx: frx, ry: fry },
      nodes,
      clusterCenters,
      arc: { left: railRight + (w - railRight) * 0.12, right: w * 0.95, baseY: h * 0.19, rise: h * 0.07 },
      railRight,
    };
  }, []);

  const nodeAppear = (i: number) => T.nodesIn + i * T.nodesStagger;

  // ── canvas: day/night + sun/moon + constellation + bouncing packets ──
  const drawCanvas = useCallback((t: number) => {
    const ctx = ctxRef.current;
    const L = layoutRef.current;
    if (!ctx || !L) return;
    const { w, h, nodes, field, arc } = L;
    ctx.clearRect(0, 0, w, h);

    // ── DAY / NIGHT (ambient, seamless: pure sin of t/DAY_PERIOD) ──
    const theta = (t / DAY_PERIOD) * Math.PI * 2;
    const sun = Math.sin(theta); // +1 noon … -1 midnight
    const warmth = clamp01(sun);
    const night = clamp01(-sun);
    // warm day wash from the top
    if (warmth > 0.001) {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, `rgba(255,210,140,${0.1 * warmth})`);
      g.addColorStop(0.5, "rgba(255,210,140,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }
    // cool night wash
    if (night > 0.001) {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, `rgba(56,76,180,${0.17 * night})`);
      g.addColorStop(0.6, "rgba(40,40,110,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }
    // sun OR moon arcing across the top (day phase = [0,π], night = [π,2π])
    const phaseTheta = ((theta % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    const isDay = phaseTheta < Math.PI;
    const s = isDay ? phaseTheta / Math.PI : (phaseTheta - Math.PI) / Math.PI; // 0..1 along arc
    const bx = lerp(arc.left, arc.right, s);
    const by = arc.baseY - arc.rise * Math.sin(Math.PI * s);
    if (isDay) {
      const gl = ctx.createRadialGradient(bx, by, 0, bx, by, 40);
      gl.addColorStop(0, "rgba(255,206,120,0.5)");
      gl.addColorStop(1, "rgba(255,206,120,0)");
      ctx.fillStyle = gl;
      ctx.fillRect(bx - 44, by - 44, 88, 88);
      ctx.beginPath();
      ctx.arc(bx, by, 9, 0, Math.PI * 2);
      ctx.fillStyle = "#ffd28a";
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.arc(bx, by, 8, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(214,224,255,0.92)";
      ctx.fill();
      // crescent bite
      ctx.beginPath();
      ctx.arc(bx + 3.5, by - 2, 8, 0, Math.PI * 2);
      ctx.fillStyle = "#0b0f17";
      ctx.fill();
    }

    // ── warm-up engine glow ──
    const engine = easeOut(seg(t, T.engineOn[0], T.engineOn[1]));
    if (engine > 0) {
      const g = ctx.createRadialGradient(field.cx, field.cy, 0, field.cx, field.cy, field.rx * 1.25);
      g.addColorStop(0, `rgba(255,90,77,${0.09 * engine})`);
      g.addColorStop(0.55, `rgba(124,92,255,${0.05 * engine})`);
      g.addColorStop(1, "rgba(255,90,77,0)");
      ctx.fillStyle = g;
      ctx.fillRect(field.cx - field.rx * 1.3, field.cy - field.rx * 1.3, field.rx * 2.6, field.rx * 2.6);
    }

    const present = (i: number) => clamp01((t - nodeAppear(i)) / T.nodesDur);
    const ramp = easeInOut(seg(t, T.daysStart, T.repEnd)); // volume ramp during build

    // ── inter-mailbox connectors + bouncing packets (ambient loop) ──
    for (let ei = 0; ei < EDGES.length; ei++) {
      const [a, b] = EDGES[ei];
      const live = Math.min(present(a), present(b));
      if (live <= 0) continue;
      const A = nodes[a];
      const B = nodes[b];
      const mx = (A.x + B.x) / 2;
      const my = (A.y + B.y) / 2 - 14;
      ctx.beginPath();
      ctx.moveTo(A.x, A.y);
      ctx.quadraticCurveTo(mx, my, B.x, B.y);
      ctx.strokeStyle = `rgba(255,90,77,${0.12 * live})`;
      ctx.lineWidth = 1;
      ctx.stroke();
      if (live >= 1) {
        const pk = 2;
        for (let k = 0; k < pk; k++) {
          // alternate direction per edge; seamless via phase() + sin fade
          let f = phase(t, P_PKT, k / pk + ei * 0.13);
          if (ei % 2 === 1) f = 1 - f;
          const u = 1 - f;
          const fade = Math.sin(Math.PI * f);
          const px = u * u * A.x + 2 * u * f * mx + f * f * B.x;
          const py = u * u * A.y + 2 * u * f * my + f * f * B.y;
          ctx.beginPath();
          ctx.arc(px, py, 1.8, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255,150,135,${(0.45 + 0.4 * ramp) * fade})`;
          ctx.fill();
        }
      }
    }

    // node halos
    for (let i = 0; i < nodes.length; i++) {
      const p = present(i);
      if (p <= 0) continue;
      const n = nodes[i];
      const halo = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, 15);
      halo.addColorStop(0, `rgba(255,90,77,${0.2 * p})`);
      halo.addColorStop(1, "rgba(255,90,77,0)");
      ctx.fillStyle = halo;
      ctx.fillRect(n.x - 16, n.y - 16, 32, 32);
    }

    // micro-event blip rings (build-only; all events are < DURATION → ambient is clean)
    for (let i = 0; i < EVENTS.length; i++) {
      const ev = EVENTS[i];
      const age = t - ev.t;
      if (age < 0 || age > EVENT_LIFE) continue;
      const n = nodes[ev.node];
      const k = age / EVENT_LIFE;
      const col = ev.kind === "replied" ? "124,92,255" : "255,90,77";
      ctx.beginPath();
      ctx.arc(n.x, n.y, 6 + k * 20, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(${col},${0.55 * (1 - k)})`;
      ctx.lineWidth = 1.6;
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

  const controls = useScrubClock(onFrame, { duration: DURATION, reduced: reduce, autoPlay: !deckHandleRef, onDone, loop: true });
  useDeckHandle(controls, deckHandleRef);

  // ── derived overlay state ──
  const nodesPresent = (() => {
    let c = 0;
    for (let i = 0; i < N_MAILBOXES; i++) if (dt >= nodeAppear(i)) c++;
    return c;
  })();
  const day = Math.min(DAYS_TARGET, Math.round(easeInOut(seg(dt, T.daysStart, T.daysEnd)) * DAYS_TARGET));
  const reputation = Math.round(lerp(REP_FROM, REP_TARGET, easeOut(seg(dt, T.repStart, T.repEnd))));
  const ready = dt >= T.readyAt;
  const activeNarration = dt >= T.readyAt - 0.4 ? 4 : dt >= T.repStart ? 3 : dt >= T.daysStart ? 2 : dt >= T.engineOn[0] ? 1 : 0;

  const L = layoutRef.current;
  const px = (v: number, total: number) => `${(v / total) * 100}%`;

  return (
    <div ref={rootRef} className="relative h-full w-full overflow-hidden bg-ink-950">
      <div className="absolute inset-0 bg-grid-fine opacity-[0.16]" />
      <div className="absolute inset-0" style={{ background: "radial-gradient(60% 56% at 60% 56%, rgba(124,92,255,0.07), transparent 62%)" }} />
      <div className="noise" />
      <canvas ref={canvasRef} className="absolute inset-0" />

      <NarrationRail
        eyebrow={<><span className="dot" /> Step 02 · Warm-up · 14 days</>}
        headline={<><span className="text-gradient">We warm the inboxes</span><br /><span className="text-gradient-accent">so they land in the inbox.</span></>}
        steps={steps}
        activeCount={activeNarration}
        reduced={reduce}
      />

      {/* top-right animated status: day + inboxes */}
      <div className="absolute top-9 right-9 z-30 flex items-center gap-2">
        <div className="flex items-center gap-2 chip">
          <span className="font-display text-[20px] text-white leading-none tabular-nums">{day}</span>
          <span className="text-white/45">/ 14 days</span>
        </div>
        <div className="flex items-center gap-2 chip">
          <span className="font-display text-[20px] text-white leading-none tabular-nums">{nodesPresent}</span>
          <span className="text-white/45">/ 21 inboxes</span>
        </div>
      </div>

      {/* daily send-volume ramp — warm-up raises volume gradually, never a spike */}
      <VolumeRamp day={day} appear={clamp01((dt - (T.daysStart + 0.3)) / 0.9)} />

      {L && (
        <>
          {/* 21 mailbox nodes — real Gmail / Outlook square marks */}
          {L.nodes.map((n, i) => {
            const a = clamp01((dt - nodeAppear(i)) / T.nodesDur);
            if (a <= 0) return null;
            const cluster = Math.floor(i / PER_DOMAIN);
            const outlook = providerIsOutlook(cluster);
            const ev = EVENTS.find((e) => e.node === i && dt - e.t >= 0 && dt - e.t < EVENT_LIFE);
            return (
              <div
                key={`node-${i}`}
                className="absolute z-20"
                style={{ left: px(n.x, L.w), top: px(n.y, L.h), transform: `translate(-50%,-50%) scale(${reduce ? 1 : lerp(0.4, 1, easeOutBack(a))})`, opacity: a }}
              >
                <span
                  className="flex items-center justify-center rounded-[4px] bg-white shadow-[0_2px_8px_rgba(0,0,0,0.5)]"
                  style={{
                    width: 18,
                    height: 18,
                    boxShadow: ev ? `0 0 0 2px ${ev.kind === "replied" ? "rgba(124,92,255,0.7)" : "rgba(255,90,77,0.7)"}, 0 2px 8px rgba(0,0,0,0.5)` : "0 2px 8px rgba(0,0,0,0.5)",
                  }}
                >
                  {outlook ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src="/logos/outlook.png" alt="Outlook" width={12} height={12} style={{ width: 12, height: 12 }} className="object-contain" />
                  ) : (
                    <GmailMark size={12} />
                  )}
                </span>
              </div>
            );
          })}

          {/* inline labels (text + animated number) */}
          <Callout
            x={px(L.field.cx, L.w)}
            y={px(L.field.cy + L.field.ry + L.h * 0.04, L.h)}
            anchor="center"
            tone="accent"
            label="inbox-to-inbox warm-up"
            sub="send · open · reply, like real people"
            appear={seg(dt, T.daysStart, T.daysStart + 0.9)}
            reduced={reduce}
            className="[&_*]:!normal-case"
          />
          <Callout
            x={px(L.field.cx - L.field.rx - L.w * 0.012, L.w)}
            y={px(L.field.cy, L.h)}
            anchor="right"
            tone="violet"
            label="Reputation"
            value={`${reputation}/100`}
            stem={{ dir: "right", len: 24 }}
            appear={seg(dt, T.repStart, T.repStart + 0.9)}
            reduced={reduce}
          />

          {/* ready badge — inline, does NOT stop the scene (emails keep bouncing) */}
          <div
            className="absolute z-30"
            style={{ left: px(L.field.cx, L.w), top: px(L.h * 0.225, L.h), transform: "translate(-50%,-50%)", opacity: clamp01((dt - T.readyAt) / 0.5) }}
          >
            <span className="inline-flex items-center gap-2 rounded-full bg-accent/15 border border-accent/45 px-3.5 py-1.5 text-[11px] font-mono text-accent shadow-[0_6px_22px_rgba(255,90,77,0.16)]">
              <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" /> 14 days completed · ready to launch
            </span>
          </div>
        </>
      )}

      {!deckHandleRef && (
        <button onClick={() => controls.play()} className="absolute bottom-6 right-6 z-50 inline-flex items-center gap-2 rounded-full glass px-4 py-2.5 text-[11px] font-mono uppercase tracking-[0.18em] text-white/70 hover:text-accent transition cursor-pointer">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M3 12a9 9 0 1 0 3-6.7M3 4v4h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
          Replay
        </button>
      )}
    </div>
  );
}

/** Daily send-volume ramp: warm-up raises volume gradually (never a spike), one
    bar per day, lighting up as the 14-day counter climbs toward live cadence. */
function VolumeRamp({ day, appear }: { day: number; appear: number }) {
  const a = clamp01(appear);
  if (a <= 0) return null;
  const DAYS = 14;
  const vol = Math.round(lerp(3, 22, Math.min(day, DAYS) / DAYS)); // per inbox/day
  return (
    <div className="absolute z-30" style={{ left: "3.5%", top: "82%", transform: "translateY(-50%)", opacity: a }}>
      <div className="rounded-xl glass px-3.5 py-3 w-[230px]">
        <div className="text-[9px] font-mono uppercase tracking-[0.16em] text-accent/80 mb-2">Send volume · ramps daily</div>
        <div className="flex items-end gap-[3px] h-[34px]">
          {Array.from({ length: DAYS }).map((_, i) => {
            const target = lerp(0.28, 1, i / (DAYS - 1));
            const lit = day >= i + 1;
            return (
              <span
                key={i}
                className="flex-1 rounded-[2px] transition-colors duration-300"
                style={{ height: `${target * 100}%`, background: lit ? "linear-gradient(180deg,#ff8a7d,#ff5a4d)" : "rgba(255,255,255,0.08)" }}
              />
            );
          })}
        </div>
        <div className="flex items-center justify-between mt-1.5 text-[9.5px] font-mono">
          <span className="text-white/40">~3 → ~22 / inbox · day</span>
          <span className="text-accent tabular-nums">{vol}/day</span>
        </div>
      </div>
    </div>
  );
}
