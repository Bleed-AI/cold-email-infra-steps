import type { Metadata } from "next";
import Link from "next/link";

/**
 * /verify: "How we find and verify every email". A static, client-safe proof
 * page that follow-up emails can link to. Server component, no client JS.
 *
 * Content rules (do not break when editing):
 * - No vendor or tool names, no per-lead or per-1,000 costs, no internal ids.
 * - The only numbers allowed are the two in STATS / PROMISE below.
 * - No em dashes or en dashes anywhere.
 *
 * The root layout locks body scroll for the deck, so this page scrolls inside
 * its own full-height <main>.
 */

export const metadata: Metadata = {
  title: "How We Find and Verify Every Email | Bleed AI",
  description:
    "How Bleed AI finds the real decision maker at each company, finds their work email, and checks every address before a single email is sent.",
};

type Step = { title: string; body: string };

const STEPS: Step[] = [
  {
    title: "We find the real decision maker",
    body: "We start from the company, not from a list of names. At each one we look for the person who actually owns the problem you solve, usually the founder or the head of that team, in an order we agree with you. If we cannot confirm anyone at a company, it goes on a short list for a second look instead of quietly disappearing.",
  },
  {
    title: "We find their work email from several sources",
    body: "We check several independent data sources, one after another, in a set order. As soon as one gives us a real answer we stop. If one source does not have the person, the next one picks it up, so a single gap never ends the search.",
  },
  {
    title: "Every address is checked before it is ever sent to",
    body: "An address we found is not an address we send to. Each one goes through a verification check that asks the receiving mail server whether that mailbox is real. Shared inboxes like info@ never skip this step, even when the domain looks healthy.",
  },
  {
    title: "Risky catch-all addresses get a second, independent check",
    body: "Some companies accept mail for any address, so one check cannot tell a real inbox from a dead one. Those addresses go to a second verifier that works independently of the first. If it does not confirm the mailbox, the address does not go out.",
  },
  {
    title: "Nothing unverified ships",
    body: "If an address cannot be confirmed, it is dropped. We would rather send to fewer people than risk a bounce. Work addresses, personal addresses and shared inboxes are also kept apart, so every email reads right for the person who gets it.",
  },
  {
    title: "Sending runs on separate, warmed domains",
    body: "We never send from your main domain. Campaigns go out from separate domains and inboxes that we set up and warm up first, so your main domain, and the email your team uses every day, is never at risk.",
  },
];

const STATS = [
  {
    figure: "2.22%",
    label: "Bounce rate across 2,163 real sends",
  },
  {
    figure: "Under 3%",
    label: "The bounce rate we hold every list to",
  },
];

const PROMISE =
  "We keep bounces under 3%, and if a list ever misses that we rebuild it at our cost.";

function Check() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 13l4 4L19 7"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ArrowLeft() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M19 12H5M11 5l-7 7 7 7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function VerifyPage() {
  return (
    <main className="relative h-[100dvh] overflow-y-auto bg-ink-950 text-white">
      {/* Backdrop: the deck's grid + warm radial, fixed behind the content. */}
      <div aria-hidden className="pointer-events-none fixed inset-0 bg-grid opacity-60 [mask-image:radial-gradient(ellipse_at_top,black_20%,transparent_70%)]" />
      <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 h-[520px] bg-radial-fade" />
      <div aria-hidden className="noise" />

      <div className="relative mx-auto max-w-[880px] px-4 sm:px-6 pt-8 pb-24">
        <header className="flex items-center justify-between gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logos/bleedai.svg" alt="Bleed AI" className="h-[18px] w-auto opacity-95" />
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full glass px-4 py-2 text-[11px] font-mono uppercase tracking-[0.14em] text-white/70 hover:text-accent transition-colors"
          >
            <ArrowLeft />
            The walkthrough
          </Link>
        </header>

        <section className="pt-16 md:pt-24">
          <div className="chip">
            <span className="dot" />
            Data quality
          </div>
          <h1 className="mt-6 font-display text-[36px] md:text-[56px] leading-[1.02] tracking-[-0.02em] text-gradient">
            How we find and verify every email
          </h1>
          <p className="mt-6 max-w-[640px] text-[16px] md:text-[18px] leading-relaxed text-white/65">
            A cold email only works if it reaches a real person who can say yes.
            Here is how we make sure every address on your list belongs to the
            right person, and that it is safe to send to, before a single email
            goes out.
          </p>
        </section>

        <section aria-label="Results" className="mt-12 grid gap-4 sm:grid-cols-2">
          {STATS.map((s) => (
            <div key={s.figure} className="glass rounded-2xl px-6 py-6">
              <div className="font-display text-[40px] md:text-[48px] leading-none tracking-[-0.02em] text-gradient-accent">
                {s.figure}
              </div>
              <div className="mt-3 text-[13px] font-mono uppercase tracking-[0.12em] text-white/55">
                {s.label}
              </div>
            </div>
          ))}
        </section>

        <section aria-label="The process" className="mt-20">
          <div className="kicker">The process</div>
          <h2 className="mt-3 font-display text-[26px] md:text-[34px] leading-[1.05] tracking-[-0.02em]">
            Six steps between a company and your first email
          </h2>

          <ol className="mt-10 relative">
            {/* Vertical connector, like the deck's flow lines. */}
            <span aria-hidden className="absolute left-[19px] top-2 bottom-2 w-px bg-gradient-to-b from-accent/60 via-accent/25 to-violet-glow/40" />
            {STEPS.map((step, i) => (
              <li key={step.title} className="relative pl-16 pb-10 last:pb-0">
                <span className="absolute left-0 top-0 inline-flex h-10 w-10 items-center justify-center rounded-full border border-accent/40 bg-ink-900 font-mono text-[12px] text-accent glow-accent">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="pt-1.5 font-display text-[19px] md:text-[22px] leading-snug tracking-[-0.01em] text-white">
                  {step.title}
                </h3>
                <p className="mt-2 max-w-[640px] text-[15px] leading-relaxed text-white/60">
                  {step.body}
                </p>
              </li>
            ))}
          </ol>
        </section>

        <section aria-label="Our promise" className="mt-20 glass rounded-2xl px-6 py-8 md:px-10 md:py-10 border border-accent/25">
          <div className="flex items-center gap-2 text-accent">
            <Check />
            <span className="text-[11px] font-mono uppercase tracking-[0.2em]">Our promise</span>
          </div>
          <p className="mt-4 font-display text-[22px] md:text-[28px] leading-[1.2] tracking-[-0.01em] text-white">
            {PROMISE}
          </p>
          <p className="mt-4 max-w-[640px] text-[15px] leading-relaxed text-white/60">
            Low bounces protect your sending reputation, which is what keeps
            your emails landing in the inbox instead of spam. So we hold every
            list to that line, and we back it ourselves.
          </p>
        </section>

        <footer className="mt-16 flex flex-wrap items-center justify-between gap-4 hairline rounded-2xl px-6 py-5">
          <p className="text-[14px] text-white/60">
            Want to see the rest of the process, from setup to sending?
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-accent text-ink-950 font-mono text-xs uppercase tracking-[0.18em] hover:bg-accent/90 transition"
          >
            See the full walkthrough
          </Link>
        </footer>
      </div>
    </main>
  );
}
