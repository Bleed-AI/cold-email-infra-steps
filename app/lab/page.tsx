"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { SAMPLE } from "./sample";

// Each variant is client-only (canvas / webgl / layout measuring), so mount the
// active one with ssr:false. Only the selected variant mounts — heavy WebGL
// loads on demand.
const VARIANTS = [
  { key: "cinematic", label: "Cinematic", Comp: dynamic(() => import("./_variants/cinematic"), { ssr: false }) },
  { key: "webgl", label: "3D / WebGL", Comp: dynamic(() => import("./_variants/webgl"), { ssr: false }) },
  { key: "network", label: "Network", Comp: dynamic(() => import("./_variants/network"), { ssr: false }) },
  { key: "motion", label: "Motion-design", Comp: dynamic(() => import("./_variants/motion"), { ssr: false }) },
];

export default function LabPage() {
  const [active, setActive] = useState(0);
  const Active = VARIANTS[active].Comp;

  return (
    <div className="fixed inset-0 bg-ink-950 text-white">
      <Active {...SAMPLE} />

      {/* variant switcher */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-1 rounded-full glass px-2 py-2">
        <span className="px-2 text-[10px] font-mono uppercase tracking-[0.2em] text-white/35">Setup · directions</span>
        {VARIANTS.map((v, i) => (
          <button
            key={v.key}
            onClick={() => setActive(i)}
            className={[
              "shrink-0 inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[11px] font-mono uppercase tracking-[0.14em] transition-colors cursor-pointer whitespace-nowrap",
              i === active ? "bg-accent text-ink-950" : "text-white/50 hover:text-white",
            ].join(" ")}
          >
            <span className="opacity-60">{i + 1}</span>
            {v.label}
          </button>
        ))}
      </div>
    </div>
  );
}
