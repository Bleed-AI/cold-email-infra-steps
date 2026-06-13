"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { useClient } from "../context/ClientContext";
import { clampedDpr, runVisibleLoop } from "../lib/canvasRuntime";

const LAYERS = [
  { label: "Domains", count: 7, ring: 0.32, hue: 160 },
  { label: "Mailboxes", count: 21, ring: 0.52, hue: 180 },
  { label: "Forwarding", count: 7, ring: 0.7, hue: 260 },
  { label: "Warm-up", count: 14, ring: 0.86, hue: 280 },
];

export default function Delivery() {
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
          end: "+=350%",
          scrub: 0.7,
          pin: true,
        },
      });

      tl.from(".s11-stage", { scale: 0.7, opacity: 0, duration: 1 }, 0)
        .from(".s11-tag", { opacity: 0, stagger: 0.08 }, 0.4)
        .from(".s11-title .line", { yPercent: 110, stagger: 0.06 }, 0.6)
        .from(".s11-sub", { opacity: 0, y: 20 }, 0.9)
        .from(".s11-pill", { opacity: 0, y: 10, stagger: 0.08 }, 1.0)
        .to(".s11-stage", { scale: 1.05, duration: 0.6 }, 1.2)
        .from(".s11-cta", { opacity: 0, y: 20 }, 1.3);
    }, ref);

    // -------- ecosystem canvas --------
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

    let t = 0;

    const tick = () => {
      const W = canvas.width;
      const H = canvas.height;
      t += 0.005;
      c.clearRect(0, 0, W, H);

      const cx = W / 2;
      const cy = H / 2;
      const R = Math.min(W, H) * 0.42;

      // center sun
      const g = c.createRadialGradient(cx, cy, 0, cx, cy, R * 0.4);
      g.addColorStop(0, "rgba(124, 245, 208,0.4)");
      g.addColorStop(1, "rgba(124, 245, 208,0)");
      c.fillStyle = g;
      c.fillRect(0, 0, W, H);

      // center node
      c.beginPath();
      c.arc(cx, cy, 18 * dpr, 0, Math.PI * 2);
      c.fillStyle = "#7cf5d0";
      c.shadowBlur = 40;
      c.shadowColor = "#7cf5d0";
      c.fill();
      c.shadowBlur = 0;

      // rings + nodes
      const allNodes: { x: number; y: number; hue: number }[] = [];
      for (const layer of LAYERS) {
        const radius = R * layer.ring;
        c.beginPath();
        c.arc(cx, cy, radius, 0, Math.PI * 2);
        c.strokeStyle = "rgba(255,255,255,0.05)";
        c.lineWidth = 1 * dpr;
        c.stroke();

        for (let i = 0; i < layer.count; i++) {
          const angle = (i / layer.count) * Math.PI * 2 + t * (0.2 + layer.ring * 0.1);
          const x = cx + Math.cos(angle) * radius;
          const y = cy + Math.sin(angle) * radius;
          allNodes.push({ x, y, hue: layer.hue });

          // connection to center
          c.beginPath();
          c.moveTo(cx, cy);
          c.lineTo(x, y);
          c.strokeStyle = `hsla(${layer.hue},80%,70%,0.07)`;
          c.lineWidth = 1 * dpr;
          c.stroke();

          // node
          c.beginPath();
          c.arc(x, y, 4 * dpr, 0, Math.PI * 2);
          c.fillStyle = `hsla(${layer.hue},85%,72%,1)`;
          c.shadowBlur = 18;
          c.shadowColor = `hsla(${layer.hue},90%,70%,0.9)`;
          c.fill();
          c.shadowBlur = 0;

          // outer ring
          c.beginPath();
          c.arc(x, y, 7 * dpr, 0, Math.PI * 2);
          c.strokeStyle = `hsla(${layer.hue},80%,70%,0.35)`;
          c.lineWidth = 1 * dpr;
          c.stroke();
        }
      }

      // travelling particles along ring connections
      for (let i = 0; i < 80; i++) {
        const layer = LAYERS[i % LAYERS.length];
        const radius = R * layer.ring;
        const angle = (i / 12) * Math.PI * 2 + t * 1.5;
        const x = cx + Math.cos(angle) * radius;
        const y = cy + Math.sin(angle) * radius;
        c.beginPath();
        c.arc(x, y, 1.2 * dpr, 0, Math.PI * 2);
        c.fillStyle = `hsla(${layer.hue},90%,80%,0.9)`;
        c.fill();
      }

    };
    const stopLoop = runVisibleLoop(canvas, tick);

    return () => {
      stopLoop();
      window.removeEventListener("resize", resize);
      ctx.revert();
    };
  }, []);

  return (
    <section ref={ref} className="relative h-screen w-full bg-ink-950">
      <div className="sticky top-0 h-screen w-full overflow-hidden">
        <div className="absolute inset-0 bg-grid opacity-30" />
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at 50% 50%, rgba(124, 245, 208,0.18), transparent 60%)",
          }}
        />
        <div className="noise" />

        <div className="relative z-10 h-full w-full flex items-center justify-center">
          <div className="s11-stage absolute inset-0">
            <canvas ref={canvasRef} className="w-full h-full" />
          </div>

          {/* floating tags */}
          {LAYERS.map((l, i) => (
            <div
              key={l.label}
              className="s11-tag absolute chip"
              style={{
                top: `${20 + i * 18}%`,
                left: i % 2 === 0 ? "8%" : "auto",
                right: i % 2 === 1 ? "8%" : "auto",
              }}
            >
              <span className="dot" />
              {l.label} · {l.count}
            </div>
          ))}

          <div className="relative z-10 text-center px-6 max-w-[1100px]">
            <h2 className="s11-title font-display text-[44px] sm:text-[72px] md:text-[100px] leading-[0.95] tracking-[-0.03em]">
              <span className="block overflow-hidden"><span className="line block text-gradient">{businessName},</span></span>
              <span className="block overflow-hidden"><span className="line block text-gradient-accent">that&apos;s how we&apos;ll get you live.</span></span>
            </h2>
            <p className="s11-sub mt-6 text-white/65 text-lg max-w-xl mx-auto leading-relaxed">
              Step 11 · After the 14-day warm-up, Bleed AI launches your first
              campaign in Instantly. That&apos;s the moment you go live.
            </p>

            <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
              <span className="s11-pill chip !text-violet-glow border-violet-glow/40">
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ background: "#7c5cff", boxShadow: "0 0 10px #7c5cff" }}
                />
                via Instantly
              </span>
              <span className="s11-pill chip"><span className="dot" /> 7 domains</span>
              <span className="s11-pill chip"><span className="dot" /> 21 mailboxes</span>
              <span className="s11-pill chip"><span className="dot" /> Replies forwarded</span>
              <span className="s11-pill chip"><span className="dot" /> Warmed up</span>
              <span className="s11-pill chip"><span className="dot" /> 94 reputation</span>
            </div>

            <div className="s11-cta mt-12 flex flex-wrap items-center justify-center gap-3">
              <a
                href="https://calculator.bleedai.com"
                target="_blank"
                rel="noopener noreferrer"
                className="px-6 py-3 rounded-full bg-accent text-ink-950 font-mono text-xs uppercase tracking-[0.18em] glow-accent hover:bg-accent-400 transition cursor-pointer"
              >
                Get your exact numbers →
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* footer line */}
      <div className="relative z-10 max-w-[1500px] mx-auto px-8 py-10 flex items-center justify-between text-[10px] font-mono uppercase tracking-[0.2em] text-white/40 border-t border-white/5">
        <span>© Bleed AI · built for {businessName}</span>
        <span>v.01 · ready to launch</span>
      </div>
    </section>
  );
}
