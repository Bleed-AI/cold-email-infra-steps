"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { useClient } from "../context/ClientContext";

export default function WorkspaceSetup() {
  const ref = useRef<HTMLDivElement>(null);
  const { client } = useClient();
  const businessName = client?.businessName ?? "your business";
  const mainDomain = client?.mainDomain ?? "yourbrand.com";
  const slug = client?.slug ?? "client";

  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: ref.current,
          start: "top top",
          end: "+=220%",
          scrub: 0.7,
          pin: true,
        },
      });
      tl.from(".s4-kicker", { opacity: 0, y: 20 }, 0)
        .from(".s4-title .line", { yPercent: 110, stagger: 0.06 }, 0)
        .from(".s4-workspace", {
          opacity: 0,
          scale: 0.92,
          y: 30,
          duration: 0.8,
        }, 0.1)
        .from(".s4-panel", {
          opacity: 0,
          y: 30,
          stagger: 0.1,
        }, 0.3)
        .from(".s4-row", {
          opacity: 0,
          x: -20,
          stagger: 0.06,
        }, 0.5)
        .from(".s4-admin", {
          opacity: 0,
          scale: 0.7,
          duration: 0.5,
        }, 0.8)
        .from(".s4-plan", {
          opacity: 0,
          y: 20,
          duration: 0.6,
        }, 0.9)
        .to(".s4-workspace", { scale: 1.02, duration: 0.6 }, 1.1);
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
              "radial-gradient(circle at 70% 50%, rgba(124, 92, 255,0.10), transparent 60%)",
          }}
        />

        <div className="relative z-10 h-full max-w-[1500px] mx-auto px-8 grid grid-cols-12 gap-8 items-center pt-20">
          <div className="col-span-12 md:col-span-4">
            <div className="flex flex-wrap items-center gap-2 mb-6">
              <div className="s4-kicker chip">
                <span className="dot" /> Step 04 · Names + photos
              </div>
              <div className="chip !text-accent border-accent/40">
                <span className="dot" /> in parallel
              </div>
            </div>
            <h2 className="s4-title font-display text-[32px] md:text-[44px] leading-[0.95] tracking-[-0.02em]">
              <span className="block overflow-hidden"><span className="line block text-gradient">You send names.</span></span>
              <span className="block overflow-hidden"><span className="line block text-gradient-accent">You send photos.</span></span>
              <span className="block overflow-hidden"><span className="line block text-gradient">We assign them.</span></span>
            </h2>
            <p className="mt-6 text-white/55 max-w-md">
              Each mailbox needs a real identity — a real name and a real photo —
              so prospects open emails from a person, not a faceless inbox. We
              ask you for the names and photos you want to use. Send them over
              any time during the build — we attach one identity per mailbox
              when we create them in Step 06.
            </p>
            <div className="s4-plan mt-8 glass rounded-xl p-5">
              <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-[0.2em] text-white/40">
                <span>Identity plan for {businessName}</span>
                <span className="text-white/40">preview</span>
              </div>
              <div className="mt-3 flex items-end justify-between">
                <div>
                  <div className="font-display text-3xl text-white">21 / 21</div>
                  <div className="text-xs text-white/50 mt-1">names + photos — once you send them</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] font-mono text-white/40">all activated in</div>
                  <div className="font-display text-2xl text-accent">~1h</div>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT — workspace dashboard mockup */}
          <div className="col-span-12 md:col-span-8 relative">
            <div className="s4-workspace relative aspect-[16/10] glass rounded-2xl overflow-hidden p-3">
              {/* topbar */}
              <div className="flex items-center justify-between border-b border-white/5 pb-3">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-400/70" />
                  <span className="w-2.5 h-2.5 rounded-full bg-yellow-400/70" />
                  <span className="w-2.5 h-2.5 rounded-full bg-green-400/70" />
                  <span className="ml-3 chip">
                    <span className="dot" /> {slug} · identities
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="s4-admin flex items-center gap-2 chip">
                    <span className="w-5 h-5 rounded-full bg-gradient-to-br from-accent to-violet-glow" />
                    Admin · client
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-12 gap-3 mt-3 h-[calc(100%-44px)]">
                {/* sidebar */}
                <div className="col-span-2 flex flex-col gap-1.5 text-[11px] font-mono">
                  {["Identities", "Names", "Photos", "Mailboxes", "Domains", "Settings"].map((l, i) => (
                    <div
                      key={l}
                      className={`s4-row px-2 py-1.5 rounded ${
                        i === 0
                          ? "bg-accent/10 text-accent"
                          : "text-white/60 hover:text-white/80"
                      }`}
                    >
                      {l}
                    </div>
                  ))}
                </div>

                {/* main grid */}
                <div className="col-span-10 grid grid-cols-12 grid-rows-6 gap-3">
                  <div className="s4-panel col-span-4 row-span-3 glass rounded-lg p-3 flex flex-col">
                    <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/40">Names proposed</div>
                    <div className="font-display text-2xl text-white mt-1">21 / 21</div>
                    <div className="mt-auto text-xs text-white/50">All natural-sounding</div>
                  </div>
                  <div className="s4-panel col-span-4 row-span-3 glass rounded-lg p-3">
                    <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/40">Photos received</div>
                    <div className="font-display text-2xl text-white mt-1">21 / 21</div>
                    <div className="h-1.5 rounded-full bg-white/5 mt-3 overflow-hidden">
                      <div className="h-full w-full bg-gradient-to-r from-accent to-violet-glow" />
                    </div>
                  </div>
                  <div className="s4-panel col-span-4 row-span-3 glass rounded-lg p-3">
                    <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/40">Assigned to</div>
                    <div className="font-display text-2xl text-white mt-1">7 domains</div>
                    <div className="text-xs text-white/50 mt-3">3 identities each</div>
                  </div>

                  <div className="s4-panel col-span-8 row-span-3 glass rounded-lg p-3 overflow-hidden">
                    <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-[0.2em] text-white/40">
                      <span>Activity</span>
                      <span className="text-accent">live</span>
                    </div>
                    <ActivityChart />
                  </div>
                  <div className="s4-panel col-span-4 row-span-3 glass rounded-lg p-3">
                    <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/40">Approved by</div>
                    <div className="mt-3 space-y-2 text-xs">
                      <div className="s4-row flex items-center justify-between">
                        <span className="text-white">Names</span>
                        <span className="text-accent truncate ml-2">{businessName}</span>
                      </div>
                      <div className="s4-row flex items-center justify-between">
                        <span className="text-white">Photos</span>
                        <span className="text-accent truncate ml-2">{businessName}</span>
                      </div>
                      <div className="s4-row flex items-center justify-between">
                        <span className="text-white">Pairing</span>
                        <span className="text-white/60">mailforge</span>
                      </div>
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

function ActivityChart() {
  const bars = Array.from({ length: 28 }).map(
    (_, i) => 32 + Math.sin(i / 2) * 22 + Math.sin(i * 1.7 + 1) * 14
  );
  return (
    <div className="mt-3 h-[80%] flex items-end gap-1">
      {bars.map((h, i) => (
        <div
          key={i}
          className="flex-1 bg-gradient-to-t from-accent/60 to-violet-glow/60 rounded-sm"
          style={{ height: `${h}%` }}
        />
      ))}
    </div>
  );
}
