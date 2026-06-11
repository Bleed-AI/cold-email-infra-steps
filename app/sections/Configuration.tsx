"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { useClient } from "../context/ClientContext";

export default function Configuration() {
  const ref = useRef<HTMLDivElement>(null);
  const { client } = useClient();
  const businessName = client?.businessName ?? "your business";
  const mainDomain = client?.mainDomain ?? "yourbrand.com";
  const slug = client?.slug ?? "client";

  const ROWS = [
    { label: "DMARC record", value: "policy: quarantine · every domain", icon: "✓" },
    { label: "SPF record", value: "authorized senders · every domain", icon: "✓" },
    { label: "DKIM signing keys", value: "2048-bit · every domain", icon: "✓" },
    { label: "Website redirect", value: `every domain → ${mainDomain}`, icon: "↪" },
  ];

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

      tl.from(".s8-kicker", { opacity: 0, y: 20 }, 0)
        .from(".s8-title .line", { yPercent: 110, stagger: 0.06 }, 0)
        .from(".s8-map", { opacity: 0, scale: 0.94 }, 0.1)
        .from(".s8-node", {
          scale: 0,
          opacity: 0,
          stagger: 0.05,
          duration: 0.5,
          ease: "back.out(1.6)",
        }, 0.3)
        .from(".s8-row", { opacity: 0, x: 20, stagger: 0.1 }, 0.4)
        .to(".s8-row", {
          color: "#ffffff",
          stagger: 0.18,
        }, 0.6);

      gsap.utils.toArray<SVGPathElement>(".s8-link").forEach((p) => {
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
        <div className="absolute inset-0 bg-radial-fade" />

        <div className="relative z-10 max-w-[1500px] mx-auto px-8 pt-20 grid grid-cols-12 gap-6 h-full">
          {/* LEFT — copy + checklist */}
          <div className="col-span-12 md:col-span-4">
            <div className="flex flex-wrap items-center gap-2 mb-6">
              <div className="s8-kicker chip">
                <span className="dot" /> Step 07 · DNS + website redirect
              </div>
              <div className="chip !text-accent border-accent/40">
                <span className="dot" /> via Zapmail
              </div>
            </div>
            <h2 className="s8-title font-display text-[28px] md:text-[40px] leading-[0.95] tracking-[-0.02em]">
              <span className="block overflow-hidden"><span className="line block text-gradient">DMARC. SPF. DKIM.</span></span>
              <span className="block overflow-hidden"><span className="line block text-gradient-accent">Redirect to {mainDomain}.</span></span>
            </h2>
            <p className="mt-6 text-white/55 max-w-md text-sm">
              Think of DMARC, SPF, and DKIM as ID badges for your email. Every
              inbox provider — Gmail, Outlook, Yahoo, Apple Mail — checks them
              before letting a message in. No badge, straight to spam. We
              configure them on every domain (Zapmail applies them for us). We
              also redirect each sending domain to your main website, so curious
              recipients land on {businessName}.
            </p>

            <div className="mt-8 space-y-2">
              {ROWS.map((r) => (
                <div
                  key={r.label}
                  className="s8-row glass rounded-lg px-4 py-3 flex items-center justify-between text-white/55"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-7 h-7 rounded-md bg-accent/10 border border-accent/30 flex items-center justify-center text-accent">
                      {r.icon}
                    </span>
                    <div>
                      <div className="text-sm">{r.label}</div>
                      <div className="text-[11px] text-white/40 font-mono">{r.value}</div>
                    </div>
                  </div>
                  <span className="w-2 h-2 rounded-full bg-accent shadow-[0_0_10px_#7cf5d0]" />
                </div>
              ))}
            </div>
          </div>

          {/* RIGHT — infrastructure map */}
          <div className="col-span-12 md:col-span-8 relative">
            <div className="s8-map relative w-full h-[78vh] glass rounded-2xl overflow-hidden p-6">
              <div className="absolute top-4 left-6 right-6 flex items-center justify-between text-[10px] font-mono uppercase tracking-[0.2em] text-white/40">
                <span>{businessName} · what it&apos;ll look like when done</span>
                <span className="text-white/40">preview</span>
              </div>

              <svg className="absolute inset-0 w-full h-full" viewBox="0 0 800 600" preserveAspectRatio="xMidYMid meet">
                <defs>
                  <linearGradient id="g8" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#7cf5d0" />
                    <stop offset="100%" stopColor="#7c5cff" />
                  </linearGradient>
                </defs>

                {/* center hub */}
                <circle cx="400" cy="300" r="80" fill="none" stroke="rgba(255,255,255,0.06)" />
                <circle cx="400" cy="300" r="50" fill="none" stroke="rgba(124, 245, 208,0.4)" strokeDasharray="2 3" />
                <circle className="s8-node" cx="400" cy="300" r="36" fill="rgba(124, 245, 208,0.15)" stroke="#7cf5d0" />
                <text x="400" y="305" textAnchor="middle" fill="#fff" fontFamily="ui-monospace" fontSize="11">{mainDomain}</text>

                {/* outer ring nodes */}
                {Array.from({ length: 12 }).map((_, i) => {
                  const angle = (i / 12) * Math.PI * 2;
                  const x = 400 + Math.cos(angle) * 220;
                  const y = 300 + Math.sin(angle) * 220;
                  return (
                    <g key={i}>
                      <path
                        className="s8-link"
                        d={`M 400 300 L ${x} ${y}`}
                        stroke="url(#g8)"
                        strokeWidth="1"
                        fill="none"
                        opacity="0.7"
                      />
                      <circle className="s8-node" cx={x} cy={y} r="10" fill="rgba(124, 245, 208,0.1)" stroke="#7cf5d0" />
                      <circle cx={x} cy={y} r="3" fill="#7cf5d0" />
                    </g>
                  );
                })}

                {/* DNS record labels */}
                {["DMARC", "SPF", "DKIM", "MX", "TXT", "TLS"].map((label, i) => {
                  const angle = (i / 6) * Math.PI * 2 + 0.3;
                  const x = 400 + Math.cos(angle) * 120;
                  const y = 300 + Math.sin(angle) * 120;
                  return (
                    <g key={label}>
                      <rect
                        className="s8-node"
                        x={x - 24}
                        y={y - 9}
                        width="48"
                        height="18"
                        rx="4"
                        fill="rgba(124, 92, 255,0.08)"
                        stroke="rgba(124, 92, 255,0.4)"
                      />
                      <text x={x} y={y + 4} textAnchor="middle" fill="#a394ff" fontFamily="ui-monospace" fontSize="9">
                        {label}
                      </text>
                    </g>
                  );
                })}
              </svg>

              <div className="absolute bottom-4 left-6 right-6 grid grid-cols-3 gap-3">
                <Stat label="DNS records" value="21 added" />
                <Stat label="Redirects" value="7 / 7" />
                <Stat label="Auth pass" value="100%" />
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
    <div className="glass rounded-lg p-3">
      <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/40">{label}</div>
      <div className="font-display text-base text-accent mt-0.5">{value}</div>
    </div>
  );
}
