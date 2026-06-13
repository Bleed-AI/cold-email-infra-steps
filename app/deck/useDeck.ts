"use client";

import { useContext } from "react";
import { DeckContext, type DeckApi } from "./DeckProvider";

export function useDeck(): DeckApi {
  const ctx = useContext(DeckContext);
  if (!ctx) throw new Error("useDeck must be used inside <DeckProvider>");
  return ctx;
}
