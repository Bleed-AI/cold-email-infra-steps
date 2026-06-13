# Cold-Email Walkthrough — v2 Redesign Spec

**Source:** Taha's detailed feedback on 2026-06-13 (with 4 annotated sketch images).
**Status:** ✅ SHIPPED 2026-06-13 — all criteria implemented, verified, and pushed to `main`.
This doc is now a historical record of the brief + acceptance criteria. (One open item: confirm
the ~27/inbox/day figure in Live-sending — see CLAUDE.md.)
**Goal:** Finalize the whole deck end-to-end, fix every issue below, then push to GitHub live.
**Hard rule:** No half-baked output. Every screen must be frame-audited (build phase) AND its
continuous loop phase verified before it's considered done.

---

## 0. The two biggest fundamentals (apply to EVERY screen)

### A. ONE-SHOT-THEN-LOOP — never an abrupt stop  *(CRITICAL)*
Right now each screen builds, then **abruptly freezes**. Wrong. Each screen must build its
structure once (left→right), then settle into a **continuous, graceful ambient LOOP** that never
stops — like Shahwaiz's *original* scroll screens (see `app/sections/Hero.tsx`,
`WarmupEngine.tsx`, `Delivery.tsx` for the seamless-loop feel; their canvas `repeat:-1` / rAF
loops ran forever). Decide per screen what keeps moving forever after the build:
- **Setup:** the purple redirect lines pulse/flow continuously (sub→primary). NOTHING else flows.
- **Warm-up:** emails keep bouncing inbox↔inbox + day/night keeps cycling.
- **List:** particles keep flowing along the connected pipeline.
- **AI copy:** the variable merge/flow gently loops.
- **Live sending:** emails keep streaming out + replies keep coming back.
- **Monitoring:** a smooth evergreen pulse/heartbeat.

**Engine impact:** the deck kind becomes `one-shot-then-loop` for all 6 step screens, and
`useDeckHandle`'s `startLoop` must run a REAL ambient loop (currently it's a no-op). The scrub
clock holds the build at its end-frame; a separate always-on ambient layer keeps looping while the
slide is active. Reconcile carefully (build = one-shot scrubbable; ambient = continuous rAF that
pauses when the slide is inactive, resumes when active).

### B. ON-SCREEN LABELS — not just the left rail  *(CRITICAL)*
As elements populate, **label them on the stage** with short labels pointing at what each part is
(in ADDITION to the left-rail heading+description). From the sketches: "Subdomains created from
primary domain name", "3 inboxes per domain", "SPF · DKIM · DMARC", "Redirecting to your site".
- Labels can be **text, numbers, AND animated** — e.g. an animated counter ("21 mailboxes",
  "Day 7/14", "Reputation 94/100") is itself a label. Mix text+number+motion so labels are part of
  the animation and look cool, not static stron text.
- **Looping elements get labels too** (e.g. the purple redirect loop → "redirecting to your site").
- Build a reusable on-screen annotation component (a small callout: short label + optional
  number/counter + a thin connector line to the element it describes).

### Other global principles
- **C. Kill the end-cards that stop the scene.** Replace summary cards that pop up and halt the
  animation (Setup summary panel, Warm-up "Trusted & ready" card, Sending "LIVE & STEADY" card)
  with proper **inline labels** + a continuing loop. A tiny "ready to launch / completed" badge is
  fine, but it must NOT freeze the scene.
- **D. Narration rail descriptions OPEN by default.** Each step's description should render
  **expanded** as the step appears — not collapsed behind a toggle the user has to click. (Keep a
  collapse affordance, but default = open.)
- **E. Network-animation aesthetic, not boxes.** Prefer connected, lively network/flow visuals
  (nodes, connectors, flowing particles, controlled sizes that stay on screen) over fixed
  rectangular boxes. Everything connected, labeled, using the available space, cool + clear.
- **F. Real logos/icons.** Use the **actual Gmail square icon** (the mail glyph), not a generic
  circle-"G", for mailboxes. Get the **real Zapmail logo from zapmail.ai** (current one is wrong).
- **G. Quality bar.** Audit every screen via the scrub hook `window.__lab.renderAt(t)` across
  build frames AND confirm the loop. Don't finish until the whole thing works end-to-end.

---

## 1. End-to-end + cleanup + ship
- **Make it work end-to-end:** enter company name (+ first/last) → all 6 steps build + loop
  gracefully → it just works. The deck (route `/`) is THE product.
- **Remove older/experimental screens:** delete the 4 `/lab` Setup directions
  (cinematic / webgl / network-as-variant / motion) and the `/lab` route; keep ONLY the finalized
  Network Setup. Remove now-unused R3F/three deps if nothing else uses them. Decide on `/screens`
  gallery: keep as an UNLINKED internal frame-audit aid (useful) — it is not part of the product.
- **Push to GitHub live after corrections:** repo is `github.com/Bleed-AI/cold-email-infra-steps`.
  Commit + push so it works end-to-end. Confirm the deploy target (Vercel?) and that the live build
  passes. (Verify the git remote + any Vercel hookup at execution time.)

---

## 2. Per-screen criteria (minimum bar — from the feedback + sketches)

### SETUP (Step 01)  — images #4, #5
- [ ] **Real Zapmail logo** from zapmail.ai (replace the wrong `public/logos/zapmail.png`).
- [ ] Left→right build: primary domain `acme.com` → fans out into **7 subdomains** named off the
      primary (joinacme.com, useacme.co, …). Label the fan-out: **"Subdomains created from your
      primary domain name."**
- [ ] **Green particles main→sub fire ONCE** during creation, then STOP. There is NO continuous
      data flow from primary to subdomains — the primary just creates them once.
- [ ] **Each subdomain shows its 3 ACTUAL mailboxes** as real **Gmail square icons** + full email
      names (e.g. `john@joinacme.com`, `john.doe@joinacme.com`, `john.d@joinacme.com`), placed
      neatly (there is space). NOT a circle-"G" + "3 inboxes" pill. Label: **"3 inboxes per domain."**
- [ ] Auth: a **green check** ticks onto each mailbox when SPF/DKIM/DMARC is done. Label:
      **"SPF · DKIM · DMARC"** pointing at the checks.
- [ ] **LOOP phase:** the **purple dotted redirect lines** (sub→primary) animate continuously =
      redirection to the main site. Label: **"redirecting to your site."** This is the ONLY
      continuous flow. No green main→sub loop.
- [ ] Replace the end summary panel with inline labels; keep the redirect loop running.

### WARM-UP (Step 02)
- [ ] **Remove the "Trusted & ready" card** that stops the scene. Use inline labels; keep the
      animation continuous (emails bounce inbox↔inbox forever).
- [ ] Use the **Gmail icon** (not circle-"G") on mailboxes — emails going back and forth.
- [ ] **Day/night cycle:** background transitions day↔night (sun/moon, shadow sweep) blended into
      the theme, back and forth, while a **counter climbs to 14 days**. Emails keep bouncing.
- [ ] After 14 days: a **"14 days completed · ready to launch"** badge appears — but the scene
      keeps a gentle loop (no dead stop).
- [ ] Animated labels: "Day N/14", "Reputation NN/100", "inbox-to-inbox warm-up".
- [ ] Reference Shahwaiz's original warm-up (`app/sections/WarmupEngine.tsx`) for the loop feel.

### LIST BUILDING (Step 03)  — image #8  *(called "one of the worst screens" — biggest redo)*
- [ ] Layout per the sketch: **Sources → Qualify → Enrich → Decision Makers → Emails**, all
      **connected** in a flowing network, everything visible at once, every stage labeled. Left
      rail = headings/descriptions; right = the connected flow.
- [ ] **NOT big rectangular boxes.** A cool, lively **network animation**: items flow stage→stage,
      connect, STAY on screen, controlled sizes + liveliness. Icons + examples line up and animate,
      blend in. Use the whole space.
- [ ] Sources show real logos (Apollo, Apify, LinkedIn, Google Maps, niche directories). Email
      stage shows the waterfall (Prospeo + 3 backups) producing **verified emails** as real
      Gmail/Outlook mailbox cards. Decision-makers as connected person nodes (2–3 per company).
- [ ] **LOOP phase:** ambient particle flow keeps moving along the connected pipeline.

### AI COPY (Step 04)  *(redo with REAL AI variables)*
- [ ] **STUDY the copy skill first:** `bleedai-campaign-master/.claude/commands/copy.md` +
      `variable-spec.md` + the Irish-recruiters example. Understand the **two variable types**:
      - **Data variables** (from data: `{{first_name}}`, `{{company}}`, counts, etc.)
      - **AI-personalization variables** (AI-generated: personalized opener, **subject line**,
        custom snippets like `{{agency_niche}}`, `{{case_study_line}}`).
      The copy MERGES both. Optionally **run the copy skill** in campaign-master to generate a
      genuinely good example (with subject line + AI variables) instead of the basic hardcoded copy.
- [ ] Show the process as a **network animation occupying the screen:** data variables created →
      AI variables created (morphed) → both **merged** → **applied** into the email copy → A/B/C
      variants + follow-ups. Show variables being created, morphed, merged, applied.
- [ ] The copy itself must be **genuinely good** cold-email quality (this is the core business).
- [ ] **LOOP phase:** ambient (variables gently pulsing / the merge flow looping).

### LIVE SENDING (Step 05)  — image #11
- [ ] **Fix the overlap:** the "~27/inbox/day" gauge + the "LIVE & STEADY" summary card overlap the
      bottom-right prospect card (Grace Lin). NO overlaps anywhere.
- [ ] **Drop the 7×3 grid of tiny inbox icons** — redo properly (not a grid; a nicer
      representation of the sending inboxes).
- [ ] KEEP (it's good): emails sent to prospect inboxes showing **"inbox" / "replied"** with names
      + titles — but make it proper.
- [ ] **LOOP phase:** continuous sending (emails streaming out, replies returning), looping.
- [ ] On-screen labels + animated counters. Reconfirm the "27/inbox/day" number with the user (it
      doesn't reconcile with the 500/day campaign cap from campaign-master; 27×21≈567).

### MONITORING (Step 06)
- [ ] **LOOP phase:** after the build, settle into a smooth evergreen loop (pulse / heartbeat).
- [ ] Add **domain monitoring** alongside "every mailbox monitored".
- [ ] **A/B testing detail:** show what's tested — **CTAs, subject lines, offer angles** (not just
      "copy variants").
- [ ] Improve overall; looping, labeled, no half-baked stop.

---

## 3. Engine / shared work needed
- [ ] **Loop phase support:** make `one-shot-then-loop` real. After the scrub build completes, a
      continuous ambient layer keeps animating while the slide is active; pauses when inactive;
      `useDeckHandle.startLoop/stopLoop` drive it (no longer no-ops). Replay re-runs the build.
- [ ] **NarrationRail:** descriptions open by default.
- [ ] **On-screen annotation component:** reusable callout (short label + optional animated number
      + thin connector to the target element). Used on every screen.
- [ ] **Mailbox icon:** real Gmail square glyph treatment (+ Outlook). Verify `public/logos/gmail.png`
      is the square Gmail mail icon; if it's the circle-G, source the proper square icon.
- [ ] **Zapmail logo:** fetch real asset from zapmail.ai → `public/logos/zapmail.png`.
- [ ] **Audit each screen's loop** (not just build frames) — confirm it loops seamlessly, no stop.

## 4. Assets to fetch
- Real **Zapmail** logo (zapmail.ai).
- Real **Gmail square** icon if current one is wrong.

## 5. Reference files
- Finalized screens: `app/screens/*Screen.tsx`, Setup at `app/lab/_variants/network/index.tsx`.
- Engine: `app/lab/engine/{useScrubClock,NarrationRail,MailboxCard,ProviderLogo}.tsx`.
- Deck: `app/deck/{slides.tsx,screenSlide.tsx,SlideFrame.tsx,DeckProvider.tsx}`.
- Original looping screens to study: `app/sections/{Hero,WarmupEngine,Delivery}.tsx`.
- Copy skill (study before AI-copy redo): `bleedai-campaign-master/.claude/commands/copy.md`.

## 6. Open decisions (assumed; correct me if wrong)
- Narration descriptions default-OPEN: assumed yes.
- Remove `/lab` + the 3 non-network variant files (+ R3F deps if unused): assumed yes; keep
  `/screens` as an unlinked dev audit route.
- GitHub: push to `main` of `Bleed-AI/cold-email-infra-steps`; confirm Vercel deploy at ship time.
