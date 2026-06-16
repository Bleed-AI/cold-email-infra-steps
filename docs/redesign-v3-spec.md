# Cold-Email Walkthrough — v3 Polish Spec

**Source:** Taha's feedback after reviewing the shipped v2 deck (2026-06-13).
**Status:** ✅ SHIPPED (2026-06-16). All sections done + verified live + `next build` clean. Two asks
added on execution and also done: (a) **entry screen removed** (deck opens on Setup, Acme default,
inline company chip in the nav); (b) **BleedAI brand lockup** on every screen (NarrationRail header).
Cadence open item resolved: `PER_INBOX_PER_DAY = 24`. See `CLAUDE.md` "v3 POLISH — SHIPPED" for the
landed summary. (Historical record below.)
**Decisions locked with the user (via question):**
- Palette → **Red primary + keep cool violet secondary** (option 2).
- AI copy → **Run the real `/copy` skill** in `bleedai-campaign-master` to generate the example.

---

## 0. Working rule (carry forward, already added to CLAUDE.md)
Never start the dev server detached (`(npm run dev &)`). It orphaned last time and ran in
resource-heavy dev mode after the session was killed. Use the Bash tool's `run_in_background: true`
(harness-managed → dies with the session) and **kill the server when the task ends**.

---

## 1. Re-theme to the BleedAI brand (warm / red)  *(every screen)*
The current mint `accent` reads "blue/cool" — the user wants the bleedai.com **reddish** brand.

**Verified palette from bleedai.com (live, 2026-06-13):**
- BG: `#050508` near-black (deck `ink-950` already matches).
- **Brand red:** `#B1130F` (deep) · `#D41A16` (mid) · `#FF5A4D` (bright coral, for glows/highlights).
- Dark panels `#1F1F30 / #141420 / #0B0B14`; slate text `#9099B8`; amber `#F59E0B` (minor only).

**Change:** `accent` (mint `#7cf5d0`) → **red**. Bright accent ≈ `#FF5A4D` (rgb 255,90,77), deep ≈
`#B1130F` (rgb 177,19,15), light packet/glow ≈ rgb 255,150,135. **KEEP `violet-glow` `#7c5cff`**
(rgb 124,92,255) as the cool secondary (AI vars / replies / redirect / domain-monitoring accent).

**Where (this is a wide but mechanical sweep):**
- Tokens: `tailwind.config.ts` (`accent`) + `app/globals.css` (`.text-gradient-accent`, `.glow-accent`,
  `.dot`, any `#7cf5d0` / `124,245,208`).
- Canvas literals across ALL screens + engine: replace `rgba(124,245,208,*)` (mint connectors/glow) and
  `rgba(164,255,225,*)` (bright mint packets) with the red equivalents. Leave `rgba(124,92,255,*)` /
  `rgba(167,143,255,*)` (violet) untouched.
- DOM: `text-accent`, `border-accent/*`, `bg-accent/*`, gauge gradients, health rings, checks,
  "LIVE" pulses → red. (Auth/verified checks become red — user did NOT keep green.)
- Per-screen warm tints: Warm-up day wash is already warm (fine); re-check each screen's radial
  background tint leans warm, not cyan.
**Verify:** red is legible on near-black; red+violet still distinguishable (they are — warm vs cool);
re-run the per-screen seamless-loop hash + composition screenshots after the swap.

## 2. AI-copy screen — top-tier copy + better AI-line viz  *(user: "very basic, hard-coded")*
- **Run the real `/copy` skill** in `bleedai-campaign-master` (its `/copy` command) to generate a
  genuinely psychological, out-of-the-box, *personalized* example (subject + body + the AI variables).
  Replace the current hardcoded Brightwave/Emma copy with the skill's output. Keep the DATA(red) +
  AI(violet) span coloring so the merge stays visible.
- **The AI-line-generation beat is under-captured.** Show the AI *writing* a personal line FROM the
  enrichment (scraped fact → AI composes the line): a small "generation" moment — e.g. enrichment
  chips feed an AI node that morphs/types out `{{timing_observation}}` etc. Make the
  "written-from-research" idea unmistakable, not just a static violet chip.

## 3. List-building — capture the VAST, complex network  *(user: "looks pretty simple")*
The differentiator is breadth. Today it shows 4 sources + 1 enrich hub + a thin email step. Expand:
- **Sources:** many more real tools, not 4. Show a dense source cloud → funnel: Apollo, Apify,
  LinkedIn Sales Nav, Google Maps, Clay, Serper, OpenWebNinja, niche directories, + more.
- **Decision-makers via MULTIPLE methods:** the user named **Surfe** and **MixRank** (+ others in
  Campaign Manager). Show DM-finding as a multi-method sub-network, not one step.
- **Emails via MULTIPLE providers (the waterfall):** show the real verification waterfall trying
  providers in sequence — **Kitt → LeadMagic → Prospeo → Findymail → TryKit** (etc.) — not just
  "Prospeo + 3 backups". Convey "tries many, returns verified."
- **RESEARCH FIRST:** read `bleedai-campaign-master/knowledge-base/methods/enrichments.md` (+ related)
  for the real, complete tool lists per stage before building. Source/add missing logos (Surfe,
  MixRank, Kitt, OpenMart, StoreLeads…) into `public/logos/` or render named generic chips.
- Keep it clean, labeled, looping — dense but not cluttered. The whole thing should read "vast network."

## 4. General "where can we do better" pass
With fresh (red) eyes, re-audit all 6 screens for polish, overlaps, legibility, and loop quality.
No half-baked output. Then `tsc` + `next build`, end-to-end deck check (incl. re-entry loop), and
push to `main` (production) when the user approves.

---

## Reference files
- Tokens: `tailwind.config.ts`, `app/globals.css`.
- Screens: `app/screens/*Screen.tsx`, Setup at `app/lab/_variants/network/index.tsx`.
- Engine: `app/lab/engine/{useScrubClock,Callout,NarrationRail,MailboxCard,ProviderLogo}.tsx`.
- Copy skill + methods: `bleedai-campaign-master/.claude/commands/copy.md`,
  `bleedai-campaign-master/knowledge-base/methods/enrichments.md`.
- Audit method (unchanged): `window.__lab.renderAt(t)` + screenshot; canvas-pixel hash for seamless loop.
