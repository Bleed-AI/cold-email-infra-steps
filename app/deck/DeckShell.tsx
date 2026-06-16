"use client";

import { useEffect } from "react";
import { useDeck } from "./useDeck";
import SlideFrame from "./SlideFrame";

function isTypingTarget(el: EventTarget | null): boolean {
  const node = el as HTMLElement | null;
  if (!node) return false;
  const tag = node.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || node.isContentEditable;
}

export default function DeckShell() {
  const deck = useDeck();
  const { unlocked, next, prev, go, slides } = deck;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!unlocked || isTypingTarget(e.target)) return;
      switch (e.key) {
        case "ArrowDown":
        case "ArrowRight":
        case "PageDown":
          e.preventDefault();
          next();
          break;
        case "ArrowUp":
        case "ArrowLeft":
        case "PageUp":
          e.preventDefault();
          prev();
          break;
        default: {
          // Number keys jump straight to a step. Steps are 1-based for the
          // user (Setup = "1") but 0-based as slide indices, so map n -> n-1.
          if (/^[1-9]$/.test(e.key)) {
            const n = Number(e.key);
            if (n >= 1 && n <= slides.length) {
              e.preventDefault();
              go(n - 1);
            }
          }
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [unlocked, next, prev, go, slides.length]);

  return (
    <div className="fixed inset-0 overflow-hidden bg-ink-950">
      {slides.map((def, i) => (
        <SlideFrame key={def.id} def={def} index={i} />
      ))}
    </div>
  );
}
