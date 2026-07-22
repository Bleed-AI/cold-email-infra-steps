import type { SlideDef } from "./types";
import { makeScreenSlide } from "./screenSlide";
import NetworkSetup from "../lab/_variants/network";
import WarmupScreen from "../screens/WarmupScreen";
import ListBuildingScreen from "../screens/ListBuildingScreen";
import SignalsScreen from "../screens/SignalsScreen";
import CopyScreen from "../screens/CopyScreen";
import SprintScreen from "../screens/SprintScreen";
import SendingScreen from "../screens/SendingScreen";
import SubSequenceScreen from "../screens/SubSequenceScreen";
// WeeklyWinsScreen import kept commented for easy restore of the slide.
// import WeeklyWinsScreen from "../screens/WeeklyWinsScreen";
import MonitoringScreen from "../screens/MonitoringScreen";

/**
 * The deck. There is no input gate — the deck opens straight on Setup. Every
 * step is a finalized network-language screen (scrub-clock driven, narration
 * rail, readable email cards), adapted into the deck via makeScreenSlide so it
 * plays on arrival and shows its finished state + Replay on re-entry. The
 * client persona defaults to Acme and is editable live from the top nav.
 */
export const SLIDES: SlideDef[] = [
  { id: "setup", label: "Setup", kind: "one-shot-then-loop", Component: makeScreenSlide(NetworkSetup) },
  { id: "warmup", label: "Warm-up", kind: "one-shot-then-loop", Component: makeScreenSlide(WarmupScreen) },
  { id: "list", label: "Building the list", kind: "one-shot-then-loop", Component: makeScreenSlide(ListBuildingScreen) },
  { id: "signals", label: "Signals", kind: "one-shot-then-loop", Component: makeScreenSlide(SignalsScreen) },
  { id: "sprint", label: "Sprint", kind: "one-shot-then-loop", Component: makeScreenSlide(SprintScreen) },
  { id: "copy", label: "AI copy", kind: "one-shot-then-loop", Component: makeScreenSlide(CopyScreen) },
  { id: "sending", label: "Live sending", kind: "one-shot-then-loop", Component: makeScreenSlide(SendingScreen) },
  { id: "subseq", label: "Sub-sequence", kind: "one-shot-then-loop", Component: makeScreenSlide(SubSequenceScreen) },
  // TEMP HIDDEN — Weekly Wins slide is kept in code but excluded from the deck.
  // To bring it back, un-comment the line below.
  // { id: "wow", label: "Weekly wins", kind: "one-shot-then-loop", Component: makeScreenSlide(WeeklyWinsScreen) },
  { id: "monitoring", label: "Monitoring", kind: "one-shot-then-loop", Component: makeScreenSlide(MonitoringScreen) },
];
