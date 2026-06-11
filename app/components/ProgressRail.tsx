"use client";

import { useEffect, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

const STAGES = [
  "Intro",
  "Proposal",
  "Approval",
  "Identities",
  "Purchase",
  "Mailboxes",
  "DNS",
  "Export",
  "Warm-up",
  "QA",
  "Launch",
];

export default function ProgressRail() {
  const [active, setActive] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const update = () => {
      const h = document.documentElement;
      const scrollTop = h.scrollTop || document.body.scrollTop;
      const max = h.scrollHeight - h.clientHeight;
      const p = max > 0 ? scrollTop / max : 0;
      setProgress(p);
      setActive(Math.min(STAGES.length - 1, Math.floor(p * STAGES.length)));
    };
    const st = ScrollTrigger.create({ onUpdate: update });
    update();
    return () => st.kill();
  }, []);

  return (
    <div className="fixed right-6 top-1/2 -translate-y-1/2 z-40 hidden lg:flex flex-col items-end gap-3 font-mono">
      <div className="text-[10px] tracking-[0.2em] uppercase text-white/40">
        {String(active + 1).padStart(2, "0")} / 11
      </div>
      <div className="relative h-[220px] w-[2px] bg-white/10 overflow-hidden">
        <div
          className="absolute top-0 left-0 right-0 bg-gradient-to-b from-accent to-violet-glow"
          style={{ height: `${progress * 100}%` }}
        />
      </div>
      <div className="text-[10px] tracking-[0.2em] uppercase text-white/80">
        {STAGES[active]}
      </div>
    </div>
  );
}
