"use client";

import { useEffect, useMemo, useRef } from "react";
import { gsap } from "gsap";
import { useClient } from "../context/ClientContext";
import { buildMailboxes, buildSendingDomains } from "../lib/domains";

export default function MailboxCreation() {
  const ref = useRef<HTMLDivElement>(null);
  const { client } = useClient();
  const businessName = client?.businessName ?? "your business";
  const slug = client?.slug ?? "client";
  const DOMAINS = useMemo(() => buildSendingDomains(slug), [slug]);
  const inboxes = useMemo(() => buildMailboxes(DOMAINS, 3), [DOMAINS]);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: ref.current,
          start: "top top",
          end: "+=400%",
          scrub: 0.5,
          pin: true,
        },
      });

      tl.from(".s6-kicker", { opacity: 0, y: 20 }, 0)
        .from(".s6-title .line", { yPercent: 110, stagger: 0.06 }, 0)
        .from(".s6-domain", {
          opacity: 0,
          y: 40,
          stagger: 0.06,
          duration: 0.4,
        }, 0.2)
        .from(".s6-mbox", {
          opacity: 0,
          y: 30,
          scale: 0.85,
          stagger: { amount: 1.4, from: "start" },
          duration: 0.4,
        }, 0.6)
        .from(".s6-avatar", {
          scale: 0,
          stagger: { amount: 1.4, from: "start" },
          duration: 0.3,
          ease: "back.out(1.6)",
        }, 0.8)
        .to(".s6-counter", {
          duration: 1.6,
          ease: "none",
          onUpdate: function () {
            const el = document.querySelector<HTMLElement>(".s6-counter");
            if (el) el.textContent = String(Math.floor(this.progress() * 21));
          },
        }, 0.6);
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
              "radial-gradient(circle at 50% 30%, rgba(124, 245, 208,0.10), transparent 60%)",
          }}
        />

        <div className="relative z-10 max-w-[1500px] mx-auto px-8 pt-20 grid grid-cols-12 gap-6">
          <div className="col-span-12 md:col-span-3">
            <div className="flex flex-wrap items-center gap-2 mb-6">
              <div className="s6-kicker chip">
                <span className="dot" /> Step 06 · We create the mailboxes
              </div>
              <div className="chip !text-accent border-accent/40">
                <span className="dot" /> via Zapmail
              </div>
            </div>
            <h2 className="s6-title font-display text-[28px] md:text-[36px] leading-[0.95] tracking-[-0.02em]">
              <span className="block overflow-hidden"><span className="line block text-gradient">3 mailboxes</span></span>
              <span className="block overflow-hidden"><span className="line block text-gradient-accent">per domain.</span></span>
              <span className="block overflow-hidden"><span className="line block text-gradient">Google or Microsoft.</span></span>
            </h2>
            <p className="mt-5 text-white/55 text-sm">
              3 mailboxes per domain is our protocol — enough volume to scale,
              few enough that every inbox provider treats each mailbox like a
              normal human. We use Zapmail to spin them up on Google Workspace
              or Microsoft 365 (your call) and wait for full activation.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <span className="chip"><span className="dot" /> Google Workspace</span>
              <span className="chip"><span className="dot" /> Microsoft 365</span>
              <span className="chip"><span className="dot" /> Adjustable count</span>
            </div>

            <div className="mt-8 glass rounded-xl p-5">
              <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-[0.2em] text-white/40">
                <span>Total mailboxes (example)</span>
                <span className="text-white/40">preview</span>
              </div>
              <div className="mt-2 font-display text-[64px] leading-none text-white">
                <span className="s6-counter">0</span>
              </div>
              <div className="mt-2 text-xs text-white/50">of 21 (= 7 domains × 3)</div>
              <div className="h-1.5 rounded-full bg-white/5 mt-4 overflow-hidden">
                <div className="s6-bar h-full bg-gradient-to-r from-accent to-violet-glow w-full" />
              </div>
            </div>
          </div>

          {/* RIGHT — domain → mailbox grid */}
          <div className="col-span-12 md:col-span-9">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 max-h-[78vh] overflow-hidden">
              {DOMAINS.map((d, di) => {
                const mboxes = inboxes.slice(di * 3, di * 3 + 3);
                return (
                  <div
                    key={d}
                    className="s6-domain glass rounded-xl p-4 flex flex-col gap-3"
                  >
                    <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-[0.2em] text-white/40">
                      <span>Domain</span>
                      <span className="text-accent">●</span>
                    </div>
                    <div className="font-mono text-sm text-white">{d}</div>
                    <div className="space-y-2 mt-1">
                      {mboxes.map((m, mi) => (
                        <div
                          key={mi}
                          className="s6-mbox flex items-center gap-2.5 rounded-md bg-white/[0.03] border border-white/5 px-2.5 py-2"
                        >
                          <div
                            className="s6-avatar w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-mono"
                            style={{
                              background: `conic-gradient(from ${m.hue}deg, #7cf5d0, #7c5cff, #7cf5d0)`,
                            }}
                          >
                            <span className="bg-ink-900 w-6 h-6 rounded-full flex items-center justify-center text-white">
                              {m.name.split(" ").map((n) => n[0]).join("")}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-[12px] text-white truncate">{m.name}</div>
                            <div className="text-[10px] text-white/50 truncate font-mono">{m.handle}</div>
                          </div>
                          <span className="w-1.5 h-1.5 rounded-full bg-accent shadow-[0_0_8px_#7cf5d0]" />
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
