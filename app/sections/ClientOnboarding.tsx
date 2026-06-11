"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useClient } from "../context/ClientContext";

export default function ClientOnboarding() {
  const ref = useRef<HTMLDivElement>(null);
  const { client } = useClient();
  const businessName = client?.businessName ?? "your business";
  const mainDomain = client?.mainDomain ?? "yourbrand.com";

  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: ref.current,
          start: "top top",
          end: "+=200%",
          scrub: 0.8,
          pin: true,
        },
      });

      tl.from(".s2-kicker", { opacity: 0, y: 30 }, 0)
        .from(".s2-title .line", { yPercent: 110, stagger: 0.06 }, 0)
        .from(".s2-domain-card", { y: 80, opacity: 0, scale: 0.9 }, 0.15)
        .from(".s2-typed span", { opacity: 0, stagger: 0.05 }, 0.25)
        .from(".s2-meta", { x: -40, opacity: 0, stagger: 0.1 }, 0.4)
        .from(".s2-count .digit", { y: 40, opacity: 0, stagger: 0.05 }, 0.5)
        .from(".s2-blueprint line, .s2-blueprint rect, .s2-blueprint circle", {
          opacity: 0,
          stagger: 0.02,
        }, 0.6)
        .to(".s2-domain-card", { x: -40 }, 0.7)
        .from(".s2-bp-label", { opacity: 0, y: 10, stagger: 0.1 }, 0.8);

      // dash draw via strokeDashoffset (no DrawSVGPlugin needed)
      gsap.utils.toArray<SVGPathElement>(".s2-flow path").forEach((p) => {
        const len = p.getTotalLength();
        p.style.strokeDasharray = `${len}`;
        p.style.strokeDashoffset = `${len}`;
        gsap.to(p, {
          strokeDashoffset: 0,
          ease: "none",
          scrollTrigger: {
            trigger: ref.current,
            start: "top top",
            end: "+=200%",
            scrub: 0.8,
          },
        });
      });
    }, ref);
    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={ref}
      className="relative h-screen w-full bg-ink-950"
    >
      <div className="sticky top-0 h-screen w-full overflow-hidden">
        <div className="absolute inset-0 bg-grid-fine opacity-30" />
        <div className="absolute inset-0 bg-radial-fade" />

        <div className="relative z-10 h-full max-w-[1400px] mx-auto px-8 grid grid-cols-12 gap-8 items-center">
          {/* LEFT - copy */}
          <div className="col-span-12 md:col-span-5">
            <div className="s2-kicker chip mb-6">
              <span className="dot" /> Step 03 · You approve the list
            </div>
            <h2 className="s2-title font-display text-[32px] md:text-[44px] leading-[0.95] tracking-[-0.02em]">
              <span className="block overflow-hidden">
                <span className="line block text-gradient">You approve.</span>
              </span>
              <span className="block overflow-hidden">
                <span className="line block text-gradient-accent">We move.</span>
              </span>
            </h2>
            <p className="mt-6 text-white/55 max-w-md">
              We send you the 7 proposed domains. Nothing gets bought until
              you say yes. Don&apos;t love one? We swap it for another from our list.
            </p>

            <div className="mt-10 grid grid-cols-2 gap-4 max-w-[420px]">
              <Meta label="Your main site" value={mainDomain} />
              <Meta label="Sending domains" value="7 approved" />
              <Meta label="Mailboxes / domain" value="3" />
              <Meta label="Total mailboxes" value="21" />
            </div>

            <div className="s2-meta mt-8 glass rounded-xl p-5 border border-accent/25 max-w-[460px]">
              <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-[0.2em] text-white/40">
                <span>Your other 2-min job</span>
                <span className="text-accent">in parallel</span>
              </div>
              <p className="mt-2 text-xs text-white/60 leading-snug">
                While you review the domain list, please set up Zapmail so we
                can build inside your account. Three small steps:
              </p>
              <ol className="mt-3 space-y-2 text-xs text-white/85">
                <li className="flex gap-3">
                  <span className="text-accent font-mono">01</span>
                  <span>
                    Create a Zapmail account at{" "}
                    <span className="text-accent">zapmail.ai</span>
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="text-accent font-mono">02</span>
                  <span>Buy the plan we recommend for your sending volume</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-accent font-mono">03</span>
                  <span>
                    Invite{" "}
                    <span className="text-accent font-mono">
                      bleedaigeneral@gmail.com
                    </span>{" "}
                    as admin in workspace settings
                  </span>
                </li>
              </ol>
              <p className="mt-3 text-xs text-white/55 italic">
                That&apos;s it. From the moment we&apos;re invited, Bleed AI runs
                everything inside Zapmail for you.
              </p>
            </div>
          </div>

          {/* RIGHT - visual */}
          <div className="col-span-12 md:col-span-7 relative">
            <div className="relative w-full aspect-[5/4]">
              {/* Domain card */}
              <div className="s2-domain-card absolute left-0 top-1/2 -translate-y-1/2 glass rounded-xl p-5 w-[280px] glow-accent">
                <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-[0.2em] text-white/40">
                  <span>{businessName} · Approval</span>
                  <span className="text-white/40">preview</span>
                </div>
                <div className="s2-typed mt-3 font-display text-[28px] tracking-tight break-all">
                  {"Approved".split("").map((c, i) => (
                    <span key={i}>{c}</span>
                  ))}
                </div>
                <div className="mt-4 flex items-center gap-2">
                  <span className="chip"><span className="dot" /> 7 / 7 picked</span>
                  <span className="chip">ready to buy</span>
                </div>
              </div>

              {/* flow paths */}
              <svg
                className="s2-flow absolute inset-0 w-full h-full"
                viewBox="0 0 800 640"
              >
                <defs>
                  <linearGradient id="g2" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#7cf5d0" stopOpacity="0.9" />
                    <stop offset="100%" stopColor="#7c5cff" stopOpacity="0.7" />
                  </linearGradient>
                </defs>
                <path
                  d="M 280 320 C 380 320 380 200 500 200"
                  stroke="url(#g2)"
                  strokeWidth="1.5"
                  fill="none"
                />
                <path
                  d="M 280 320 C 380 320 380 320 500 320"
                  stroke="url(#g2)"
                  strokeWidth="1.5"
                  fill="none"
                />
                <path
                  d="M 280 320 C 380 320 380 440 500 440"
                  stroke="url(#g2)"
                  strokeWidth="1.5"
                  fill="none"
                />
              </svg>

              {/* Blueprint panel */}
              <div className="absolute right-0 top-0 bottom-0 w-[44%] glass rounded-xl p-5 overflow-hidden">
                <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-[0.2em] text-white/40">
                  <span>Infrastructure blueprint</span>
                  <span>v.01</span>
                </div>

                <svg
                  className="s2-blueprint w-full mt-4"
                  viewBox="0 0 320 280"
                >
                  {Array.from({ length: 8 }).map((_, i) => (
                    <line
                      key={i}
                      x1={i * 40}
                      y1={0}
                      x2={i * 40}
                      y2={280}
                      stroke="rgba(255,255,255,0.06)"
                    />
                  ))}
                  {Array.from({ length: 7 }).map((_, i) => (
                    <line
                      key={i}
                      x1={0}
                      y1={i * 40}
                      x2={320}
                      y2={i * 40}
                      stroke="rgba(255,255,255,0.06)"
                    />
                  ))}
                  {/* central plan */}
                  <rect
                    x="60"
                    y="60"
                    width="200"
                    height="160"
                    fill="none"
                    stroke="#7cf5d0"
                    strokeWidth="1"
                    strokeDasharray="3 4"
                  />
                  <circle cx="160" cy="140" r="6" fill="#7cf5d0" />
                  <circle cx="80" cy="80" r="3" fill="#fff" opacity="0.8" />
                  <circle cx="240" cy="80" r="3" fill="#fff" opacity="0.8" />
                  <circle cx="80" cy="200" r="3" fill="#fff" opacity="0.8" />
                  <circle cx="240" cy="200" r="3" fill="#fff" opacity="0.8" />
                  <line x1="80" y1="80" x2="160" y2="140" stroke="rgba(124, 245, 208,0.5)" />
                  <line x1="240" y1="80" x2="160" y2="140" stroke="rgba(124, 245, 208,0.5)" />
                  <line x1="80" y1="200" x2="160" y2="140" stroke="rgba(124, 245, 208,0.5)" />
                  <line x1="240" y1="200" x2="160" y2="140" stroke="rgba(124, 245, 208,0.5)" />
                </svg>

                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <div className="s2-bp-label">
                    <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/40">Domains</div>
                    <div className="s2-count font-display text-2xl text-white">
                      <span className="digit">0</span>
                      <span className="digit">7</span>
                    </div>
                  </div>
                  <div className="s2-bp-label">
                    <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/40">Inboxes</div>
                    <div className="s2-count font-display text-2xl text-white">
                      <span className="digit">2</span>
                      <span className="digit">1</span>
                    </div>
                  </div>
                  <div className="s2-bp-label">
                    <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/40">Plan</div>
                    <div className="s2-count font-display text-2xl text-accent">
                      <span className="digit">P</span>
                      <span className="digit">RO</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="s2-meta glass rounded-lg p-3">
      <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/40">
        {label}
      </div>
      <div className="font-display text-xl mt-1 text-white">{value}</div>
    </div>
  );
}
