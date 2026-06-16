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
- **NEVER start the dev server with a detached shell** (`(npm run dev &)` / `npm run dev > log 2>&1 &`).
  That orphans the process — it keeps running (in resource-heavy dev mode) after the session is killed.
  Start long-running servers via the Bash tool's `run_in_background: true` (harness-managed; dies with
  the session), and **kill the dev server when the task is done** — don't leave it running.

## v2 REDESIGN — SHIPPED (2026-06-13)
The substantial v2 animation pass is **done and pushed to `main`**. Full brief +
acceptance criteria remain in `docs/redesign-v2-spec.md` (historical record). All
nine headlines landed:
1. **One-shot-then-loop** — real loop support in `useScrubClock` (`loop:true`): the clock
   keeps advancing `t` past `duration`; build segments (`seg`) hold, ambient elements loop via
   `phase()`/`sin`. Seamless verified by `renderAt(t)==renderAt(t+period)` (canvas-pixel hash).
   `useDeckHandle` `startLoop`/`seekEnd` resume the ambient loop on re-entry (no freeze, no rebuild).
2. **On-screen labels** — reusable `<Callout>` (`app/lab/engine/Callout.tsx`): label + animated
   number + leader. Used on every screen.
3. **Narration descriptions open by default** (`NarrationRail`).
4. Setup: real **Zapmail** SVG (`public/logos/zapmail.svg`) + inline **Gmail square** mark
   (`GmailMark` in `ProviderLogo`); 21 named mailboxes + auth checks; green fires once, only the
   **purple redirect lines loop**.
5. List building → connected **Sources→Qualify→Enrich→Decision-makers→Emails** network.
6. AI copy → **DATA vars (mint) + AI vars (violet)** visibly merged (grounded in the copy skill).
7. Live sending → grid dropped, overlaps gone, metered stream + replies loop.
8. Monitoring → loops (SMIL heartbeat + canvas packets); **domain monitoring** added; A/B over
   **subject lines · CTAs · offer angles**.
9. End-to-end verified + pushed to GitHub `main`.

**Perf rule baked into every screen:** stop pushing per-frame React state (`setDt`) once the build
completes (`pushedRef` gate) — ambient motion runs on canvas-rAF + CSS/SMIL, not React re-renders.

## v3 POLISH — SHIPPED (2026-06-16)
Built on v2; full brief in `docs/redesign-v3-spec.md` (historical). All verified live + `next build` clean:
1. **BleedAI red re-theme** — `accent` mint→**red** (`#ff5a4d` / `#ff8a7d` / `#d41a16`); **violet kept**
   as the cool secondary. Swept tokens (`tailwind.config.ts`, `globals.css`) + every canvas rgba literal
   across all screens (mechanical `124,245,208`→`255,90,77`, `164,255,225`→`255,150,135`, `#7cf5d0`→`#ff5a4d`).
   Monitoring keeps good-vs-bad legible: **healthy=red, dip=amber `#f59e0b`, rested=slate** (no red-on-red).
2. **Entry screen removed** — deck opens straight on Setup. `ClientContext` defaults to **Acme**; the
   company is editable **inline from the top nav** (`CompanyChip` in `TimelineNav` → `setClient` +
   `replay(activeId)`, propagates + replays). Index-shift refactor done: `DeckProvider` `unlocked:true`,
   `START`/`start()` removed, `DeckShell` number keys `go(n-1)`, `DeckControls` 1-based. `EntrySlide` deleted.
3. **Brand lockup** — `public/logos/bleedai.svg` (real, from bleedai.com) in the `NarrationRail` header →
   one edit, shows on all 6 screens, collision-free.
4. **AI-copy** regenerated to the real `/copy` bar (Emma/Brightwave, inferred-tension opener, no em-dashes,
   A/B/C + follow-ups) + new **AiComposeStation**: 3 scraped facts → AI **types** the line (the "writes from
   research" beat). Keys unchanged (DATA=red, AI=violet).
5. **List-building → vast network**: 12-source cloud (+28 more) → 6-tool enrich stack → **DM finder
   waterfall** (Prospeo→Surfe→MixRank→OpenMart) → **email waterfall** (Kitt→LeadMagic→Prospeo→Findymail→
   TryKit verify) → verified contacts. Grounded in `bleedai-campaign-master/knowledge-base/methods`.
6. **Resolved open item:** `PER_INBOX_PER_DAY` set to **24** (24×21≈504 ≈ the 500/day cap) in
   `app/screens/prospects.ts`. Confirm exact figure with Taha if he prefers a different number.

Seamless loop re-verified (canvas hash) on the rebuilt Copy + List-building screens; inline company-edit
propagation verified live.

## Conventions
- Match surrounding code: functional components, hooks, Tailwind classes, the existing tokens.
- Canvas = motion only (connectors/particles/glow); **DOM overlays = all readable text/labels/cards**
  (canvas text at small sizes looks bad — the user rejected that).
- "Construct, don't reveal": elements travel/build through space; a stagger-fade of a fixed layout
  is a fail.
- No half-baked output. Audit before declaring done.
