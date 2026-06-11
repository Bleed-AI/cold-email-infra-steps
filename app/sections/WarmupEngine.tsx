"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { useClient } from "../context/ClientContext";

export default function WarmupEngine() {
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
          end: "+=400%",
          scrub: 0.6,
          pin: true,
        },
      });

      tl.from(".s9-kicker", { opacity: 0, y: 20 }, 0)
        .from(".s9-title .line", { yPercent: 110, stagger: 0.06 }, 0)
        .from(".s9-stage", { opacity: 0, scale: 0.95 }, 0.1)
        .from(".s9-stat", { opacity: 0, y: 20, stagger: 0.1 }, 0.4)
        .fromTo(".s9-rep-fill",
          { width: "0%" },
          { width: "94%", ease: "none", duration: 1.4 }, 0.4)
        .fromTo(".s9-trust-fill",
          { width: "0%" },
          { width: "88%", ease: "none", duration: 1.4 }, 0.5)
        .to(".s9-trust-num", {
          duration: 1.4,
          ease: "none",
          onUpdate: function () {
            const el = document.querySelector<HTMLElement>(".s9-trust-num");
            if (el) el.textContent = Math.floor(this.progress() * 88).toString();
          },
        }, 0.5)
        .to(".s9-rep-num", {
          duration: 1.4,
          ease: "none",
          onUpdate: function () {
            const el = document.querySelector<HTMLElement>(".s9-rep-num");
            if (el) el.textContent = Math.floor(this.progress() * 94).toString();
          },
        }, 0.4);
    }, ref);

    // ---- network canvas ----
    const canvas = canvasRef.current;
    if (!canvas) return;
    const c = canvas.getContext("2d");
    if (!c) return;

    const resize = () => {
      canvas.width = canvas.offsetWidth * devicePixelRatio;
      canvas.height = canvas.offsetHeight * devicePixelRatio;
    };
    resize();
    window.addEventListener("resize", resize);

    const N = 21;
    let nodes: { x: number; y: number; r: number; pulse: number }[] = [];

    const layoutNodes = () => {
      nodes = [];
      const W = canvas.width;
      const H = canvas.height;
      for (let i = 0; i < N; i++) {
        const angle = (i / N) * Math.PI * 2;
        const radius = (Math.min(W, H) / 2) * (0.65 + (i % 3) * 0.1);
        nodes.push({
          x: W / 2 + Math.cos(angle) * radius * 0.62,
          y: H / 2 + Math.sin(angle) * radius * 0.62,
          r: 4 * devicePixelRatio,
          pulse: Math.random(),
        });
      }
    };
    layoutNodes();
    const resize2 = () => {
      resize();
      layoutNodes();
    };
    window.addEventListener("resize", resize2);

    type Email = { from: number; to: number; t: number; speed: number; hue: number };
    const emails: Email[] = [];
    const spawnEmail = () => {
      const from = Math.floor(Math.random() * N);
      let to = Math.floor(Math.random() * N);
      while (to === from) to = Math.floor(Math.random() * N);
      emails.push({
        from,
        to,
        t: 0,
        speed: 0.005 + Math.random() * 0.01,
        hue: Math.random() > 0.5 ? 160 : 260,
      });
    };

    let raf = 0;
    const tick = () => {
      c.clearRect(0, 0, canvas.width, canvas.height);

      // background lines (mesh)
      c.lineWidth = 0.6 * devicePixelRatio;
      c.strokeStyle = "rgba(255,255,255,0.04)";
      for (let i = 0; i < N; i++) {
        for (let j = i + 1; j < N; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          if (Math.hypot(dx, dy) < 230 * devicePixelRatio) {
            c.beginPath();
            c.moveTo(nodes[i].x, nodes[i].y);
            c.lineTo(nodes[j].x, nodes[j].y);
            c.stroke();
          }
        }
      }

      // spawn emails over time
      if (emails.length < 80 && Math.random() > 0.4) spawnEmail();

      // animate emails
      for (let i = emails.length - 1; i >= 0; i--) {
        const e = emails[i];
        e.t += e.speed;
        if (e.t >= 1) {
          emails.splice(i, 1);
          nodes[e.to].pulse = 1;
          continue;
        }
        const a = nodes[e.from];
        const b = nodes[e.to];
        const x = a.x + (b.x - a.x) * e.t;
        const y = a.y + (b.y - a.y) * e.t;

        // trail
        c.strokeStyle = `hsla(${e.hue},80%,70%,0.18)`;
        c.lineWidth = 1 * devicePixelRatio;
        c.beginPath();
        c.moveTo(a.x, a.y);
        c.lineTo(x, y);
        c.stroke();

        // head
        c.fillStyle = `hsla(${e.hue},90%,75%,1)`;
        c.beginPath();
        c.arc(x, y, 2.4 * devicePixelRatio, 0, Math.PI * 2);
        c.fill();

        c.shadowBlur = 14;
        c.shadowColor = `hsla(${e.hue},90%,70%,0.8)`;
        c.beginPath();
        c.arc(x, y, 1.6 * devicePixelRatio, 0, Math.PI * 2);
        c.fillStyle = "rgba(255,255,255,0.9)";
        c.fill();
        c.shadowBlur = 0;
      }

      // nodes
      for (const n of nodes) {
        n.pulse *= 0.94;
        // outer glow ring on pulse
        if (n.pulse > 0.02) {
          c.beginPath();
          c.arc(n.x, n.y, n.r + n.pulse * 26 * devicePixelRatio, 0, Math.PI * 2);
          c.strokeStyle = `rgba(124, 245, 208,${0.6 * n.pulse})`;
          c.lineWidth = 1.2 * devicePixelRatio;
          c.stroke();
        }
        c.beginPath();
        c.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        c.fillStyle = "#7cf5d0";
        c.shadowBlur = 12;
        c.shadowColor = "#7cf5d0";
        c.fill();
        c.shadowBlur = 0;

        c.beginPath();
        c.arc(n.x, n.y, n.r * 1.6, 0, Math.PI * 2);
        c.strokeStyle = "rgba(124, 245, 208,0.4)";
        c.lineWidth = 1 * devicePixelRatio;
        c.stroke();
      }

      raf = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("resize", resize2);
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
              "radial-gradient(circle at 50% 50%, rgba(124, 245, 208,0.14), transparent 60%)",
          }}
        />

        <div className="relative z-10 max-w-[1600px] mx-auto px-8 pt-20 grid grid-cols-12 gap-6 h-full">
          {/* LEFT */}
          <div className="col-span-12 md:col-span-3 flex flex-col gap-6">
            <div className="flex flex-wrap items-center gap-2">
              <div className="s9-kicker chip">
                <span className="dot" /> Step 09 · 14-day warm-up
              </div>
              <div className="chip !text-violet-glow border-violet-glow/40">
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ background: "#7c5cff", boxShadow: "0 0 10px #7c5cff" }}
                />
                via Instantly
              </div>
            </div>
            <h2 className="s9-title font-display text-[36px] md:text-[44px] leading-[0.95] tracking-[-0.02em]">
              <span className="block overflow-hidden"><span className="line block text-gradient">14 days of quiet</span></span>
              <span className="block overflow-hidden"><span className="line block text-gradient-accent">email activity</span></span>
              <span className="block overflow-hidden"><span className="line block text-gradient">— before you send.</span></span>
            </h2>
            <p className="text-xs text-white/55">
              Brand-new email accounts that suddenly blast hundreds of messages
              get flagged as spam instantly. So we run a 14-day warm-up inside
              Instantly — {businessName}&apos;s mailboxes quietly email each other,
              building a real conversation history so every inbox provider (Gmail,
              Outlook, Yahoo, Apple Mail, and the rest) sees them as trusted
              senders by the time we actually hit send for you.
            </p>

            <div className="s9-stat glass rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/40">
                  Sender reputation
                </div>
                <span className="text-accent font-mono text-xs">▲</span>
              </div>
              <div className="font-display text-3xl mt-2 text-white">
                <span className="s9-rep-num">0</span>
                <span className="text-white/40 text-base ml-1">/ 100</span>
              </div>
              <div className="h-1.5 rounded-full bg-white/5 mt-3 overflow-hidden">
                <div className="s9-rep-fill h-full w-0 bg-gradient-to-r from-accent to-violet-glow" />
              </div>
            </div>

            <div className="s9-stat glass rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/40">
                  Trust score
                </div>
                <span className="text-accent font-mono text-xs">▲</span>
              </div>
              <div className="font-display text-3xl mt-2 text-white">
                <span className="s9-trust-num">0</span>
                <span className="text-white/40 text-base ml-1">/ 100</span>
              </div>
              <div className="h-1.5 rounded-full bg-white/5 mt-3 overflow-hidden">
                <div className="s9-trust-fill h-full w-0 bg-gradient-to-r from-accent to-violet-glow" />
              </div>
            </div>

            <div className="s9-stat glass rounded-xl p-4 text-sm text-white/65">
              <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/40 mb-2">
                What&apos;s happening for 14 days
              </div>
              <ul className="space-y-1.5 text-xs">
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent mt-1.5 shrink-0" />
                  <span>The 21 mailboxes send each other real emails — and reply, like coworkers would</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent mt-1.5 shrink-0" />
                  <span>Volume ramps slowly — day 1 sends a handful, day 14 sends dozens per mailbox</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent mt-1.5 shrink-0" />
                  <span>If a message lands in spam, the receiving mailbox pulls it out and marks it &quot;not spam&quot; — training the inbox provider to trust it</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent mt-1.5 shrink-0" />
                  <span>By day 14, each mailbox has a real send history and a clean reputation</span>
                </li>
              </ul>
            </div>
          </div>

          {/* CENTER — network */}
          <div className="col-span-12 md:col-span-9">
            <div className="s9-stage relative h-[78vh] glass rounded-2xl overflow-hidden">
              <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
              <div className="absolute top-4 left-6 right-6 flex items-center justify-between text-[10px] font-mono uppercase tracking-[0.2em] text-white/40">
                <span>{businessName} · what warm-up will look like</span>
                <span className="text-white/40">preview</span>
              </div>
              <div className="absolute bottom-4 left-6 right-6 grid grid-cols-4 gap-3">
                <Stat label="Mailboxes" value="21" />
                <Stat label="Emails / hr" value="318" />
                <Stat label="Lands in inbox" value="98.4%" />
                <Stat label="Goes to spam" value="0.2%" />
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
      <div className="font-display text-base text-white mt-0.5">{value}</div>
    </div>
  );
}
