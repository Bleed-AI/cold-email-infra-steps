"use client";

import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useClient } from "../context/ClientContext";

export default function BusinessGate() {
  const { setClient } = useClient();
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from(".gate-step", { opacity: 0, y: 14, duration: 0.5, ease: "power2.out" });
      gsap.from(".gate-title .line", {
        yPercent: 110,
        duration: 1,
        stagger: 0.08,
        ease: "power4.out",
        delay: 0.1,
      });
      gsap.from(".gate-sub", { opacity: 0, y: 14, duration: 0.7, delay: 0.45, ease: "power2.out" });
      gsap.from(".gate-form", { opacity: 0, y: 18, duration: 0.7, delay: 0.6, ease: "power2.out" });
      gsap.from(".gate-foot", { opacity: 0, duration: 0.6, delay: 0.9 });
      gsap.from(".gate-ring", {
        scale: 0,
        opacity: 0,
        duration: 1.2,
        stagger: 0.15,
        delay: 0.2,
        ease: "power3.out",
      });
    }, ref);
    inputRef.current?.focus();

    // Lock scroll while gate is up — sections are mounted behind us
    const html = document.documentElement;
    const prevOverflow = html.style.overflow;
    html.style.overflow = "hidden";

    return () => {
      ctx.revert();
      html.style.overflow = prevOverflow;
      // Let the layout settle, then tell ScrollTrigger to remeasure the
      // pinned sections that were hidden behind us
      requestAnimationFrame(() => {
        ScrollTrigger.refresh();
      });
    };
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Read directly from the DOM in case the value arrived via browser autofill
    // and never fired React's onChange.
    const value = (inputRef.current?.value ?? name).trim();
    if (!value) {
      inputRef.current?.focus();
      return;
    }
    setClient(value, domain || undefined);
  };

  return (
    <div
      ref={ref}
      className="fixed inset-0 z-[100] bg-ink-950 text-white overflow-hidden flex items-center justify-center"
    >
      <div className="absolute inset-0 bg-grid opacity-40" />
      <div className="absolute inset-0 bg-radial-fade" />
      <div className="absolute inset-0 bg-vignette" />
      <div className="noise" />

      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
        <div className="relative w-[520px] h-[520px] max-w-[80vw] max-h-[80vw]">
          <div className="gate-ring absolute inset-0 rounded-full dashed-ring animate-[spin_30s_linear_infinite]" />
          <div className="gate-ring absolute inset-12 rounded-full hairline opacity-70" />
          <div className="gate-ring absolute inset-24 rounded-full hairline opacity-50" />
          <div className="gate-ring absolute inset-0 rounded-full border border-accent/10 animate-pulseRing" />
        </div>
      </div>

      <div className="relative z-10 w-full max-w-[640px] px-6 text-center">
        <div className="gate-step chip mx-auto mb-8">
          <span className="dot" />
          Step 00 · Tell us who this is for
        </div>

        <h1 className="gate-title font-display text-[40px] sm:text-[56px] md:text-[72px] leading-[0.95] tracking-[-0.03em]">
          <span className="block overflow-hidden">
            <span className="line block text-gradient">Let&apos;s build your</span>
          </span>
          <span className="block overflow-hidden">
            <span className="line block text-gradient-accent">cold email engine.</span>
          </span>
        </h1>

        <p className="gate-sub mt-6 text-white/60 text-base md:text-lg max-w-md mx-auto">
          Enter your business name. We&apos;ll show you exactly how we build,
          warm up, and deliver your inbox infrastructure — tailored to you.
        </p>

        <form
          onSubmit={handleSubmit}
          className="gate-form mt-10 mx-auto max-w-[480px] flex flex-col gap-3"
        >
          <div className="glass rounded-xl p-1 flex items-center gap-2 focus-within:border-accent/50 transition">
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onInput={(e) => setName((e.target as HTMLInputElement).value)}
              placeholder="e.g. Acme Industries"
              className="flex-1 bg-transparent px-4 py-3 outline-none text-white placeholder:text-white/30 font-display text-lg"
              maxLength={40}
              required
            />
            <button
              type="submit"
              className="group inline-flex items-center gap-2 px-5 py-3 rounded-lg font-mono text-xs font-bold uppercase tracking-[0.2em] bg-accent text-ink-950 hover:bg-accent-400 hover:scale-[1.02] transition-all duration-200 shadow-[0_0_28px_rgba(124, 245, 208,0.6)] cursor-pointer"
              style={{ backgroundColor: "#7cf5d0", color: "#050608" }}
            >
              <span>Start</span>
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                className="transition-transform group-hover:translate-x-0.5"
              >
                <path
                  d="M5 12h14M13 5l7 7-7 7"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowAdvanced((s) => !s)}
            className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/40 hover:text-white/70 transition self-center"
          >
            {showAdvanced ? "− Hide" : "+ Add"} your main domain (optional)
          </button>

          {showAdvanced && (
            <div className="glass rounded-xl p-1 flex items-center">
              <input
                type="text"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="e.g. acme.com"
                className="flex-1 bg-transparent px-4 py-3 outline-none text-white placeholder:text-white/30 font-mono text-sm"
                maxLength={60}
              />
            </div>
          )}
        </form>

        <div className="gate-foot mt-12 flex flex-wrap items-center justify-center gap-3 text-[10px] font-mono uppercase tracking-[0.2em] text-white/40">
          <span className="chip"><span className="dot" /> 5–15 domains</span>
          <span className="chip"><span className="dot" /> 3 mailboxes / domain</span>
          <span className="chip"><span className="dot" /> Warm-up</span>
          <span className="chip"><span className="dot" /> Delivery</span>
        </div>
      </div>
    </div>
  );
}
