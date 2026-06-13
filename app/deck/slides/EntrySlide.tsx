"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import type { SlideComponentProps } from "../types";
import { useSlideTimeline } from "../useSlideTimeline";
import { useDeck } from "../useDeck";
import { useClient } from "../../context/ClientContext";

/**
 * Slide 0: the merged hero + input. One form (company/domain, first, last),
 * a hero motif that auto-plays immediately (no data needed) and then settles
 * into an ambient loop. Submitting captures the client and soft-unlocks the
 * deck (timeline + jump-to-step) before advancing to Step 1.
 */
export default function EntrySlide({ handleRef, onComplete }: SlideComponentProps) {
  const scopeRef = useRef<HTMLDivElement>(null);
  const reduce = !!useReducedMotion();
  const { setClient, client } = useClient();
  const { start } = useDeck();

  // Pre-fill when jumping back to edit details.
  const [company, setCompany] = useState(client?.businessName ?? "");
  const [firstName, setFirstName] = useState(client?.firstName ?? "");
  const [lastName, setLastName] = useState(client?.lastName ?? "");
  const companyRef = useRef<HTMLInputElement>(null);

  useSlideTimeline({
    scopeRef,
    handleRef,
    reducedMotion: reduce,
    onComplete,
    buildIntro: (tl) => {
      tl.from(".entry-ring", {
        scale: 0,
        opacity: 0,
        duration: 1.2,
        stagger: 0.14,
        ease: "power3.out",
      })
        .from(".entry-eyebrow", { opacity: 0, y: 14, duration: 0.5 }, 0.2)
        .from(
          ".entry-title .line",
          { yPercent: 110, stagger: 0.08, duration: 0.9, ease: "power4.out" },
          0.3
        )
        .from(".entry-sub", { opacity: 0, y: 16, duration: 0.7 }, 0.7)
        .from(".entry-form", { opacity: 0, y: 18, duration: 0.7 }, 0.85)
        .from(".entry-foot", { opacity: 0, duration: 0.6 }, 1.05);
    },
    buildLoop: (tl) => {
      tl.to(
        ".entry-spin",
        { rotation: 360, duration: 48, ease: "none", repeat: -1, transformOrigin: "center" },
        0
      ).to(
        ".entry-core",
        { scale: 1.06, duration: 2.6, yoyo: true, repeat: -1, ease: "sine.inOut" },
        0
      );
    },
  });

  useEffect(() => {
    companyRef.current?.focus();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Read straight from the DOM in case the value arrived via autofill.
    const rawCompany = (companyRef.current?.value ?? company).trim();
    if (!rawCompany) {
      companyRef.current?.focus();
      return;
    }
    // One field accepts a company name OR a domain; infer which.
    const looksLikeDomain = /\.[a-z]{2,}$/i.test(rawCompany) && !rawCompany.includes(" ");
    const businessName = looksLikeDomain
      ? rawCompany.replace(/^https?:\/\//, "").split(/[./]/)[0]
      : rawCompany;
    const mainDomain = looksLikeDomain
      ? rawCompany.replace(/^https?:\/\//, "").replace(/\/.*$/, "")
      : undefined;

    setClient({
      businessName,
      mainDomain,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
    });
    start();
  };

  return (
    <div
      ref={scopeRef}
      className="relative h-full w-full overflow-hidden bg-ink-950 flex items-center justify-center"
    >
      <div className="absolute inset-0 bg-grid opacity-40" />
      <div className="absolute inset-0 bg-radial-fade" />
      <div className="absolute inset-0 bg-vignette" />
      <div className="noise" />

      {/* ambient rings */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
        <div className="entry-core relative w-[560px] h-[560px] max-w-[82vw] max-h-[82vw]">
          <div className="entry-ring entry-spin absolute inset-0 rounded-full dashed-ring" />
          <div className="entry-ring absolute inset-[8%] rounded-full hairline opacity-70" />
          <div className="entry-ring absolute inset-[18%] rounded-full hairline opacity-50" />
          <div className="entry-ring absolute inset-0 rounded-full border border-accent/10 animate-pulseRing" />
        </div>
      </div>

      <div className="relative z-10 w-full max-w-[680px] px-6 text-center">
        <div className="entry-eyebrow chip mx-auto mb-7">
          <span className="dot" /> Bleed AI · Cold email walkthrough
        </div>

        <h1 className="entry-title font-display text-[40px] sm:text-[56px] md:text-[72px] leading-[0.95] tracking-[-0.03em]">
          <span className="block overflow-hidden">
            <span className="line block text-gradient">Let&apos;s build your</span>
          </span>
          <span className="block overflow-hidden">
            <span className="line block text-gradient-accent">cold email engine.</span>
          </span>
        </h1>

        <p className="entry-sub mt-6 text-white/60 text-base md:text-lg max-w-md mx-auto">
          Tell us who this is for. We&apos;ll walk you through every step — from
          domains and warm-up to sourcing, copy, and live sending — tailored to
          you.
        </p>

        <form
          onSubmit={handleSubmit}
          className="entry-form mt-9 mx-auto max-w-[520px] flex flex-col gap-3"
        >
          <div className="glass rounded-xl p-1 flex items-center focus-within:border-accent/50 transition">
            <input
              ref={companyRef}
              type="text"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              onInput={(e) => setCompany((e.target as HTMLInputElement).value)}
              placeholder="Company name or website (e.g. Acme or acme.com)"
              className="flex-1 bg-transparent px-4 py-3 outline-none text-white placeholder:text-white/30 font-display text-base"
              maxLength={60}
              required
            />
          </div>

          <div className="flex gap-3">
            <div className="glass rounded-xl p-1 flex items-center flex-1">
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="First name"
                className="flex-1 bg-transparent px-4 py-3 outline-none text-white placeholder:text-white/30 text-sm"
                maxLength={30}
              />
            </div>
            <div className="glass rounded-xl p-1 flex items-center flex-1">
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Last name"
                className="flex-1 bg-transparent px-4 py-3 outline-none text-white placeholder:text-white/30 text-sm"
                maxLength={30}
              />
            </div>
          </div>

          <button
            type="submit"
            className="group mt-1 inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-mono text-xs font-bold uppercase tracking-[0.2em] hover:scale-[1.01] transition-all duration-200 cursor-pointer"
            style={{
              backgroundColor: "#7cf5d0",
              color: "#050608",
              boxShadow: "0 0 28px rgba(124,245,208,0.45)",
            }}
          >
            <span>{client ? "Update & relaunch" : "Start the walkthrough"}</span>
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
        </form>

        <div className="entry-foot mt-10 flex flex-wrap items-center justify-center gap-2 text-[10px] font-mono uppercase tracking-[0.2em] text-white/40">
          <span className="chip"><span className="dot" /> Setup</span>
          <span className="chip"><span className="dot" /> Warm-up</span>
          <span className="chip"><span className="dot" /> List building</span>
          <span className="chip"><span className="dot" /> Personalized copy</span>
          <span className="chip"><span className="dot" /> Live sending</span>
        </div>
      </div>
    </div>
  );
}
