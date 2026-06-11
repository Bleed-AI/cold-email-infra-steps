"use client";

import { useCallback, useEffect, useState } from "react";
import { ScrollTrigger } from "gsap/ScrollTrigger";

type LenisLike = {
  scrollTo: (
    target: number,
    options?: {
      duration?: number;
      immediate?: boolean;
      onComplete?: () => void;
      lock?: boolean;
    }
  ) => void;
};

const getLenis = (): LenisLike | undefined =>
  (window as unknown as { __lenis?: LenisLike }).__lenis;

// GSAP wraps every pinned section in a div.pin-spacer that stays anchored to the
// section's natural document position regardless of pin state, so we use it as
// the stable source of truth for layout math.
const findPinSpacer = (section: HTMLElement): HTMLElement | null => {
  let el: HTMLElement | null = section.parentElement;
  while (el) {
    if (el.classList && el.classList.contains("pin-spacer")) return el;
    el = el.parentElement;
  }
  return null;
};

const getDocTop = (el: HTMLElement): number =>
  el.getBoundingClientRect().top + window.scrollY;

const getSectionStart = (section: HTMLElement): number => {
  const pinSpacer = findPinSpacer(section);
  return getDocTop(pinSpacer ?? section);
};

const getSectionLand = (section: HTMLElement): number => {
  const pinSpacer = findPinSpacer(section);
  if (pinSpacer) {
    const pinSpacerTop = getDocTop(pinSpacer);
    const pinDuration = Math.max(0, pinSpacer.offsetHeight - section.offsetHeight);
    // Land just before the section unpins so all scrub animations are at ~100%.
    return Math.max(0, pinSpacerTop + pinDuration - 30);
  }
  return getDocTop(section);
};

// After the smooth scroll lands, force every scrub tween to snap to its current
// target progress. Without this, scrub: 0.6 means animations lag ~600ms behind
// the new scroll position and the user sees the section without its elements.
const snapScrubTweens = () => {
  try {
    ScrollTrigger.getAll().forEach((t) => {
      const tweenGetter = (t as unknown as { getTween?: () => unknown }).getTween;
      if (typeof tweenGetter !== "function") return;
      const tween = tweenGetter.call(t) as
        | { progress?: (v: number) => unknown }
        | null
        | undefined;
      if (tween && typeof tween.progress === "function") {
        tween.progress(1);
      }
    });
    ScrollTrigger.update();
  } catch {
    /* ignore */
  }
};

export default function PresentationControls() {
  const [sections, setSections] = useState<HTMLElement[]>([]);
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const collect = () => {
      const els = Array.from(document.querySelectorAll<HTMLElement>("section"));
      setSections(els);
    };
    collect();
    const t1 = window.setTimeout(collect, 400);
    const t2 = window.setTimeout(collect, 1500);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, []);

  useEffect(() => {
    if (sections.length === 0) return;
    const onScroll = () => {
      const s = window.scrollY;
      let idx = 0;
      for (let i = 0; i < sections.length; i++) {
        if (getSectionStart(sections[i]) <= s + 10) idx = i;
      }
      setCurrent(idx);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [sections]);

  const goTo = useCallback(
    (idx: number) => {
      if (idx < 0 || idx >= sections.length) return;
      const target = getSectionLand(sections[idx]);
      const distance = Math.abs(target - window.scrollY);
      // Element reveal animations inside each section are scrub-bound to scroll
      // position — meaning their playback speed is governed by how fast we
      // scroll through the pin range. Use a long duration so each chip / card /
      // line animates in at a readable pace, not a blur.
      const duration = Math.max(4.5, Math.min(7.5, distance / 1200));

      const lenis = getLenis();
      if (lenis?.scrollTo) {
        lenis.scrollTo(target, {
          duration,
          onComplete: () => {
            // Snap fires well after the scroll lands — by this time scrub has
            // already settled, so this is just a safety net.
            window.setTimeout(snapScrubTweens, 1200);
          },
        });
      } else {
        window.scrollTo({ top: target, behavior: "smooth" });
        window.setTimeout(snapScrubTweens, duration * 1000 + 1200);
      }
    },
    [sections]
  );

  if (sections.length === 0) return null;

  const atStart = current === 0;
  const atEnd = current >= sections.length - 1;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2">
      <button
        onClick={() => goTo(current - 1)}
        disabled={atStart}
        aria-label="Previous section"
        title="Previous section"
        className="w-11 h-11 rounded-full border border-white/15 bg-ink-900/85 backdrop-blur-md flex items-center justify-center text-white/80 hover:text-accent hover:border-accent/50 transition disabled:opacity-25 disabled:cursor-not-allowed"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path
            d="M5 15l7-7 7 7"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      <button
        onClick={() => goTo(current + 1)}
        disabled={atEnd}
        aria-label="Next section"
        title="Next section"
        className="w-11 h-11 rounded-full border border-white/15 bg-ink-900/85 backdrop-blur-md flex items-center justify-center text-white/80 hover:text-accent hover:border-accent/50 transition disabled:opacity-25 disabled:cursor-not-allowed"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path
            d="M5 9l7 7 7-7"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </div>
  );
}
