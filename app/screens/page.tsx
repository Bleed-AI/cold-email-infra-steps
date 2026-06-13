"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { SAMPLE } from "../lab/sample";

// Audit + preview gallery for the finalized deck screens. Each mounts client-only
// and exposes window.__lab.renderAt(t) for frame-by-frame review.
const SCREENS = [
  { key: "setup", label: "Setup", Comp: dynamic(() => import("../lab/_variants/network"), { ssr: false }) },
  { key: "warmup", label: "Warm-up", Comp: dynamic(() => import("./WarmupScreen"), { ssr: false }) },
  { key: "list", label: "List building", Comp: dynamic(() => import("./ListBuildingScreen"), { ssr: false }) },
  { key: "copy", label: "AI copy", Comp: dynamic(() => import("./CopyScreen"), { ssr: false }) },
  { key: "sending", label: "Live sending", Comp: dynamic(() => import("./SendingScreen"), { ssr: false }) },
  { key: "monitoring", label: "Monitoring", Comp: dynamic(() => import("./MonitoringScreen"), { ssr: false }) },
];

export default function ScreensGallery() {
  const [active, setActive] = useState(0);
  const Active = SCREENS[active].Comp;

  return (
    <div className="fixed inset-0 bg-ink-950 text-white">
      <Active {...SAMPLE} />
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-1 rounded-full glass px-2 py-2">
        <span className="px-2 text-[10px] font-mono uppercase tracking-[0.2em] text-white/35">Deck screens</span>
        {SCREENS.map((s, i) => (
          <button
            key={s.key}
            onClick={() => setActive(i)}
            className={[
              "shrink-0 inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[11px] font-mono uppercase tracking-[0.14em] transition-colors cursor-pointer whitespace-nowrap",
              i === active ? "bg-accent text-ink-950" : "text-white/50 hover:text-white",
            ].join(" ")}
          >
            <span className="opacity-60">{i + 1}</span>
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}
