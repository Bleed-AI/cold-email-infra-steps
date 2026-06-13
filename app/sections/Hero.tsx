"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useClient } from "../context/ClientContext";
import { clampedDpr, runVisibleLoop } from "../lib/canvasRuntime";

export default function Hero() {
  const ref = useRef<HTMLDivElement>(null);
  const { client } = useClient();
  const businessName = client?.businessName ?? "your business";

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from(".hero-kicker", {
        y: 20,
        opacity: 0,
        duration: 0.8,
        ease: "power3.out",
      });
      gsap.from(".hero-title .line", {
        yPercent: 110,
        duration: 1.1,
        stagger: 0.08,
        ease: "power4.out",
        delay: 0.1,
      });
      gsap.from(".hero-sub", {
        y: 20,
        opacity: 0,
        duration: 1,
        delay: 0.6,
        ease: "power3.out",
      });
      gsap.from(".hero-node", {
        scale: 0,
        opacity: 0,
        rotate: -45,
        duration: 1.6,
        delay: 0.3,
        ease: "back.out(1.8)",
      });
      gsap.from(".hero-meta", {
        opacity: 0,
        y: 10,
        duration: 0.8,
        delay: 0.9,
        stagger: 0.08,
        ease: "power2.out",
      });
      gsap.from(".hero-ring", {
        scale: 0,
        opacity: 0,
        duration: 1.4,
        stagger: 0.15,
        delay: 0.4,
        ease: "power3.out",
      });

      // Slow, continuous rotation on the inner glow ring
      gsap.to(".hero-spin", {
        rotation: 360,
        duration: 60,
        repeat: -1,
        ease: "none",
        transformOrigin: "center",
      });

      // Breathing pulse on the central node
      gsap.to(".hero-node", {
        scale: 1.05,
        duration: 2.4,
        yoyo: true,
        repeat: -1,
        ease: "sine.inOut",
      });

      // Orbiting micro-nodes rotate around centre
      gsap.to(".hero-orbit", {
        rotation: 360,
        duration: 24,
        repeat: -1,
        ease: "none",
        transformOrigin: "center",
      });

      // Parallax & exit on scroll — node "starts the journey"
      gsap.to(".hero-node-wrap", {
        scale: 0.55,
        y: -40,
        ease: "none",
        scrollTrigger: {
          trigger: ref.current,
          start: "top top",
          end: "bottom top",
          scrub: 0.8,
        },
      });
      gsap.to(".hero-title, .hero-sub, .hero-kicker, .hero-meta, .hero-scroll", {
        opacity: 0,
        y: -30,
        ease: "none",
        scrollTrigger: {
          trigger: ref.current,
          start: "top top",
          end: "40% top",
          scrub: 0.6,
        },
      });
      gsap.to(".hero-trail", {
        strokeDashoffset: 0,
        ease: "none",
        scrollTrigger: {
          trigger: ref.current,
          start: "top top",
          end: "bottom top",
          scrub: 0.8,
        },
      });
    }, ref);
    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={ref}
      className="relative h-[120vh] w-full overflow-hidden bg-ink-950"
    >
      <div className="sticky top-0 h-screen w-full overflow-hidden">
        {/* layered backdrop */}
        <div className="absolute inset-0 bg-grid opacity-50" />
        <div className="absolute inset-0 bg-radial-fade" />
        <div className="absolute inset-0 bg-vignette" />
        <div className="noise" />

        {/* corner hairlines */}
        <div className="absolute inset-6 hairline rounded-[2px] pointer-events-none opacity-50" />

        {/* drifting particles */}
        <Particles />

        {/* central node */}
        <div className="hero-node-wrap absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <div className="relative w-[320px] h-[320px] flex items-center justify-center">
            <div className="hero-spin hero-ring absolute inset-0 rounded-full dashed-ring" />
            <div className="hero-ring absolute inset-6 rounded-full hairline" />
            <div className="hero-ring absolute inset-12 rounded-full hairline opacity-60" />
            <div className="absolute inset-0 rounded-full animate-pulseRing border border-accent/40" />
            <div className="hero-node relative w-[120px] h-[120px] rounded-full glow-accent flex items-center justify-center bg-ink-900">
              <div className="absolute inset-2 rounded-full border border-accent/30" />
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" className="text-accent">
                <path
                  d="M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"
                  stroke="currentColor"
                  strokeWidth="1.4"
                />
                <path d="m3.5 7.5 8.5 6 8.5-6" stroke="currentColor" strokeWidth="1.4" />
              </svg>
            </div>
            {/* orbiting micro-nodes */}
            <div className="hero-orbit absolute inset-0">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="absolute left-1/2 top-1/2 origin-center"
                style={{
                  width: 0,
                  height: 0,
                  transform: `translate(-50%, -50%) rotate(${i * 90}deg)`,
                }}
              >
                <div
                  className="absolute -translate-x-1/2 -translate-y-1/2"
                  style={{ left: 160, top: 0 }}
                >
                  <span className="block w-2 h-2 rounded-full bg-accent shadow-[0_0_12px_#7cf5d0]" />
                </div>
              </div>
            ))}
            </div>
          </div>
        </div>

        {/* traveling trail svg */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          viewBox="0 0 1440 900"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="trailGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#7cf5d0" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#7c5cff" stopOpacity="0.1" />
            </linearGradient>
          </defs>
          <path
            className="hero-trail"
            d="M720 450 C 760 600, 900 720, 1200 820"
            stroke="url(#trailGrad)"
            strokeWidth="1.5"
            fill="none"
            strokeDasharray="600"
            strokeDashoffset="600"
          />
        </svg>

        {/* text content */}
        <div className="absolute inset-0 flex flex-col items-center justify-end pb-24 px-6 text-center">
          <div className="hero-kicker chip mb-8">
            <span className="dot" />
            Walkthrough · How Bleed AI will build this for {businessName}
          </div>
          <h1 className="hero-title font-display text-[36px] sm:text-[52px] md:text-[68px] leading-[0.95] tracking-[-0.03em] max-w-[1000px]">
            <span className="block overflow-hidden">
              <span className="line block text-gradient">Here&apos;s how we&apos;ll build</span>
            </span>
            <span className="block overflow-hidden">
              <span className="line block text-gradient-accent">
                {businessName}&apos;s cold email engine.
              </span>
            </span>
          </h1>
          <p className="hero-sub mt-5 text-white/60 max-w-lg text-sm md:text-base">
            Nothing&apos;s built yet — this is a walkthrough of every step
            Bleed AI will take so {businessName}&apos;s future campaigns land
            in inboxes, not spam.
          </p>

          {/* meta row */}
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <div className="hero-meta chip">
              <span className="dot" /> Domains
            </div>
            <div className="hero-meta chip">
              <span className="dot" /> Mailboxes
            </div>
            <div className="hero-meta chip">
              <span className="dot" /> Warm-up
            </div>
            <div className="hero-meta chip">
              <span className="dot" /> Deliverability
            </div>
          </div>

          <div className="hero-scroll mt-14 flex flex-col items-center gap-2 text-[10px] tracking-[0.3em] uppercase text-white/40 font-mono">
            <span>Scroll to assemble</span>
            <span className="w-px h-12 bg-gradient-to-b from-white/60 to-transparent" />
          </div>
        </div>

        {/* top hairline + label */}
        <div className="absolute top-24 left-1/2 -translate-x-1/2 text-[10px] tracking-[0.3em] uppercase text-white/40 font-mono">
          Bleed AI · {businessName} · day 0
        </div>
      </div>
    </section>
  );
}

function Particles() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = clampedDpr();
    let w = (canvas.width = canvas.offsetWidth * dpr);
    let h = (canvas.height = canvas.offsetHeight * dpr);

    const resize = () => {
      w = canvas.width = canvas.offsetWidth * dpr;
      h = canvas.height = canvas.offsetHeight * dpr;
    };
    window.addEventListener("resize", resize);

    const N = 80;
    const dots = Array.from({ length: N }).map(() => ({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.25 * dpr,
      vy: (Math.random() - 0.5) * 0.25 * dpr,
      r: Math.random() * 1.4 + 0.4,
      a: Math.random() * 0.6 + 0.2,
    }));

    const tick = () => {
      ctx.clearRect(0, 0, w, h);
      for (const d of dots) {
        d.x += d.vx;
        d.y += d.vy;
        if (d.x < 0 || d.x > w) d.vx *= -1;
        if (d.y < 0 || d.y > h) d.vy *= -1;
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r * dpr, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(124, 245, 208,${d.a})`;
        ctx.fill();
      }
    };
    const stopLoop = runVisibleLoop(canvas, tick);
    return () => {
      stopLoop();
      window.removeEventListener("resize", resize);
    };
  }, []);
  return (
    <canvas
      ref={ref}
      className="absolute inset-0 w-full h-full opacity-60 pointer-events-none"
    />
  );
}
