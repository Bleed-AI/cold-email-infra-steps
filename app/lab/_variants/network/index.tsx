"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import type { ScreenProps } from "../../types";
import { buildSendingDomains, buildMailboxes } from "../../../lib/domains";
import {
  useScrubClock,
  useDeckHandle,
  seg,
  easeOut,
  easeOutBack,
  clamp01,
  lerp,
  phase,
} from "../../engine/useScrubClock";
import { NarrationRail, type NarrationStep } from "../../engine/NarrationRail";
import { Callout } from "../../engine/Callout";
import { GmailMark } from "../../engine/ProviderLogo";

// ── Beat timeline (seconds). Everything is a pure function of these. ──
const N = 7; // sending domains
const M = N * 3; // 21 mailboxes
const T = {
  primaryIn: [0.2, 1.4] as [number, number],
  subStart: 1.6,
  subStagger: 0.16,
  subGrow: 0.72,
  mbStart: 3.5,
  mbStagger: 0.14, // across all 21
  mbGrow: 0.5,
  authStart: 7.2,
  authStagger: 0.07, // across all 21
  redirectStart: 9.4,
  redirectDraw: 1.7,
};
const DURATION = 12.0; // build length; after this the purple redirect loop runs forever
const REDIRECT_PERIOD = 3.4; // ambient packet period (seconds)

const mbAppear = (k: number) => T.mbStart + k * T.mbStagger;
const authAt = (k: number) => T.authStart + k * T.authStagger;

type Pt = { x: number; y: number };
type Layout = {
  w: number;
  h: number;
  primary: Pt;
  subs: Pt[];
  mailboxes: Pt[]; // 21, indexed k = 3*i + j
};

export default function NetworkSetup({ businessName, slug, mainDomain, deckHandleRef, onDone }: ScreenProps) {
  const reduce = !!useReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const layoutRef = useRef<Layout | null>(null);
  const lastTRef = useRef(0);
  const pushedRef = useRef(-1); // perf: stop pushing React state after the build
  const [dt, setDt] = useState(0);
  const [replayKey, setReplayKey] = useState(0);

  const domainNames = useMemo(() => buildSendingDomains(slug), [slug]);
  const mailboxes = useMemo(() => buildMailboxes(domainNames, 3), [domainNames]);

  const steps: NarrationStep[] = useMemo(
    () => [
      {
        n: "01",
        title: "Start from your real domain",
        detail: (
          <p>
            <span className="text-white/80">{mainDomain}</span> is {businessName}&apos;s real website. We
            never send cold email from it — so its reputation is never at risk.
          </p>
        ),
      },
      {
        n: "02",
        title: "Spin up 7 sending domains",
        detail: (
          <p>
            We register a handful of close lookalike domains (you approve the names) and provision them
            through <span className="text-white/80">Zapmail</span>. If one ever gets flagged, your main
            domain is untouched.
          </p>
        ),
      },
      {
        n: "03",
        title: "3 mailboxes on every domain",
        detail: (
          <p>
            Three Google inboxes per domain — enough volume to scale, few enough that every provider
            treats each mailbox like a normal person. That&apos;s{" "}
            <span className="text-white/80">21 mailboxes</span> in total.
          </p>
        ),
      },
      {
        n: "04",
        title: "Authenticate: SPF · DKIM · DMARC",
        detail: (
          <p>
            These are the ID badges every inbox provider checks before letting mail in. We set all three
            on every domain — so you land in the inbox, not spam.
          </p>
        ),
      },
      {
        n: "05",
        title: "Redirect back to your site",
        detail: (
          <p>
            Each sending domain redirects to <span className="text-white/80">{mainDomain}</span>, so a
            curious prospect who clicks the domain lands on your real site. Whole setup: ~1 day.
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
    const primary: Pt = { x: w * 0.4, y: h * 0.52 };
    // 21 mailboxes evenly distributed in one column (uniform spacing → no
    // overlap, clear of the top nav). Each subdomain aligns to the MIDDLE
    // mailbox of its group of 3, so sub→mailbox branches read as a tidy tree.
    const mailboxesPts: Pt[] = [];
    for (let k = 0; k < M; k++) {
      mailboxesPts.push({ x: w * 0.66, y: lerp(h * 0.13, h * 0.95, k / (M - 1)) });
    }
    const subs: Pt[] = Array.from({ length: N }, (_, i) => ({
      x: w * 0.53,
      y: mailboxesPts[i * 3 + 1].y,
    }));
    layoutRef.current = { w, h, primary, subs, mailboxes: mailboxesPts };
  }, []);

  // ── canvas: connectors + one-shot green packets + looping purple redirects ──
  const drawCanvas = useCallback((t: number) => {
    const ctx = ctxRef.current;
    const L = layoutRef.current;
    if (!ctx || !L) return;
    const { w, h, primary, subs, mailboxes: mb } = L;
    ctx.clearRect(0, 0, w, h);

    // primary glow (gentle seamless breathe in the ambient phase)
    const pIn = easeOut(seg(t, T.primaryIn[0], T.primaryIn[1]));
    if (pIn > 0) {
      // breathe period == REDIRECT_PERIOD so the whole ambient frame is
      // periodic with one period (provably seamless: renderAt(t)==renderAt(t+P)).
      const breathe = 1 + 0.06 * Math.sin((t / REDIRECT_PERIOD) * Math.PI * 2);
      const r = 86 * breathe;
      const g = ctx.createRadialGradient(primary.x, primary.y, 0, primary.x, primary.y, r);
      g.addColorStop(0, `rgba(255,90,77,${0.22 * pIn})`);
      g.addColorStop(1, "rgba(255,90,77,0)");
      ctx.fillStyle = g;
      ctx.fillRect(primary.x - r - 10, primary.y - r - 10, (r + 10) * 2, (r + 10) * 2);
    }

    // ── primary → subdomain connectors (+ one-shot creation packet) ──
    for (let i = 0; i < N; i++) {
      const s = subs[i];
      const a0 = T.subStart + i * T.subStagger;
      const grow = easeOut(seg(t, a0, a0 + T.subGrow));
      if (grow <= 0) continue;
      const ex = lerp(primary.x, s.x, grow);
      const ey = lerp(primary.y, s.y, grow);
      const midx = (primary.x + s.x) / 2;
      ctx.beginPath();
      ctx.moveTo(primary.x, primary.y);
      ctx.bezierCurveTo(midx, primary.y, midx, ey, ex, ey);
      ctx.strokeStyle = "rgba(255,90,77,0.3)";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // ONE green packet travels primary→sub as it's created, then is gone.
      const pk = seg(t, a0 + 0.06, a0 + T.subGrow + 0.42);
      if (pk > 0 && pk < 1) {
        const f = pk;
        const bx = bez(primary.x, midx, midx, s.x, f);
        const by = bez(primary.y, primary.y, s.y, s.y, f);
        const fade = Math.sin(Math.PI * f);
        ctx.beginPath();
        ctx.arc(bx, by, 2.6, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,150,135,${0.95 * fade})`;
        ctx.shadowColor = "rgba(255,90,77,0.9)";
        ctx.shadowBlur = 8;
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      // ── subdomain → its 3 mailbox connectors (+ one-shot reveal packet) ──
      if (grow >= 1) {
        for (let j = 0; j < 3; j++) {
          const k = i * 3 + j;
          const m = mb[k];
          const a1 = mbAppear(k);
          const g2 = easeOut(seg(t, a1, a1 + T.mbGrow));
          if (g2 <= 0) continue;
          const mx = lerp(s.x, m.x, g2);
          const my = lerp(s.y, m.y, g2);
          ctx.beginPath();
          ctx.moveTo(s.x, s.y);
          ctx.lineTo(mx, my);
          ctx.strokeStyle = "rgba(255,90,77,0.22)";
          ctx.lineWidth = 1.1;
          ctx.stroke();

          // one-shot green pulse on auth (ID badge applied)
          const ar = seg(t, authAt(k), authAt(k) + 0.7);
          if (ar > 0 && ar < 1) {
            ctx.beginPath();
            ctx.arc(m.x, m.y, 6 + ar * 16, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(124,92,255,${0.55 * (1 - ar)})`;
            ctx.lineWidth = 2;
            ctx.stroke();
          }
        }
      }
    }

    // ── purple redirect arcs sub→primary: draw once, then loop packets forever ──
    for (let i = 0; i < N; i++) {
      const s = subs[i];
      const a2 = T.redirectStart + i * 0.05;
      const draw = seg(t, a2, T.redirectStart + T.redirectDraw);
      if (draw <= 0) continue;
      const midx = (s.x + primary.x) / 2;
      const bow = 46;
      const c1: Pt = { x: midx, y: s.y + bow };
      const c2: Pt = { x: midx, y: primary.y + bow };
      // faint static dashed guide (drawn progressively, then full)
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      const segs = 48;
      const upTo = Math.max(1, Math.floor(segs * draw));
      for (let q = 1; q <= upTo; q++) {
        const f = q / segs;
        ctx.lineTo(bez(s.x, c1.x, c2.x, primary.x, f), bez(s.y, c1.y, c2.y, primary.y, f));
      }
      ctx.strokeStyle = "rgba(124,92,255,0.32)";
      ctx.lineWidth = 1.1;
      ctx.setLineDash([3, 5]);
      ctx.stroke();
      ctx.setLineDash([]);

      // ambient: packets flow sub→primary (seamless: phase + sin fade at both ends)
      if (draw >= 1) {
        const nPk = 3;
        for (let p = 0; p < nPk; p++) {
          const f = phase(t, REDIRECT_PERIOD, i * 0.11 + p / nPk);
          const fade = Math.sin(Math.PI * f);
          const x = bez(s.x, c1.x, c2.x, primary.x, f);
          const y = bez(s.y, c1.y, c2.y, primary.y, f);
          ctx.beginPath();
          ctx.arc(x, y, 2.1, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(167,143,255,${0.85 * fade})`;
          ctx.fill();
        }
      }
    }
  }, []);

  const onFrame = useCallback(
    (t: number) => {
      const prev = lastTRef.current;
      if (t < prev - 0.5) pushedRef.current = -1; // replay/restart → resume pushing
      lastTRef.current = t;
      drawCanvas(t);
      // PERF: only push per-frame React state during the build; freeze after.
      if (pushedRef.current < DURATION) {
        const clamped = Math.min(t, DURATION);
        pushedRef.current = clamped;
        setDt(clamped);
      }
    },
    [drawCanvas]
  );

  // canvas setup + resize
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

  const controls = useScrubClock(onFrame, {
    duration: DURATION,
    reduced: reduce,
    autoPlay: !deckHandleRef,
    onDone,
    loop: true,
  });
  useDeckHandle(controls, deckHandleRef);

  // ── derived overlay state from display-time ──
  const mailboxCount = (() => {
    let c = 0;
    for (let k = 0; k < M; k++) if (dt >= mbAppear(k)) c++;
    return c;
  })();
  const subCount = (() => {
    let c = 0;
    for (let i = 0; i < N; i++) if (dt >= T.subStart + i * T.subStagger + T.subGrow * 0.5) c++;
    return c;
  })();
  const activeNarration =
    dt >= T.redirectStart ? 5 : dt >= T.authStart ? 4 : dt >= T.mbStart ? 3 : dt >= T.subStart ? 2 : dt >= 0.4 ? 1 : 0;

  const L = layoutRef.current;
  const px = (v: number, total: number) => `${(v / total) * 100}%`;

  return (
    <div ref={rootRef} className="relative h-full w-full overflow-hidden bg-ink-950">
      <div className="absolute inset-0 bg-grid-fine opacity-[0.16]" />
      <div
        className="absolute inset-0"
        style={{ background: "radial-gradient(70% 60% at 58% 50%, rgba(255,90,77,0.07), transparent 60%)" }}
      />
      <div className="noise" />
      <canvas ref={canvasRef} className="absolute inset-0" />

      {/* narration rail */}
      <NarrationRail
        eyebrow={<><span className="dot" /> Step 01 · Setup · ~1 day</>}
        headline={
          <>
            <span className="text-gradient">We build {businessName}&apos;s</span>
            <br />
            <span className="text-gradient-accent">sending infrastructure.</span>
          </>
        }
        steps={steps}
        activeCount={activeNarration}
        reduced={reduce}
      />

      {/* live mailbox counter (animated number label) */}
      <div className="absolute top-9 right-9 z-30 flex items-center gap-2 chip">
        <span className="font-display text-[20px] text-white leading-none tabular-nums">{mailboxCount}</span>
        <span className="text-white/45">/ {M} mailboxes</span>
      </div>

      {L && (
        <>
          {/* primary domain node */}
          <Node x={px(L.primary.x, L.w)} y={px(L.primary.y, L.h)} appear={seg(dt, T.primaryIn[0], T.primaryIn[1])} reduced={reduce}>
            <div className="flex flex-col items-center gap-1.5">
              <div className="inline-flex items-center gap-1.5 rounded-lg bg-accent/12 border border-accent/45 px-3 py-2 backdrop-blur-sm">
                <span className="w-2 h-2 rounded-full bg-accent shadow-[0_0_10px_#ff5a4d]" />
                <span className="font-mono text-[13px] text-white">{mainDomain}</span>
              </div>
              <span className="text-[9px] font-mono uppercase tracking-[0.2em] text-accent/70">primary domain</span>
              <span
                className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-ink-900/80 border border-white/12 pl-2 pr-2.5 py-1 transition-opacity"
                style={{ opacity: clamp01(seg(dt, 0.6, 1.4)) }}
              >
                <span className="text-[8.5px] font-mono uppercase tracking-[0.14em] text-white/40">via</span>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logos/zapmail.svg" alt="Zapmail" height={11} style={{ height: 11, width: "auto" }} className="object-contain opacity-90" />
              </span>
            </div>
          </Node>

          {/* subdomain nodes */}
          {domainNames.map((name, i) => {
            const a0 = T.subStart + i * T.subStagger;
            const grow = seg(dt, a0, a0 + T.subGrow);
            const cur = layoutRef.current!;
            const x = lerp(cur.primary.x, cur.subs[i].x, easeOut(grow));
            const y = lerp(cur.primary.y, cur.subs[i].y, easeOut(grow));
            return (
              <Node key={name} x={px(x, cur.w)} y={px(y, cur.h)} appear={clamp01(grow * 1.4)} reduced={reduce}>
                <div className="flex items-center gap-1.5 rounded-md bg-ink-900/70 border border-white/10 px-2 py-1 backdrop-blur-sm">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: "#ff5a4d", boxShadow: "0 0 8px #ff5a4d" }} />
                  <span className="font-mono text-[11.5px] text-white whitespace-nowrap leading-none">{name}</span>
                </div>
              </Node>
            );
          })}

          {/* 21 mailbox chips — real Gmail square icon + inbox name + auth check */}
          {mailboxes.map((m, k) => {
            const cur = layoutRef.current!;
            const i = Math.floor(k / 3);
            const a1 = mbAppear(k);
            const a = clamp01((dt - a1) / T.mbGrow);
            if (a <= 0) return null;
            const local = m.handle.split("@")[0];
            const authOk = dt >= authAt(k) + 0.25;
            const sx = cur.subs[i].x;
            const x = lerp(sx, cur.mailboxes[k].x, easeOut(a));
            const y = cur.mailboxes[k].y;
            return (
              <div
                key={k}
                className="absolute z-20"
                style={{ left: px(x, cur.w), top: px(y, cur.h), transform: "translate(0,-50%)", opacity: a }}
              >
                <div
                  className="inline-flex items-center gap-1.5 rounded-md bg-ink-800/90 border border-white/10 pl-1 pr-2 py-1 backdrop-blur-sm shadow-[0_4px_14px_rgba(0,0,0,0.4)]"
                  style={{ transform: reduce ? "none" : `translateX(${(1 - easeOutBack(a)) * -16}px)` }}
                >
                  <span className="inline-flex items-center justify-center rounded-[3px] bg-white shrink-0" style={{ width: 16, height: 16 }}>
                    <GmailMark size={11} />
                  </span>
                  <span className="font-mono text-[10.5px] text-white/90 leading-none whitespace-nowrap">{local}</span>
                  <span
                    className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full shrink-0 transition-all duration-300"
                    style={{
                      background: authOk ? "rgba(255,90,77,0.18)" : "rgba(255,255,255,0.06)",
                      border: `1px solid ${authOk ? "rgba(255,90,77,0.6)" : "rgba(255,255,255,0.14)"}`,
                    }}
                  >
                    {authOk && (
                      <svg width="8" height="8" viewBox="0 0 24 24" fill="none">
                        <path d="M5 13l4 4L19 7" stroke="#ff5a4d" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </span>
                </div>
              </div>
            );
          })}

          {/* ── inline on-screen labels (Callouts), kept in clear gutters ── */}
          <Callout
            x={px(L.w * 0.43, L.w)}
            y={px(L.h * 0.255, L.h)}
            anchor="center"
            tone="accent"
            label="Subdomains from your domain"
            value={subCount > 0 ? subCount : undefined}
            stem={{ dir: "right", len: 26 }}
            appear={seg(dt, T.subStart + 0.3, T.subStart + 1.2)}
            reduced={reduce}
          />
          <Callout
            x={px(L.w * 0.8, L.w)}
            y={px(L.h * 0.22, L.h)}
            anchor="left"
            tone="accent"
            label="3 inboxes per domain"
            sub="real Google Workspace mailboxes"
            stem={{ dir: "left", len: 30 }}
            appear={seg(dt, T.mbStart + 0.3, T.mbStart + 1.1)}
            reduced={reduce}
          />
          <Callout
            x={px(L.w * 0.8, L.w)}
            y={px(L.h * 0.68, L.h)}
            anchor="left"
            tone="violet"
            label="SPF · DKIM · DMARC"
            sub="every mailbox authenticated"
            stem={{ dir: "left", len: 30 }}
            appear={seg(dt, T.authStart, T.authStart + 0.7)}
            reduced={reduce}
          />
          <Callout
            x={px(L.w * 0.39, L.w)}
            y={px(L.h * 0.88, L.h)}
            anchor="center"
            tone="violet"
            label="Redirecting to your site"
            appear={seg(dt, T.redirectStart + 0.3, T.redirectStart + 1.1)}
            reduced={reduce}
            className="[&_*]:!normal-case"
          />
        </>
      )}

      {/* Standalone Replay (gallery only). In the deck, SlideFrame renders its
          own Replay, so hide this one to avoid a duplicate. */}
      {!deckHandleRef && (
        <button
          onClick={() => {
            setReplayKey((k) => k + 1);
            controls.play();
          }}
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

function Node({
  x,
  y,
  appear,
  reduced,
  children,
}: {
  x: string;
  y: string;
  appear: number;
  reduced?: boolean;
  children: React.ReactNode;
}) {
  const a = clamp01(appear);
  return (
    <div
      className="absolute z-20"
      style={{
        left: x,
        top: y,
        transform: `translate(-50%,-50%) scale(${reduced ? 1 : lerp(0.7, 1, a)})`,
        opacity: a,
        pointerEvents: a > 0.5 ? "auto" : "none",
      }}
    >
      {children}
    </div>
  );
}

// cubic bezier helper (1D) for connector packets
function bez(p0: number, p1: number, p2: number, p3: number, t: number) {
  const u = 1 - t;
  return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
}
