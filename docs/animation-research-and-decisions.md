# Animation Research & Decisions

*Cold-email infrastructure walkthrough — what tools we use, what we skip, and why.*
*Last updated: 2026-06-12. Based on two deep, fact-checked research passes (sources at the bottom).*

---

## TL;DR — the decision in one box

- ✅ **KEEP the animation tools Shahwaiz chose.** They are the professional, industry-standard choice for this kind of scroll-driven website. Nothing better exists to switch to.
- ❌ **We are NOT adding the heavy 3D libraries** (Three.js, React Three Fiber, OGL, etc.) **to this walkthrough.** They are optional "wow" extras, not requirements. The walkthrough doesn't need them.
- ✅ **We applied a small performance tune-up** so the existing animations run lighter on the laptop (no visual change).
- ℹ️ **The fancy WebGL / cursor-effect research was for the *separate* BleedAI main website**, not this walkthrough. Kept here only as a future playbook.

---

## 1. What we're KEEPING (and why it's the right call)

These are the tools already in the project. They stay.

| Tool | Plain-English job | Why we keep it |
|---|---|---|
| **GSAP + ScrollTrigger** | The engine that plays animations as you scroll, and "pins" each section in place while its animation runs | This is *the* gold-standard for scroll-driven storytelling — the same approach award-winning sites use. It does exactly what this walkthrough needs. |
| **Lenis** | Makes scrolling feel smooth/buttery | The lightest, best-behaved smooth-scroll option (under 4kb). Correctly wired into GSAP. |
| **Framer Motion** ("Motion") | Small UI transitions | Already used, actively maintained, fine to keep. |
| **Canvas 2D** | The animated particle/network visuals (e.g. the email-flow graphic) | The efficient way to draw lots of moving dots — better than hundreds of HTML elements. |

**Bonus fact:** GSAP became **100% free** in 2025 (including its premium plugins) after Webflow bought it. So we even get its best tools — like clean per-letter text reveals — at no cost. That makes the "keep it" decision even stronger.

---

## 2. What we're NOT using (and why that's completely fine)

The research listed a lot of other libraries. Here's the honest verdict: **they're optional upgrades, not things you're missing.** Skipping them for this walkthrough is the correct, low-risk choice.

| Tool | What it's for | Our decision |
|---|---|---|
| **Three.js** | Full 3D scenes in the browser | ❌ Skip — overkill for a walkthrough; heavy to load |
| **React Three Fiber + drei** | Three.js, done the React way | ❌ Skip — only needed if we add real 3D |
| **OGL** | A lightweight way to do one custom 3D/shader effect | ❌ Skip for now — a possible *future* "wow" moment, not needed |
| **Theatre.js** | A visual editor for hand-tuning 3D motion | ❌ Skip — only useful if we go 3D |
| **Rive** | Interactive vector animations | ❌ Skip — not needed here |
| **Lottie** | After-Effects animations as small files | ❌ Skip — not needed here |
| **Spline** | No-code 3D you embed | ❌ Skip — not needed here |
| **Native CSS scroll animations** | A new browser feature for simple scroll effects | ❌ Skip — not supported in all browsers yet (off by default in Firefox) |

**Why skipping them is smart, not lazy:** every extra 3D library adds weight that can make the page slower to load and the laptop work harder. The walkthrough already looks great with the lighter tools. We only reach for the heavy stuff if a specific moment truly demands it — and right now, none does.

---

## 3. The performance tune-up we applied

While reading the code, we found the animated backgrounds kept running even when scrolled off-screen, and rendered at unnecessarily high pixel density. We fixed that (you approved it):

- **Pause off-screen:** the 4 canvas backgrounds now run *only* while visible.
- **Clamp pixel density:** capped so high-resolution screens don't render 9–16× the needed pixels.
- **Respect "reduced motion":** the backgrounds + cursor glow go static if a user's device asks for less motion.

**Result:** identical look, noticeably lighter on the machine. (Changes are in the working folder, not yet committed — easy to undo.)

---

## 4. Future playbook — BleedAI main website (separate project)

This part is **not for the walkthrough.** It's for the *other* site (bleedai.com) and only matters if/when you build a fancy cursor-reactive hero there.

- **Default to lightweight:** a custom cursor + magnetic buttons + one cursor-reactive gradient gets ~90% of the "high-end" feel cheaply.
- **Only go full WebGL** (e.g. a fluid/shader background) for a single signature moment, and always load a fast static image first, then switch the effect on.
- **Studios worth studying:** Lusion, basement.studio, Unseen Studio.

---

## Sources (the research was fact-checked against these)

- GSAP is now free: https://gsap.com/blog/3-13/ · https://webflow.com/blog/gsap-becomes-free
- ScrollTrigger (pinning/scrubbing): https://gsap.com/docs/v3/Plugins/ScrollTrigger/
- Lenis smooth scroll: https://www.lenis.dev/
- Native CSS scroll animations (browser support): https://caniuse.com/mdn-css_properties_animation-timeline_scroll
- Animation performance rules (Google): https://web.dev/articles/animations-overview
- Performance tier list: https://motion.dev/magazine/web-animation-performance-tier-list
- Lightweight 3D (OGL): https://github.com/oframe/ogl
- Studios: https://lusion.co/ · https://www.awwwards.com/websites/webgl/
