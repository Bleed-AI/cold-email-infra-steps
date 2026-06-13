import type React from "react";
import type { SlideHandle } from "../deck/types";

/** Core data every screen renders from. */
export type SetupVariantProps = {
  businessName: string;
  slug: string;
  mainDomain: string;
};

/**
 * Screens accept these extra OPTIONAL props only when mounted inside the deck.
 * In the /lab and /screens galleries they're omitted, so the screen autoplays
 * standalone. In the deck, `deckHandleRef` lets SlideFrame drive play/seek and
 * `onDone` fires when the one-shot finishes (→ marks the slide completed).
 */
export type ScreenProps = SetupVariantProps & {
  deckHandleRef?: React.Ref<SlideHandle>;
  onDone?: () => void;
};
