"use client";

import { useEffect, useMemo, useRef } from "react";
import { gsap } from "gsap";
import { useClient } from "../context/ClientContext";
import { buildSendingDomains } from "../lib/domains";

export default function DomainPurchase() {
  const ref = useRef<HTMLDivElement>(null);
  const { client } = useClient();
  const businessName = client?.businessName ?? "your business";
  const slug = client?.slug ?? "client";
  const DOMAINS = useMemo(() => buildSendingDomains(slug), [slug]);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: ref.current,
          start: "top top",
          end: "+=250%",
          scrub: 0.6,
          pin: true,
        },
      });

      tl.from(".s5-kicker", { opacity: 0, y: 20 }, 0)
        .from(".s5-title .line", { yPercent: 110, stagger: 0.06 }, 0)
        .from(".s5-wallet", { opacity: 0, y: 30, scale: 0.95 }, 0.1)
        .from(".s5-balance", { textContent: 0, duration: 1, snap: { textContent: 1 } }, 0.2)
        .from(".s5-stage", { opacity: 0, y: 40 }, 0.3)
        .from(".s5-domain", { x: -60, opacity: 0, stagger: 0.08 }, 0.4)
        .to(".s5-domain", {
          x: 480,
          stagger: 0.08,
          duration: 0.8,
          ease: "power2.inOut",
        }, 0.9)
        .from(".s5-node", { scale: 0, opacity: 0, stagger: 0.1 }, 1.4)
        .from(".s5-line", {
          strokeDashoffset: 600,
          stagger: 0.08,
          duration: 0.8,
        }, 1.5)
        .to(".s5-balance", { textContent: 0, duration: 1, snap: { textContent: 1 } }, 1.0);

      gsap.utils.toArray<SVGPathElement>(".s5-line").forEach((p) => {
        const len = p.getTotalLength();
        p.style.strokeDasharray = `${len}`;
        p.style.strokeDashoffset = `${len}`;
        gsap.to(p, {
          strokeDashoffset: 0,
          ease: "none",
          scrollTrigger: {
            trigger: ref.current,
            start: "top top",
            end: "+=250%",
            scrub: 0.6,
          },
        });
      });
    }, ref);
    return () => ctx.revert();
  }, []);

  return (
    <section ref={ref} className="relative h-screen w-full bg-ink-950">
      <div className="sticky top-0 h-screen w-full overflow-hidden">
        <div className="absolute inset-0 bg-grid-fine opacity-30" />
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at 30% 50%, rgba(124, 245, 208,0.10), transparent 60%)",
          }}
        />

        <div className="relative z-10 max-w-[1500px] mx-auto px-8 pt-20 grid grid-cols-12 gap-6 h-full">
          <div className="col-span-12 md:col-span-3">
            <div className="flex flex-wrap items-center gap-2 mb-6">
              <div className="s5-kicker chip">
                <span className="dot" /> Step 05 · We buy your domains
              </div>
              <div className="chip !text-accent border-accent/40">
                <span className="dot" /> via Zapmail
              </div>
            </div>
            <h2 className="s5-title font-display text-[26px] md:text-[34px] leading-[0.95] tracking-[-0.02em]">
              <span className="block overflow-hidden"><span className="line block text-gradient">Fresh domains,</span></span>
              <span className="block overflow-hidden"><span className="line block text-gradient-accent">paid & registered</span></span>
              <span className="block overflow-hidden"><span className="line block text-gradient">for {businessName}.</span></span>
            </h2>

            <div className="mt-5 glass rounded-xl p-3.5 border border-accent/20">
              <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-[0.2em] text-white/40">
                <span>What&apos;s Zapmail?</span>
                <span className="text-accent">zapmail.ai</span>
              </div>
              <p className="mt-1.5 text-xs text-white/80 leading-snug">
                Our build tool. Bleed AI directs the work; Zapmail handles the
                heavy lifting — domains, mailboxes, DNS — on our instructions.
              </p>
            </div>

            <div className="mt-3 glass rounded-xl p-3.5">
              <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/40">
                Why not use your main domain?
              </div>
              <p className="mt-1.5 text-xs text-white/75 leading-snug">
                Cold email can get domains flagged. These are decoys — they
                take the heat so {client?.mainDomain ?? "yourbrand.com"} stays
                clean for your team&apos;s normal email.
              </p>
            </div>

            <div className="s5-wallet mt-4 glass rounded-xl p-4 glow-violet">
              <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-[0.2em] text-white/40">
                <span>Domain budget</span>
                <span className="text-accent">USD</span>
              </div>
              <div className="mt-2 font-display text-4xl text-white">
                $<span className="s5-balance">84</span>
              </div>
              <div className="mt-3 h-1.5 rounded-full bg-white/5 overflow-hidden">
                <div className="h-full w-[70%] bg-gradient-to-r from-accent to-violet-glow" />
              </div>
              <div className="mt-3 text-xs text-white/50">
                ~$12 / yr per domain · owned by you · example: 7 domains = $84
              </div>
            </div>
          </div>

          {/* CENTER STAGE — pipeline */}
          <div className="col-span-12 md:col-span-9 relative">
            <div className="s5-stage relative h-[78vh] glass rounded-2xl overflow-hidden p-6">
              <div className="absolute top-4 left-6 right-6 flex items-center justify-between text-[10px] font-mono uppercase tracking-[0.2em] text-white/40">
                <span>Purchasing pipeline</span>
                <span className="text-accent">● live</span>
              </div>

              {/* lanes */}
              <div className="absolute inset-0 grid grid-cols-3 px-6 pt-14 pb-6 gap-6">
                <Lane label="Queue" />
                <Lane label="Registering" highlight />
                <Lane label="Active node" />
              </div>

              {/* domains */}
              <div className="absolute left-12 top-1/2 -translate-y-1/2 space-y-3">
                {DOMAINS.map((d, i) => (
                  <div
                    key={d}
                    className="s5-domain glass rounded-md px-3 py-2 font-mono text-sm flex items-center gap-2 w-[200px]"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                    {d}
                  </div>
                ))}
              </div>

              {/* node grid */}
              <div className="absolute right-12 top-1/2 -translate-y-1/2 grid grid-cols-3 gap-3 w-[260px]">
                {DOMAINS.map((d, i) => (
                  <div
                    key={d}
                    className="s5-node aspect-square rounded-xl flex items-center justify-center relative"
                  >
                    <div className="absolute inset-0 rounded-xl border border-accent/30 glow-accent" />
                    <span className="font-mono text-[10px] text-accent">{d.split(".")[0]}</span>
                  </div>
                ))}
              </div>

              {/* connection lines */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 1000 600">
                <defs>
                  <linearGradient id="g5" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#7cf5d0" />
                    <stop offset="100%" stopColor="#7c5cff" />
                  </linearGradient>
                </defs>
                {Array.from({ length: 7 }).map((_, i) => (
                  <path
                    key={i}
                    className="s5-line"
                    d={`M 260 ${180 + i * 32} C 500 ${180 + i * 32}, 500 ${100 + (i % 3) * 80 + Math.floor(i / 3) * 20}, 740 ${100 + (i % 3) * 80 + Math.floor(i / 3) * 90}`}
                    stroke="url(#g5)"
                    strokeWidth="1"
                    fill="none"
                  />
                ))}
              </svg>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Lane({ label, highlight }: { label: string; highlight?: boolean }) {
  return (
    <div
      className={`rounded-xl border border-dashed h-full p-3 ${
        highlight
          ? "border-accent/30 bg-accent/5"
          : "border-white/10"
      }`}
    >
      <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/40">
        {label}
      </div>
    </div>
  );
}
