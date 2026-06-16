"use client";

import type { ComponentType } from "react";
import type { ScreenProps } from "../lab/types";
import type { SlideComponentProps } from "./types";
import { useClient } from "../context/ClientContext";

/**
 * Adapts a standalone screen (which renders from {businessName,slug,mainDomain}
 * and drives itself with useScrubClock) into a deck slide. SlideFrame passes
 * `handleRef` + `onComplete`; we feed real client data and bridge them so the
 * deck controls playback: plays on entry, shows the finished frame + Replay on
 * re-entry, and never auto-loops offscreen.
 */
export function makeScreenSlide(Screen: ComponentType<ScreenProps>) {
  function ScreenSlide({ handleRef, onComplete }: SlideComponentProps) {
    const { client } = useClient();
    return (
      <Screen
        businessName={client.businessName}
        slug={client.slug}
        mainDomain={client.mainDomain}
        deckHandleRef={handleRef}
        onDone={onComplete}
      />
    );
  }
  ScreenSlide.displayName = `ScreenSlide(${Screen.displayName || Screen.name || "Screen"})`;
  return ScreenSlide;
}
