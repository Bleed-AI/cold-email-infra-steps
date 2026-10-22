"use client";

import { DeckProvider } from "./deck/DeckProvider";
import DeckShell from "./deck/DeckShell";
import TimelineNav from "./deck/TimelineNav";
import DeckControls from "./deck/DeckControls";
import CursorSpotlight from "./components/CursorSpotlight";
import VisitorIntro from "./components/VisitorIntro";
import UrlPrefill from "./deck/UrlPrefill";

export default function Page() {
  return (
    <DeckProvider>
      <main className="relative bg-ink-950 text-white">
        <UrlPrefill />
        <DeckShell />
        <TimelineNav />
        <VisitorIntro />
        <DeckControls />
        <CursorSpotlight />
      </main>
    </DeckProvider>
  );
}
