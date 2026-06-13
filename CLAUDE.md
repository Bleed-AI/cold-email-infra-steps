# CLAUDE.md — cold-email-infra-steps

Guidance for Claude Code working in this repo. (User-global rules live in `~/.claude/CLAUDE.md`.)

## What this is
A standalone **Next.js 14 (App Router) / React 18 / TypeScript / Tailwind 3** site: an animated,
client-facing **walkthrough of Bleed AI's cold-email process**. No backend, no env vars, no DB —
fully static, safe to share. Repo: `github.com/Bleed-AI/cold-email-infra-steps`.

Used two ways: (1) Taha shows specific steps live on a sales call (jump via the top timeline);
(2) a client self-navigates start→finish and understands cold email from zero.

## Architecture (the deck)
Route `/` = the product: a **slide DECK** (not scroll). Entry screen (company/domain + first/last
name) → 6 step screens. Persistent transform-stack: all slides mounted, offset `(i−active)*100%`;
framer-motion drives the vertical swipe + the `Expandable`; each step screen is driven by a
**scrub clock** (pure function of one time `t`).

- **Deck shell:** `app/deck/` — `DeckProvider` (state machine: activeIndex/phase/lifecycle/visited),
  `SlideFrame` (per-slide play/seek/replay lifecycle), `DeckShell`, `TimelineNav` (clickable +
  Step-0 "Edit details"), `DeckControls`, `slides.tsx` (the registry), `screenSlide.tsx`
  (`makeScreenSlide` adapts a screen into a deck slide + wires the handle).
- **Step screens:** `app/screens/*Screen.tsx` (Warmup/ListBuilding/Copy/Sending/Monitoring) and the
  Setup screen at `app/lab/_variants/network/index.tsx`.
- **Shared engine:** `app/lab/engine/` — `useScrubClock` (one clock → `window.__lab.renderAt(t)`
  audit hook + reduced-motion + deck integration via `useDeckHandle`), `NarrationRail`,
  `MailboxCard`, `ProviderLogo`. Types in `app/lab/types.ts` (`ScreenProps`).
- **Assets:** real vendor logos in `public/logos/*.png`. Tokens in `tailwind.config.ts` +
  `app/globals.css`: `ink-950/900`, `accent` #7cf5d0 (mint), `violet-glow` #7c5cff; classes
  `.chip .dot .glass .bg-grid .noise .hairline .text-gradient(.-accent) .glow-accent`.
- `/lab` (4 Setup design directions) and `/screens` (6-screen audit gallery) are dev/reference
  routes — slated for cleanup per the v2 spec.

## How to verify animations (IMPORTANT — you cannot watch motion directly)
The browser-automation tab runs backgrounded, which freezes `requestAnimationFrame`, so you can't
film a playing animation. Instead every screen is a **pure function of one clock**, exposing
`window.__lab.renderAt(t)`. Audit by: select the screen (in `/screens`), then
`window.__lab.renderAt(<t>)` + screenshot, sampling several `t` across the timeline. This audits
**composition** (layout/legibility/labels) — NOT live smoothness, which only the user can confirm
on a foreground browser. Always state that distinction honestly.

## Commands
- Dev: `npm run dev` (port 3000). Type-check: `npx tsc --noEmit`. Build: `npx next build`.
- After file changes, run `tsc` (must be exit 0) and, before shipping, `next build`.
- Node is at `C:\Program Files\nodejs` — prefix PowerShell with `$env:Path = "C:\Program Files\nodejs;$env:Path"`.
- Multiple dev servers sharing `.next` corrupt the cache → 404s. Keep ONE dev server; if thrashed,
  kill it, `rm -rf .next`, restart.

## Current priority — the v2 REDESIGN
The animations need a substantial v2 pass. **The full, authoritative brief is
`docs/redesign-v2-spec.md` — read it before doing any animation work.** Headlines:
1. **One-shot-then-loop:** screens must NOT abruptly stop; they build once, then loop gracefully.
2. **On-screen labels** (text + animated numbers) on every screen, plus left-rail descriptions.
3. **Narration descriptions open by default.**
4. Setup: real Zapmail logo, real Gmail square mailbox icons + names + checks, green flow once
   (loop only the purple redirect lines).
5. List building: redo as a connected Sources→Qualify→Enrich→Decision-makers→Emails network.
6. AI copy: real data + AI variables (study `bleedai-campaign-master/.claude/commands/copy.md`).
7. Live sending: fix overlaps, drop the inbox grid, loop it.
8. Monitoring: loop it; add domain monitoring; test CTAs/subjects/offer angles.
9. End-to-end + push to GitHub live.

## Conventions
- Match surrounding code: functional components, hooks, Tailwind classes, the existing tokens.
- Canvas = motion only (connectors/particles/glow); **DOM overlays = all readable text/labels/cards**
  (canvas text at small sizes looks bad — the user rejected that).
- "Construct, don't reveal": elements travel/build through space; a stagger-fade of a fixed layout
  is a fail.
- No half-baked output. Audit before declaring done.
