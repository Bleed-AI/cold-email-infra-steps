"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { useClient } from "../context/ClientContext";
import { clampedDpr, runVisibleLoop } from "../lib/canvasRuntime";

export default function ExportInstantly() {
  const ref = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { client } = useClient();
  const businessName = client?.businessName ?? "your business";

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

      tl.from(".s7-kicker", { opacity: 0, y: 20 }, 0)
        .from(".s7-title .line", { yPercent: 110, stagger: 0.06 }, 0)
        .from(".s7-source, .s7-target", {
          opacity: 0,
          y: 30,
          stagger: 0.1,
        }, 0.1)
        .from(".s7-pipe", { opacity: 0, scaleX: 0, transformOrigin: "left" }, 0.2)
        .to(".s7-progress-bar", {
          width: "100%",
          ease: "none",
          duration: 1.4,
        }, 0.3)
        .to(".s7-percent", {
          duration: 1.4,
          ease: "none",
          onUpdate: function () {
            const el = document.querySelector<HTMLElement>(".s7-percent");
            if (el) el.textContent = String(Math.floor(this.progress() * 100)) + "%";
          },
        }, 0.3)
        .from(".s7-step", {
          opacity: 0,
          x: -20,
          stagger: 0.1,
        }, 0.4)
        .to(".s7-step", {
          color: "#7cf5d0",
          stagger: 0.18,
        }, 0.6);
    }, ref);

    // particle pipe
    const canvas = canvasRef.current;
    if (!canvas) return;
    const c = canvas.getContext("2d");
    if (!c) return;
    const dpr = clampedDpr();
    const resize = () => {
      canvas.width = canvas.offsetWidth * dpr;
      canvas.height = canvas.offsetHeight * dpr;
    };
    resize();
    window.addEventListener("resize", resize);

    type P = { x: number; y: number; v: number; r: number; a: number; hue: number };
    const particles: P[] = [];

    const spawn = () => {
      const h = canvas.height;
      particles.push({
        x: 0,
        y: h * (0.2 + Math.random() * 0.6),
        v: (1 + Math.random() * 2.5) * dpr,
        r: (Math.random() * 1.4 + 0.6) * dpr,
        a: Math.random() * 0.8 + 0.2,
        hue: Math.random() > 0.5 ? 160 : 260,
      });
    };

    const tick = () => {
      c.clearRect(0, 0, canvas.width, canvas.height);
      if (particles.length < 220) for (let i = 0; i < 3; i++) spawn();
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.v;
        if (p.x > canvas.width) particles.splice(i, 1);
        c.beginPath();
        c.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        c.fillStyle = `hsla(${p.hue},80%,70%,${p.a})`;
        c.fill();
      }
    };
    const stopLoop = runVisibleLoop(canvas, tick, { warmupFrames: 150 });
    return () => {
      stopLoop();
      window.removeEventListener("resize", resize);
      ctx.revert();
    };
  }, []);

  return (
    <section ref={ref} className="relative h-screen w-full bg-ink-950">
      <div className="sticky top-0 h-screen w-full overflow-hidden">
        <div className="absolute inset-0 bg-grid-fine opacity-30" />
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at 50% 50%, rgba(124, 92, 255,0.10), transparent 60%)",
          }}
        />

        <div className="relative z-10 max-w-[1500px] mx-auto px-8 pt-20 h-full flex flex-col">
          <div className="flex items-start justify-between gap-6">
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-4">
                <div className="s7-kicker chip">
                  <span className="dot" /> Step 08 · Export to Instantly
                </div>
                <div className="chip !text-violet-glow border-violet-glow/40">
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ background: "#7c5cff", boxShadow: "0 0 10px #7c5cff" }}
                  />
                  via Instantly
                </div>
              </div>
              <h2 className="s7-title font-display text-[28px] md:text-[40px] leading-[0.95] tracking-[-0.02em] max-w-[760px]">
                <span className="block overflow-hidden"><span className="line block text-gradient">Once mailboxes are live,</span></span>
                <span className="block overflow-hidden"><span className="line block text-gradient-accent">we export them to Instantly.</span></span>
              </h2>
            </div>
            <div className="text-right shrink-0">
              <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/40">
                Sync status · preview
              </div>
              <div className="font-display text-2xl mt-1">
                <span className="s7-percent text-accent">0%</span>
              </div>
              <div className="mt-1 text-xs text-white/50">Synchronization in progress</div>
            </div>
          </div>

          {/* pipeline rail — all three cards same compact height */}
          <div className="relative mt-8 grid grid-cols-12 items-stretch gap-6">
            {/* SOURCE */}
            <div className="s7-source col-span-12 md:col-span-3 glass rounded-2xl p-5 glow-accent flex flex-col justify-between min-h-[260px]">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-7 h-7 rounded-md bg-accent/10 border border-accent/30 flex items-center justify-center">
                    <span className="w-2 h-2 rounded-full bg-accent shadow-[0_0_10px_#7cf5d0]" />
                  </span>
                  <span className="font-mono text-xs uppercase tracking-[0.18em] text-accent">Zapmail</span>
                </div>
                <div className="font-display text-xl mt-3 text-white leading-tight">
                  Where we built everything
                </div>
                <div className="text-xs text-white/50 mt-1">
                  Mailboxes · DNS · all ready to ship
                </div>
              </div>
              <div className="mt-4 flex items-baseline gap-2">
                <span className="font-display text-5xl text-accent leading-none">21</span>
                <span className="text-xs text-white/50">mailboxes</span>
              </div>
            </div>

            {/* PIPE */}
            <div className="s7-pipe col-span-12 md:col-span-6 relative min-h-[260px] glass rounded-2xl overflow-hidden">
              <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
              <div className="absolute inset-0 flex flex-col justify-between p-4 pointer-events-none">
                <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-[0.2em] text-white/40">
                  <span>Data transfer · preview</span>
                  <span className="text-accent">● streaming</span>
                </div>
                <div>
                  <div className="h-1 rounded-full bg-white/5 overflow-hidden">
                    <div className="s7-progress-bar h-full w-0 bg-gradient-to-r from-accent to-violet-glow" />
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[10px] font-mono text-white/40">
                    <span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span>
                  </div>
                </div>
              </div>
            </div>

            {/* TARGET */}
            <div className="s7-target col-span-12 md:col-span-3 glass rounded-2xl p-5 glow-violet flex flex-col min-h-[260px]">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-md bg-violet-glow/10 border border-violet-glow/40 flex items-center justify-center">
                  <span className="w-2 h-2 rounded-full bg-violet-glow shadow-[0_0_10px_#7c5cff]" />
                </span>
                <span className="font-mono text-xs uppercase tracking-[0.18em] text-violet-glow">Instantly</span>
              </div>
              <div className="font-display text-xl mt-3 text-white leading-tight">
                Where we&apos;ll send your campaigns from
              </div>
              <div className="text-xs text-white/50 mt-1">Your campaign platform</div>
              <div className="mt-3 space-y-1.5 text-xs">
                <div className="s7-step text-white/55">↳ Connect each mailbox</div>
                <div className="s7-step text-white/55">↳ Warm up for 14 days</div>
                <div className="s7-step text-white/55">↳ Then send your first campaign</div>
              </div>
            </div>
          </div>

          {/* What's Instantly? — compact horizontal callout */}
          <div className="mt-6 mb-8 glass rounded-xl px-5 py-4 border border-violet-glow/25">
            <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-6">
              <div className="flex items-center gap-2 shrink-0">
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-violet-glow">
                  What&apos;s Instantly?
                </span>
                <span className="text-[10px] font-mono text-white/40">instantly.ai</span>
              </div>
              <p className="text-sm text-white/80 leading-snug">
                Where Bleed AI runs {businessName}&apos;s campaigns from — we write
                the sequences, set the targeting, monitor the replies. Sending
                only starts after the 14-day warm-up (Step 09) is complete.{" "}
                <span className="text-white/50">
                  Zapmail builds the inboxes; Instantly warms and sends from them.
                </span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

