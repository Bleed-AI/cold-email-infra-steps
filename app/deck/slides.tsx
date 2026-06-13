import type { SlideDef } from "./types";
import EntrySlide from "./slides/EntrySlide";
import { makeScreenSlide } from "./screenSlide";
import NetworkSetup from "../lab/_variants/network";
import WarmupScreen from "../screens/WarmupScreen";
import ListBuildingScreen from "../screens/ListBuildingScreen";
import CopyScreen from "../screens/CopyScreen";
import SendingScreen from "../screens/SendingScreen";
import MonitoringScreen from "../screens/MonitoringScreen";

/**
 * The deck. Entry is the input gate (slide 0); every step after it is a
 * finalized network-language screen (scrub-clock driven, narration rail,
 * readable email cards), adapted into the deck via makeScreenSlide so it plays
 * on arrival and shows its finished state + Replay on re-entry.
 */
export const SLIDES: SlideDef[] = [
  {
    id: "entry",
    label: "Start",
    kind: "one-shot-then-loop",
    navHidden: true,
    Component: EntrySlide,
  },
  { id: "setup", label: "Setup", kind: "one-shot-then-loop", Component: makeScreenSlide(NetworkSetup) },
  { id: "warmup", label: "Warm-up", kind: "one-shot", Component: makeScreenSlide(WarmupScreen) },
  { id: "list", label: "Building the list", kind: "one-shot", Component: makeScreenSlide(ListBuildingScreen) },
  { id: "copy", label: "AI copy", kind: "one-shot", Component: makeScreenSlide(CopyScreen) },
  { id: "sending", label: "Live sending", kind: "one-shot", Component: makeScreenSlide(SendingScreen) },
  { id: "monitoring", label: "Monitoring", kind: "one-shot", Component: makeScreenSlide(MonitoringScreen) },
];
