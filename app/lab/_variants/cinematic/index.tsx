"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { gsap } from "gsap";
import { useReducedMotion } from "framer-motion";
import type { SetupVariantProps } from "../../types";
import { buildSendingDomains, buildMailboxes } from "../../../lib/domains";

const NS = "http://www.w3.org/2000/svg";
const DNS = ["SPF", "DKIM", "DMARC"];

/**
 * CINEMATIC PIPELINE — the reference. The system is CONSTRUCTED in space, left
 * to right: the primary domain flies in, connectors draw outward and seven
 * sending domains travel out of it into formation, each ejects three Google/
 * Microsoft mailboxes, authentication seals fly in and stamp, then redirect
 * arrows curve back to the primary. Nothing is a stagger-fade of a fixed grid —
 * elements move from a source to a destination.
 */
export default function CinematicSetup({ businessName, slug, mainDomain }: SetupVariantProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const seedRef = useRef<HTMLDivElement>(null);
  const connRef = useRef<SVGGElement>(null);
  const redirectRef = useRef<SVGGElement>(null);
  const counterRef = useRef<HTMLSpanElement>(null);
  const tlRef = useRef<gsap.core.Timeline | null>(null);
  const reduce = !!useReducedMotion();
  const [replayKey, setReplayKey] = useState(0);

  const domains = useMemo(() => buildSendingDomains(slug), [slug]);
  const mailboxes = useMemo(() => buildMailboxes(domains, 3), [domains]);
  const providerOf = (di: number) => (di === 3 ? "outlook" : "gmail");

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      const stage = stageRef.current;
      const seed = seedRef.current;
      const connG = connRef.current;
      const redirectG = redirectRef.current;
      if (!stage || !seed || !connG || !redirectG) return;

      // Clear any paths from a previous run (replay rebuilds from clean layout).
      connG.innerHTML = "";
      redirectG.innerHTML = "";

      // Center the seed via transform percentages (so x/y stay free to animate).
      gsap.set(seed, { xPercent: -50, yPercent: -50 });

      const sBox = stage.getBoundingClientRect();
      const localCenter = (el: Element) => {
        const b = el.getBoundingClientRect();
        return { x: b.left + b.width / 2 - sBox.left, y: b.top + b.height / 2 - sBox.top };
      };
      const localLeft = (el: Element) => {
        const b = el.getBoundingClientRect();
        return { x: b.left - sBox.left, y: b.top + b.height / 2 - sBox.top };
      };
      const localRight = (el: Element) => {
        const b = el.getBoundingClientRect();
        return { x: b.right - sBox.left, y: b.top + b.height / 2 - sBox.top };
      };

      const seedC = localCenter(seed);
      const seedR = localRight(seed);
      const domEls = gsap.utils.toArray<HTMLElement>(".cin-domain");

      // Match the SVG user space to the stage pixels.
      const svg = stage.querySelector("svg");
      svg?.setAttribute("viewBox", `0 0 ${sBox.width} ${sBox.height}`);

      // Build the feed connectors (seed -> each domain) and the redirect arrows
      // (each domain -> seed). Paths are measured from the real layout.
      const connPaths: SVGPathElement[] = [];
      const redirectPaths: SVGPathElement[] = [];
      domEls.forEach((d) => {
        const dl = localLeft(d);
        const c1x = (seedR.x + dl.x) / 2;
        const feed = document.createElementNS(NS, "path");
        feed.setAttribute("d", `M ${seedR.x} ${seedR.y} C ${c1x} ${seedR.y}, ${c1x} ${dl.y}, ${dl.x} ${dl.y}`);
        feed.setAttribute("fill", "none");
        feed.setAttribute("stroke", "url(#cinGrad)");
        feed.setAttribute("stroke-width", "1.6");
        connG.appendChild(feed);
        const len = feed.getTotalLength();
        gsap.set(feed, { strokeDasharray: len, strokeDashoffset: len });
        connPaths.push(feed);

        const dr = localRight(d);
        const back = document.createElementNS(NS, "path");
        const bcx = (dr.x + seedR.x) / 2;
        back.setAttribute("d", `M ${dr.x} ${dr.y} C ${bcx} ${dr.y + 60}, ${bcx} ${seedC.y + 60}, ${seedC.x} ${seedC.y + 22}`);
        back.setAttribute("fill", "none");
        back.setAttribute("stroke", "rgba(124,92,255,0.5)");
        back.setAttribute("stroke-width", "1.2");
        back.setAttribute("stroke-dasharray", "3 4");
        redirectG.appendChild(back);
        const blen = back.getTotalLength();
        gsap.set(back, { strokeDasharray: blen, strokeDashoffset: blen, opacity: 0 });
        redirectPaths.push(back);
      });

      // Initial states — everything staged at/off its origin, ready to build.
      gsap.set(seed, { x: -sBox.width * 0.22, opacity: 0, scale: 0.5 });
      domEls.forEach((d) => {
        const dc = localCenter(d);
        gsap.set(d, { x: seedC.x - dc.x, y: seedC.y - dc.y, scale: 0.2, opacity: 0 });
      });
      gsap.set(".cin-title-line", { xPercent: -8, opacity: 0 });
      gsap.set(".cin-counter-wrap, .cin-zap", { opacity: 0, x: -20 });
      gsap.set(".cin-inbox", { x: -34, scale: 0.3, opacity: 0 });
      gsap.set(".cin-check", { scale: 0, opacity: 0 });
      gsap.set(".cin-seal", { x: 160, opacity: 0 });
      gsap.set(".cin-live", { opacity: 0, y: 14 });

      const setCounter = (v: string) => {
        if (counterRef.current) counterRef.current.textContent = v;
      };
      const counter = { v: 0 };

      const tl = gsap.timeline({ paused: true });
      tlRef.current = tl;

      // 1 — title + the seed flies in from the left.
      tl.to(".cin-title-line", { xPercent: 0, opacity: 1, duration: 0.7, stagger: 0.1, ease: "power3.out" }, 0)
        .to(seed, { x: 0, opacity: 1, scale: 1, duration: 0.9, ease: "back.out(1.5)" }, 0.2)
        .to(".cin-seed-core", { boxShadow: "0 0 50px rgba(124,245,208,0.7)", duration: 0.4, yoyo: true, repeat: 1 }, 1.0)
        .to(".cin-zap", { opacity: 1, x: 0, duration: 0.5 }, 0.9)
        .to(".cin-counter-wrap", { opacity: 1, x: 0, duration: 0.5 }, 1.0);

      // 2 — connectors draw out and the seven domains travel into formation.
      tl.to(connPaths, { strokeDashoffset: 0, duration: 0.7, stagger: 0.1, ease: "power2.inOut" }, 1.5)
        .to(domEls, { x: 0, y: 0, scale: 1, opacity: 1, duration: 0.75, stagger: 0.1, ease: "power3.out" }, 1.55);

      // 3 — each domain ejects three mailboxes; the counter climbs to 21.
      tl.to(".cin-inbox", { x: 0, scale: 1, opacity: 1, duration: 0.4, stagger: 0.025, ease: "back.out(1.7)" }, 3.4)
        .to(counter, {
          v: 21,
          duration: 1.6,
          ease: "none",
          onStart: () => setCounter("0"),
          onUpdate: () => setCounter(String(Math.round(counter.v))),
        }, 3.4);

      // 4 — authentication seals fly in and stamp; checks cascade on every domain.
      tl.to(".cin-seal", { x: 0, opacity: 1, duration: 0.5, stagger: 0.16, ease: "power3.out" }, 5.4)
        .to(".cin-seal", { scale: 1.18, duration: 0.16, yoyo: true, repeat: 1, stagger: 0.16 }, 5.7)
        .to(".cin-check", { scale: 1, opacity: 1, duration: 0.35, stagger: 0.07, ease: "back.out(2)" }, 5.9);

      // 5 — redirect arrows curve back to the primary; go-live.
      tl.to(redirectPaths, { strokeDashoffset: 0, opacity: 1, duration: 0.6, stagger: 0.08, ease: "power2.inOut" }, 7.0)
        .to(".cin-seed-core", { boxShadow: "0 0 60px rgba(124,245,208,0.9)", scale: 1.06, duration: 0.5, yoyo: true, repeat: 1 }, 7.4)
        .to(".cin-live", { opacity: 1, y: 0, duration: 0.6, ease: "power3.out" }, 7.8);

      if (reduce) tl.progress(1);
      else tl.play();
    }, stageRef);

    return () => ctx.revert();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, reduce, replayKey]);

  // Replay rebuilds the whole effect so measured paths/positions are clean.
  const replay = () => setReplayKey((n) => n + 1);

  return (
    <div ref={stageRef} className="relative h-full w-full overflow-hidden bg-ink-950">
      <div className="absolute inset-0 bg-grid-fine opacity-20" />
      <div className="absolute inset-0" style={{ background: "radial-gradient(circle at 28% 50%, rgba(124,245,208,0.10), transparent 62%)" }} />
      <div className="noise" />

      {/* connector + redirect layer */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" preserveAspectRatio="none">
        <defs>
          <linearGradient id="cinGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#7cf5d0" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#7c5cff" stopOpacity="0.55" />
          </linearGradient>
        </defs>
        <g ref={redirectRef} />
        <g ref={connRef} />
      </svg>

      {/* title + counter */}
      <div className="absolute top-12 left-12 z-20 max-w-[300px]">
        <div className="cin-title-line chip mb-4"><span className="dot" /> Step 01 · Setup · ~1 day</div>
        <h2 className="font-display text-[30px] md:text-[40px] leading-[0.97] tracking-[-0.02em]">
          <span className="cin-title-line block text-gradient">We build {businessName}&apos;s</span>
          <span className="cin-title-line block text-gradient-accent">sending infrastructure.</span>
        </h2>
        <div className="cin-counter-wrap mt-5 flex items-end gap-2">
          <span ref={counterRef} className="cin-counter font-display text-[44px] leading-none text-white">21</span>
          <span className="pb-1.5 text-[11px] font-mono text-white/45">mailboxes<br />7 domains × 3</span>
        </div>
        <div className="cin-zap mt-4 inline-flex items-center gap-2 chip">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logos/zapmail.png" alt="" width={14} height={14} style={{ width: 14, height: 14 }} className="object-contain" />
          provisioned via Zapmail
        </div>
      </div>

      {/* seed / primary domain */}
      <div ref={seedRef} className="cin-seed absolute z-20" style={{ left: "15%", top: "50%" }}>
        <div className="cin-seed-core relative flex items-center gap-2 rounded-xl bg-accent/12 border border-accent/50 px-4 py-3 font-mono text-sm text-accent">
          <span className="w-2 h-2 rounded-full bg-accent shadow-[0_0_10px_#7cf5d0]" />
          <div className="leading-tight">
            <div className="text-white text-[13px]">{mainDomain}</div>
            <div className="text-[9px] uppercase tracking-[0.2em] text-accent/70">primary domain</div>
          </div>
        </div>
        <div className="cin-live mt-3 text-center text-[10px] font-mono uppercase tracking-[0.2em] text-accent/80">
          ✓ all domains live &amp; redirecting
        </div>
      </div>

      {/* domain column */}
      <div className="absolute z-20" style={{ left: "43%", top: "50%", width: "50%", transform: "translateY(-50%)" }}>
        <div className="flex flex-col gap-2">
          {domains.map((d, di) => {
            const mb = mailboxes.slice(di * 3, di * 3 + 3);
            const provider = providerOf(di);
            return (
              <div key={d} className="cin-domain flex items-center gap-3 rounded-lg bg-white/[0.035] border border-white/8 px-3 py-2 backdrop-blur-sm">
                <div className="relative">
                  <span className="cin-check absolute -top-1.5 -left-1.5 w-4 h-4 rounded-full bg-accent text-ink-950 text-[9px] flex items-center justify-center font-bold shadow-[0_0_10px_#7cf5d0]">✓</span>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/logos/${provider}.png`} alt={provider} width={18} height={18} style={{ width: 18, height: 18 }} className="object-contain" />
                </div>
                <div className="font-mono text-[12px] text-white w-[150px] truncate shrink-0">{d}</div>
                <div className="flex items-center gap-1.5">
                  {mb.map((m, mi) => (
                    <span
                      key={mi}
                      className="cin-inbox inline-flex items-center gap-1.5 rounded-md bg-ink-900/80 border border-white/10 pl-1 pr-2 py-1"
                      title={m.handle}
                    >
                      <span
                        className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-mono text-white"
                        style={{ background: `conic-gradient(from ${m.hue}deg, #7cf5d0, #7c5cff, #7cf5d0)` }}
                      >
                        <span className="bg-ink-900 w-4 h-4 rounded-full flex items-center justify-center">
                          {m.name.split(" ").map((n) => n[0]).join("")}
                        </span>
                      </span>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`/logos/${provider}.png`} alt="" width={11} height={11} style={{ width: 11, height: 11 }} className="object-contain opacity-90" />
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* authentication seals */}
      <div className="absolute top-12 right-12 z-20 flex flex-col items-end gap-2">
        <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/35">Authentication</div>
        <div className="flex gap-2">
          {DNS.map((rec) => (
            <span key={rec} className="cin-seal inline-flex items-center gap-1.5 rounded-md bg-violet-glow/10 border border-violet-glow/45 px-2.5 py-1.5 text-[11px] font-mono text-violet-glow">
              <span className="text-accent">✓</span>
              {rec}
            </span>
          ))}
        </div>
      </div>

      <ReplayBtn onClick={replay} />
    </div>
  );
}

function ReplayBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="absolute bottom-6 right-6 z-30 inline-flex items-center gap-2 rounded-full glass px-4 py-2.5 text-[11px] font-mono uppercase tracking-[0.18em] text-white/70 hover:text-accent transition cursor-pointer"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
        <path d="M3 12a9 9 0 1 0 3-6.7M3 4v4h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      Replay
    </button>
  );
}
