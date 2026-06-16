import type { SlideDef } from "./types";
import { makeScreenSlide } from "./screenSlide";
import NetworkSetup from "../lab/_variants/network";
import WarmupScreen from "../screens/WarmupScreen";
import ListBuildingScreen from "../screens/ListBuildingScreen";
import CopyScreen from "../screens/CopyScreen";
import SendingScreen from "../screens/SendingScreen";
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
  { id: "copy", label: "AI copy", kind: "one-shot-then-loop", Component: makeScreenSlide(CopyScreen) },
  { id: "sending", label: "Live sending", kind: "one-shot-then-loop", Component: makeScreenSlide(SendingScreen) },
  { id: "monitoring", label: "Monitoring", kind: "one-shot-then-loop", Component: makeScreenSlide(MonitoringScreen) },
];
