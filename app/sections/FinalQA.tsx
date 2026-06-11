"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { useClient } from "../context/ClientContext";

export default function FinalQA() {
  const ref = useRef<HTMLDivElement>(null);
  const { client } = useClient();
  const businessName = client?.businessName ?? "your business";
  const mainDomain = client?.mainDomain ?? "yourbrand.com";

  const CHECKS = [
    { label: "Warm-up complete", meta: "14 / 14 days · every mailbox" },
    { label: "Sender reputation strong", meta: "~94 / 100 across providers (example)" },
    { label: "Inbox placement tested", meta: "~98% land in primary inbox (example)" },
    { label: "DNS auth verified", meta: "DMARC + SPF + DKIM on every domain" },
    { label: "Redirects working", meta: `every domain → ${mainDomain}` },
    { label: "Ready to connect to campaigns", meta: "every mailbox cleared" },
  ];

  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: ref.current,
          start: "top top",
          end: "+=300%",
          scrub: 0.7,
          pin: true,
        },
      });

      tl.from(".s10-kicker", { opacity: 0, y: 20 }, 0)
        .from(".s10-title .line", { yPercent: 110, stagger: 0.06 }, 0)
        .from(".s10-row", {
          opacity: 0,
          x: -30,
          stagger: 0.12,
          duration: 0.4,
        }, 0.2)
        .from(".s10-check", {
          scale: 0,
          stagger: 0.12,
          duration: 0.3,
          ease: "back.out(2)",
        }, 0.35)
        .to(".s10-row", {
          backgroundColor: "rgba(124, 245, 208,0.05)",
          borderColor: "rgba(124, 245, 208,0.25)",
          stagger: 0.12,
          duration: 0.2,
        }, 0.4)
        .from(".s10-panel", {
          opacity: 0,
          y: 20,
          stagger: 0.1,
        }, 0.6)
        .from(".s10-final", { opacity: 0, scale: 0.9 }, 1.4);
    }, ref);
    return () => ctx.revert();
  }, []);

  return (
    <section ref={ref} className="relative h-screen w-full bg-ink-950">
      <div className="sticky top-0 h-screen w-full overflow-hidden">
        <div className="absolute inset-0 bg-grid-fine opacity-30" />
        <div className="absolute inset-0 bg-radial-fade" />

        <div className="relative z-10 max-w-[1500px] mx-auto px-8 pt-20 grid grid-cols-12 gap-6">
          <div className="col-span-12">
            <div className="flex flex-wrap items-center gap-2 mb-6">
              <div className="s10-kicker chip">
                <span className="dot" /> Step 10 · Post-warm-up health check
              </div>
              <div className="chip !text-violet-glow border-violet-glow/40">
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ background: "#7c5cff", boxShadow: "0 0 10px #7c5cff" }}
                />
                via Instantly
              </div>
            </div>
            <h2 className="s10-title font-display text-[26px] md:text-[36px] leading-[0.95] tracking-[-0.02em] max-w-[900px]">
              <span className="block overflow-hidden"><span className="line block text-gradient">After 14 days,</span></span>
              <span className="block overflow-hidden"><span className="line block text-gradient-accent">here&apos;s the QA report we&apos;ll hand you.</span></span>
            </h2>
          </div>

          <div className="col-span-12 md:col-span-7">
            <div className="space-y-2">
              {CHECKS.map((c) => (
                <div
                  key={c.label}
                  className="s10-row flex items-center gap-4 rounded-xl px-4 py-3 border border-white/10 bg-white/[0.02]"
                >
                  <span className="s10-check w-7 h-7 rounded-full bg-accent/15 border border-accent/40 flex items-center justify-center glow-accent">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                      <path d="m5 12 5 5L20 7" stroke="#7cf5d0" strokeWidth="2.6" />
                    </svg>
                  </span>
                  <div className="flex-1">
                    <div className="text-white text-sm">{c.label}</div>
                    <div className="text-[11px] text-white/40 font-mono">{c.meta}</div>
                  </div>
                  <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-accent">passed</span>
                </div>
              ))}
            </div>
          </div>

          <div className="col-span-12 md:col-span-5 space-y-2.5">
            <div className="s10-panel glass rounded-xl p-4">
              <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/40">
                Email authentication
              </div>
              <div className="grid grid-cols-6 gap-2 mt-3">
                <Ring label="DNS" value={100} />
                <Ring label="DKIM" value={100} />
                <Ring label="SPF" value={100} />
                <Ring label="DMARC" value={100} />
                <Ring label="MX" value={100} />
                <Ring label="TLS" value={100} />
              </div>
            </div>

            <div className="s10-panel glass rounded-xl p-4">
              <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-[0.2em] text-white/40">
                <span>Test send results</span>
                <span className="text-accent">PASS</span>
              </div>
              <div className="mt-2.5 grid grid-cols-3 gap-2 text-center">
                <Cell label="Inbox" value="98.4%" />
                <Cell label="Promo" value="1.4%" />
                <Cell label="Spam" value="0.2%" />
              </div>
            </div>

            <div className="s10-final glass rounded-xl p-4 glow-accent">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/40">
                    Ready to send
                  </div>
                  <div className="font-display text-xl text-white mt-0.5">Everything checks out</div>
                </div>
                <div className="w-10 h-10 rounded-full bg-accent/10 border border-accent/40 flex items-center justify-center shrink-0">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path d="m5 12 5 5L20 7" stroke="#7cf5d0" strokeWidth="2.6" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Ring({ label, value }: { label: string; value: number }) {
  const R = 22;
  const C = 2 * Math.PI * R;
  return (
    <div className="flex flex-col items-center">
      <div className="relative w-10 h-10">
        <svg viewBox="0 0 60 60" className="w-full h-full -rotate-90">
          <circle cx="30" cy="30" r={R} stroke="rgba(255,255,255,0.08)" strokeWidth="3" fill="none" />
          <circle
            cx="30"
            cy="30"
            r={R}
            stroke="#7cf5d0"
            strokeWidth="3"
            fill="none"
            strokeDasharray={C}
            strokeDashoffset={C * (1 - value / 100)}
            strokeLinecap="round"
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-[10px] font-mono text-white">
          {value}
        </span>
      </div>
      <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-white/50 mt-1">{label}</div>
    </div>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-white/[0.03] border border-white/10 py-3">
      <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/40">{label}</div>
      <div className="font-display text-lg text-white mt-1">{value}</div>
    </div>
  );
}
