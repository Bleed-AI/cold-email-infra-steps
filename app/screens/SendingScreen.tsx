"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import type { ScreenProps } from "../lab/types";
import { buildSendingDomains } from "../lib/domains";
import {
  useScrubClock,
  useDeckHandle,
  seg,
  easeOut,
  clamp01,
  lerp,
  phase,
} from "../lab/engine/useScrubClock";
import { NarrationRail, type NarrationStep } from "../lab/engine/NarrationRail";
import { Callout } from "../lab/engine/Callout";
import { ProviderLogo, type Provider } from "../lab/engine/ProviderLogo";
import { buildProspects, PER_INBOX_PER_DAY } from "./prospects";

const N_PROSPECTS = 7;
const SENT_TOTAL = 312;
const providerOf = (i: number): Provider => (i === 3 ? "outlook" : "gmail");

const T = {
  campaignIn: [0.2, 1.4] as [number, number],
  fleetStart: 1.3,
  fleetStagger: 0.1,
  sendStart: 2.4,
  sendCountEnd: 10.5, // "emails sent" counter reaches SENT_TOTAL, then holds
  receiveStart: 3.3,
  receivePer: 0.85,
  replyDelay: 1.7,
};
const DURATION = 12.5;
// one shared base period → the whole ambient frame is seamless
const BASE = 4.8;
const P_SEND = 1.6; // BASE / 3
const P_REPLY = 2.4; // BASE / 2

const arriveAt = (i: number) => T.receiveStart + i * T.receivePer;

type Pt = { x: number; y: number };
type Layout = { w: number; h: number; hub: Pt; fleet: Pt; prospects: Pt[] };

export default function SendingScreen({ businessName, slug, mainDomain, deckHandleRef, onDone }: ScreenProps) {
  const reduce = !!useReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const layoutRef = useRef<Layout | null>(null);
  const lastTRef = useRef(0);
  const pushedRef = useRef(-1);
  const [dt, setDt] = useState(0);

  const domainNames = useMemo(() => buildSendingDomains(slug), [slug]);
  const prospects = useMemo(() => buildProspects(), []);

  const steps: NarrationStep[] = useMemo(
    () => [
      { n: "01", title: "Campaign goes live", detail: <p>After warm-up, {businessName}&apos;s first campaign launches in <span className="text-white/80">Instantly</span> across all 21 mailboxes.</p> },
      { n: "02", title: "Sent at a safe cadence", detail: <p>Around {PER_INBOX_PER_DAY} emails per inbox per day, spaced out — never a blast — so providers keep trusting your domains.</p> },
      { n: "03", title: "Landing in the inbox", detail: <p>Because the domains are warmed and authenticated, messages land in the primary inbox, not spam.</p> },
      { n: "04", title: "Replies route back to you", detail: <p>Positive replies come straight back to <span className="text-white/80">you@{mainDomain}</span>, and sending auto-pauses on reply so no prospect is ever double-messaged.</p> },
    ],
    [businessName, mainDomain]
  );

  const computeLayout = useCallback(() => {
    const root = rootRef.current;
    if (!root) return;
    const w = root.clientWidth;
    const h = root.clientHeight;
    const prospects: Pt[] = Array.from({ length: N_PROSPECTS }, (_, i) => ({ x: w * 0.84, y: lerp(h * 0.15, h * 0.85, i / (N_PROSPECTS - 1)) }));
    layoutRef.current = {
      w,
      h,
      hub: { x: w * 0.56, y: h * 0.44 }, // emission point (right edge of the campaign card)
      fleet: { x: w * 0.46, y: h * 0.66 },
      prospects,
    };
  }, []);

  const drawCanvas = useCallback(
    (t: number) => {
      const ctx = ctxRef.current;
      const L = layoutRef.current;
      if (!ctx || !L) return;
      const { w, h, hub, prospects: pros } = L;
      ctx.clearRect(0, 0, w, h);

      // campaign glow (gentle seamless breathe, period == BASE)
      const cIn = easeOut(seg(t, T.campaignIn[0], T.campaignIn[1]));
      if (cIn > 0) {
        const breathe = 1 + 0.07 * Math.sin((t / BASE) * Math.PI * 2);
        const r = 110 * breathe;
        const g = ctx.createRadialGradient(L.fleet.x, hub.y, 0, L.fleet.x, hub.y, r);
        g.addColorStop(0, `rgba(124,92,255,${0.13 * cIn})`);
        g.addColorStop(1, "rgba(124,92,255,0)");
        ctx.fillStyle = g;
        ctx.fillRect(L.fleet.x - r, hub.y - r, r * 2, r * 2);
      }

      for (let p = 0; p < pros.length; p++) {
        const d = pros[p];
        const arrive = arriveAt(p);
        const lane = easeOut(seg(t, arrive - 0.5, arrive + 0.4));
        if (lane <= 0) continue;
        const midx = (hub.x + d.x) / 2;
        const tx = d.x - 18;
        // faint lane guide
        ctx.beginPath();
        ctx.moveTo(hub.x, hub.y);
        ctx.bezierCurveTo(midx, hub.y, midx, d.y, tx, d.y);
        ctx.strokeStyle = `rgba(255,90,77,${0.08 * lane})`;
        ctx.lineWidth = 1;
        ctx.stroke();

        // metered send packets (ambient loop, seamless via phase + sin fade)
        const nPk = 2;
        for (let k = 0; k < nPk; k++) {
          const f = phase(t, P_SEND, p * 0.17 + k / nPk);
          const fade = Math.sin(Math.PI * f);
          const x = bez(hub.x, midx, midx, tx, f);
          const y = bez(hub.y, hub.y, d.y, d.y, f);
          ctx.beginPath();
          ctx.arc(x, y, 2.1, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255,150,135,${0.85 * fade * lane})`;
          ctx.fill();
        }

        // reply sparks travel back for repliers (ambient loop)
        if (prospects[p].replies) {
          const rg = easeOut(seg(t, arrive + T.replyDelay, arrive + T.replyDelay + 0.5));
          if (rg > 0) {
            const f = phase(t, P_REPLY, p * 0.3);
            const fade = Math.sin(Math.PI * f);
            const x = bez(tx, midx, midx, hub.x, f);
            const y = bez(d.y, d.y, hub.y, hub.y, f);
            ctx.beginPath();
            ctx.arc(x, y, 2.4, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(167,143,255,${0.95 * fade * rg})`;
            ctx.fill();
          }
        }
      }
    },
    [prospects]
  );

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
  const sent = (() => {
    if (dt < T.sendStart) return 0;
    const f = clamp01((dt - T.sendStart) / (T.sendCountEnd - T.sendStart));
    return Math.floor(easeOut(f) * SENT_TOTAL);
  })();
  const fleetLive = (() => {
    let c = 0;
    for (let i = 0; i < domainNames.length; i++) if (dt >= T.fleetStart + i * T.fleetStagger) c++;
    return c;
  })();
  const mailboxesLive = Math.min(21, fleetLive * 3); // 7 domains × 3 inboxes
  const campaignLive = dt >= T.campaignIn[1] - 0.2;
  const replyShown = (p: number) => prospects[p].replies && dt >= arriveAt(p) + T.replyDelay + 0.3;
  const repliesSoFar = prospects.reduce((acc, _, p) => acc + (replyShown(p) ? 1 : 0), 0);
  const activeNarration = dt >= arriveAt(1) + T.replyDelay ? 4 : dt >= T.receiveStart ? 3 : dt >= T.sendStart - 0.2 ? 2 : dt >= 0.4 ? 1 : 0;

  const L = layoutRef.current;
  const px = (v: number, total: number) => `${(v / total) * 100}%`;

  return (
    <div ref={rootRef} className="relative h-full w-full overflow-hidden bg-ink-950">
      <div className="absolute inset-0 bg-grid-fine opacity-[0.16]" />
      <div className="absolute inset-0" style={{ background: "radial-gradient(70% 60% at 60% 50%, rgba(255,90,77,0.06), transparent 60%)" }} />
      <div className="noise" />
      <canvas ref={canvasRef} className="absolute inset-0" />

      <NarrationRail
        eyebrow={<><span className="dot" /> Step 05 · Live sending</>}
        headline={<><span className="text-gradient">We go live</span><br /><span className="text-gradient-accent">and the replies come in.</span></>}
        steps={steps}
        activeCount={activeNarration}
        reduced={reduce}
      />

      {/* live "emails sent" counter */}
      <div className="absolute top-9 right-9 z-30 flex items-center gap-2 chip">
        <span className="w-1.5 h-1.5 rounded-full bg-accent shadow-[0_0_10px_#ff5a4d] animate-pulse" />
        <span className="font-display text-[20px] text-white leading-none tabular-nums">{sent.toLocaleString()}</span>
        <span className="text-white/45">emails sent</span>
      </div>

      {L && (
        <>
          {/* ── LEFT: Instantly campaign card (the sending hub) ── */}
          <div
            className="absolute z-20"
            style={{
              left: px(L.fleet.x, L.w),
              top: px(L.hub.y, L.h),
              transform: `translate(-50%,-50%) scale(${reduce ? 1 : lerp(0.85, 1, clamp01(seg(dt, T.campaignIn[0], T.campaignIn[1])))})`,
              opacity: clamp01(seg(dt, T.campaignIn[0], T.campaignIn[1])),
              width: "min(280px, 23vw)",
            }}
          >
            <div className="rounded-2xl glass p-4 shadow-[0_20px_60px_rgba(0,0,0,0.5)]">
              <div className="flex items-center gap-2.5 mb-3">
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-white shrink-0 shadow-[0_1px_4px_rgba(0,0,0,0.4)]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/logos/instantly.png" alt="Instantly" width={20} height={20} style={{ width: 20, height: 20 }} className="object-contain" />
                </span>
                <div className="leading-tight min-w-0">
                  <div className="font-mono text-[13px] text-white truncate">Instantly</div>
                  <div className="text-[10px] text-white/45 truncate">{businessName} · cold outreach</div>
                </div>
                <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-accent/15 border border-accent/40 px-2.5 py-1 text-[10px] font-mono text-accent transition-opacity" style={{ opacity: campaignLive ? 1 : 0 }}>
                  <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" /> LIVE
                </span>
              </div>
              <div className="space-y-1.5 text-[12px] font-mono text-white/65">
                <Row label="Campaign" value="Q3 · Founders" />
                <Row label="Mailboxes" value={`${mailboxesLive} / 21`} />
                <Row label="Status" value={campaignLive ? "Sending" : "Starting…"} accent={campaignLive} />
              </div>
            </div>
          </div>

          {/* sending fleet — a tidy single row of provider tiles (7 domains × 3) */}
          <div className="absolute z-20" style={{ left: px(L.fleet.x, L.w), top: px(L.fleet.y, L.h), transform: "translate(-50%,-50%)" }}>
            <div className="flex flex-col items-center gap-1.5">
              <div className="flex items-center gap-1.5">
                {domainNames.map((d, i) => {
                  const a = clamp01((dt - (T.fleetStart + i * T.fleetStagger)) / 0.4);
                  if (a <= 0) return <span key={d} style={{ width: 22 }} />;
                  return (
                    <span key={d} style={{ opacity: a, transform: `translateY(${(1 - a) * 8}px)` }} title={d}>
                      <ProviderLogo provider={providerOf(i)} size={22} />
                    </span>
                  );
                })}
              </div>
              <span className="text-[9px] font-mono uppercase tracking-[0.16em] text-white/35">21 mailboxes · 7 domains</span>
            </div>
          </div>

          {/* ── RIGHT: prospect receive rows (kept — inbox / replied) ── */}
          {L.prospects.map((p, i) => {
            const arrive = arriveAt(i);
            const a = clamp01(seg(dt, arrive - 0.55, arrive + 0.1));
            if (a <= 0) return null;
            const landed = dt >= arrive + 0.45;
            const replied = replyShown(i);
            return (
              <div
                key={i}
                className="absolute z-20"
                style={{ left: px(p.x, L.w), top: px(p.y, L.h), transform: `translate(-50%,-50%) translateX(${(1 - easeOut(a)) * 26}px)`, opacity: a, width: "min(250px, 20vw)" }}
              >
                <div className="rounded-xl bg-ink-800/95 border px-3 py-2 backdrop-blur-sm shadow-[0_8px_24px_rgba(0,0,0,0.45)] transition-colors" style={{ borderColor: replied ? "rgba(124,92,255,0.5)" : landed ? "rgba(255,90,77,0.32)" : "rgba(255,255,255,0.1)" }}>
                  <div className="flex items-center gap-2.5">
                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full shrink-0 text-[11px] font-mono text-white/80" style={{ background: `hsl(${(i * 47) % 360} 45% 22%)`, border: "1px solid rgba(255,255,255,0.12)" }}>
                      {prospects[i].name.split(" ").map((s) => s[0]).join("")}
                    </span>
                    <div className="leading-tight min-w-0 flex-1">
                      <div className="text-[12.5px] text-white truncate">{prospects[i].name}</div>
                      <div className="text-[10px] text-white/45 truncate">{prospects[i].role} · {prospects[i].company}</div>
                    </div>
                    <span className="shrink-0">
                      {replied ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-violet-glow/15 border border-violet-glow/45 px-2 py-0.5 text-[9.5px] font-mono text-violet-glow">
                          <ReplyIcon /> replied
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9.5px] font-mono transition-all" style={{ opacity: landed ? 1 : 0, background: "rgba(255,90,77,0.12)", border: "1px solid rgba(255,90,77,0.4)", color: "#ff5a4d" }}>
                          <CheckIcon /> inbox
                        </span>
                      )}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}

          {/* inline labels (replace the overlapping cadence gauge + summary card) */}
          <Callout
            x={px(L.w * 0.64, L.w)}
            y={px(L.h * 0.235, L.h)}
            anchor="center"
            tone="accent"
            label="Metered cadence"
            value={`~${PER_INBOX_PER_DAY}`}
            sub="per inbox / day — never a blast"
            appear={seg(dt, T.sendStart, T.sendStart + 0.9)}
            reduced={reduce}
          />
          <Callout
            x={px(L.w * 0.64, L.w)}
            y={px(L.h * 0.7, L.h)}
            anchor="center"
            tone="violet"
            label="Replies route back to you"
            value={repliesSoFar > 0 ? repliesSoFar : undefined}
            appear={seg(dt, arriveAt(1) + T.replyDelay, arriveAt(1) + T.replyDelay + 0.7)}
            reduced={reduce}
            className="[&_*]:!normal-case"
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

function Row({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-white/40 shrink-0">{label}</span>
      <span className={`truncate ${accent ? "text-accent" : "text-white"}`}>{value}</span>
    </div>
  );
}

function CheckIcon() {
  return <svg width="9" height="9" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
function ReplyIcon() {
  return <svg width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M9 17l-5-5 5-5M4 12h11a5 5 0 0 1 5 5v1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
function bez(p0: number, p1: number, p2: number, p3: number, t: number) {
  const u = 1 - t;
  return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
}
