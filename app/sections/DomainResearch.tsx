"use client";

import { useEffect, useMemo, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useClient } from "../context/ClientContext";
import { buildResearchPool, buildSendingDomains, deterministicShuffle } from "../lib/domains";

const RULES = [
  "Short, easy to read",
  "Under 20 characters",
  "No spammy words",
  "No awkward naming",
  "No duplicates",
];

export default function DomainResearch() {
  const ref = useRef<HTMLDivElement>(null);
  const { client } = useClient();
  const businessName = client?.businessName ?? "your business";
  const slug = client?.slug ?? "client";

  const FINAL = useMemo(() => buildSendingDomains(slug), [slug]);

  const domains = useMemo(() => {
    const { approved, rejects } = buildResearchPool(slug);
    const all: { name: string; reject?: boolean }[] = [];
    approved.forEach((name) => all.push({ name }));
    rejects.forEach((name) => all.push({ name, reject: true }));
    return deterministicShuffle(all, slug);
  }, [slug]);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: ref.current,
          start: "top top",
          end: "+=300%",
          scrub: 0.6,
          pin: true,
        },
      });
      tl.from(".s3-kicker", { opacity: 0, y: 20 }, 0)
        .from(".s3-title .line", { yPercent: 110, stagger: 0.06 }, 0)
        .from(".s3-rule", { x: -30, opacity: 0, stagger: 0.06 }, 0.1)
        .from(".s3-chip", {
          opacity: 0,
          y: 20,
          scale: 0.7,
          stagger: { amount: 1.2, from: "random" },
          duration: 0.4,
        }, 0.2)
        .to(".s3-chip.reject", {
          opacity: 0.15,
          scale: 0.9,
          y: 30,
          filter: "grayscale(1)",
          stagger: 0.04,
          duration: 0.5,
        }, 1.4)
        .from(".s3-stat", { opacity: 0, y: 20, stagger: 0.1 }, 1.6)
        .from(".s3-final", {
          opacity: 0,
          y: 30,
          scale: 0.95,
          stagger: 0.08,
          duration: 0.4,
        }, 2.0)
        .to(".s3-final", {
          boxShadow: "0 0 0 1px rgba(124, 245, 208,0.6), 0 0 40px rgba(124, 245, 208,0.25)",
          stagger: 0.05,
        }, 2.4);
    }, ref);
    return () => ctx.revert();
  }, []);

  return (
    <section ref={ref} className="relative h-screen w-full bg-ink-950">
      <div className="sticky top-0 h-screen w-full overflow-hidden">
        <div className="absolute inset-0 bg-grid-fine opacity-30" />
        <div className="absolute inset-0 bg-radial-fade" />

        <div className="relative z-10 h-full max-w-[1500px] mx-auto px-8 grid grid-cols-12 gap-6 pt-20 pb-8">
          {/* LEFT — rules */}
          <div className="col-span-12 md:col-span-3 flex flex-col gap-6">
            <div className="s3-kicker chip self-start">
              <span className="dot" /> Step 02 · We propose your domains
            </div>
            <h2 className="s3-title font-display text-[36px] md:text-[44px] leading-[0.95] tracking-[-0.02em]">
              <span className="block overflow-hidden"><span className="line block text-gradient">Your sending domains,</span></span>
              <span className="block overflow-hidden"><span className="line block text-gradient-accent">hand-picked</span></span>
              <span className="block overflow-hidden"><span className="line block text-gradient">for {businessName}.</span></span>
            </h2>
            <div className="glass rounded-xl p-4 border border-accent/20">
              <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/40">
                Why multiple domains?
              </div>
              <p className="mt-2 text-xs text-white/75 leading-snug">
                If we sent everything from one domain and any inbox provider
                flagged it, your sending would stop overnight. Spreading across
                several means if one gets blocked, the others keep delivering.
              </p>
              <p className="mt-3 text-xs text-white/55 leading-snug">
                Typically <span className="text-accent">5–15 domains</span>{" "}
                — sized to how many leads you want to reach.{" "}
                <a
                  href="https://calculator.bleedai.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent underline-offset-2 hover:underline"
                >
                  Get your exact number →
                </a>
              </p>
              <p className="mt-2 text-[10px] font-mono uppercase tracking-[0.18em] text-white/35">
                example shown: 7
              </p>
            </div>

            <div className="glass rounded-xl p-4">
              <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/40 mb-3">
                Our SOP filters
              </div>
              <ul className="space-y-2">
                {RULES.map((r) => (
                  <li
                    key={r}
                    className="s3-rule flex items-center gap-2 text-sm text-white/80"
                  >
                    <span className="w-4 h-4 rounded-full bg-accent/10 border border-accent/40 flex items-center justify-center">
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none">
                        <path d="m5 12 5 5L20 7" stroke="#7cf5d0" strokeWidth="3" />
                      </svg>
                    </span>
                    {r}
                  </li>
                ))}
              </ul>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Stat label="Need" value="7" />
              <Stat label="Try" value="20" />
              <Stat label="Drop" value="4" />
            </div>
          </div>

          {/* CENTER — generation grid */}
          <div className="col-span-12 md:col-span-6 relative">
            <div className="glass rounded-xl h-full p-5 overflow-hidden relative">
              <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-[0.2em] text-white/40">
                <span>Generating options for {businessName}</span>
                <span>{domains.length} candidates</span>
              </div>
              <div className="mt-4 flex flex-wrap gap-2 content-start max-h-[78%] overflow-hidden">
                {domains.map((d, i) => (
                  <span
                    key={i}
                    className={`s3-chip inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-[12px] font-mono border ${
                      d.reject
                        ? "reject border-red-500/30 text-red-300/60 bg-red-500/5"
                        : "border-white/10 text-white/85 bg-white/[0.03]"
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        d.reject ? "bg-red-400" : "bg-accent"
                      }`}
                    />
                    {d.name}
                  </span>
                ))}
              </div>
              <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between text-[10px] font-mono uppercase tracking-[0.2em] text-white/40">
                <span>Filtering spammy patterns</span>
                <span className="text-accent">✓ rules passed</span>
              </div>
            </div>
          </div>

          {/* RIGHT — final selection */}
          <div className="col-span-12 md:col-span-3 flex flex-col gap-4">
            <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/40">
              Our proposal for {businessName}
            </div>
            <div className="grid gap-2">
              {FINAL.map((d) => (
                <div
                  key={d}
                  className="s3-final glass rounded-md px-3 py-2 flex items-center justify-between"
                >
                  <span className="font-mono text-sm text-white">{d}</span>
                  <span className="w-2 h-2 rounded-full bg-accent shadow-[0_0_10px_#7cf5d0]" />
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2 mt-2">
              <div className="s3-stat glass rounded-lg p-3">
                <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/40">Kept</div>
                <div className="font-display text-2xl text-accent">7</div>
              </div>
              <div className="s3-stat glass rounded-lg p-3">
                <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/40">Dropped</div>
                <div className="font-display text-2xl text-red-300">4</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="s3-stat glass rounded-lg p-3">
      <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/40">
        {label}
      </div>
      <div className="font-display text-xl text-white">{value}</div>
    </div>
  );
}
