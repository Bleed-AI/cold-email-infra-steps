import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { parsePayload, parsePrefill, type MarketExample, type MarketPayload } from "../lib/prefill";

/**
 * /reach: "How we would find and reach YOUR buyers". The personalized twin of
 * /verify, driven by one per-lead link:
 *   /reach?company=Acme&domain=acme.com&first=Sam&p=<base64url JSON>
 * `p` is built by bleedai-campaign-master scripts/payloads/lead-market.cjs and
 * parsed (untrusted) by app/lib/prefill.ts parsePayload. No payload, or a bad
 * one, redirects to /verify, so /verify itself is untouched.
 *
 * Content rules (same as /verify, do not break when editing):
 * - No vendor or tool names, no costs, no internal ids.
 * - Our own numbers are only the two /verify carries (2.22% across 2,163 real
 *   sends; under 3%, or we rebuild at our cost). Every other number comes from
 *   the payload and is shown exactly as sent, never rounded or extrapolated.
 * - A count is labelled for what it is: a ceiling from a database, companies
 *   already found, or a people-index count. Never "your list".
 * - Example companies show what we can already see (the decision maker title).
 *   The email and verification stages are drawn as what happens when the list
 *   is built, never as done.
 * - No em dashes or en dashes anywhere.
 */

export const metadata: Metadata = {
  title: "How We Would Reach Your Buyers | Bleed AI",
  description:
    "Your market, the decision makers we would reach in it, and how every work email is found and verified before anything is sent.",
  robots: { index: false, follow: false },
};

type SearchParams = Record<string, string | string[] | undefined>;

function toQuery(sp: SearchParams): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (typeof v === "string") q.set(k, v);
    else if (Array.isArray(v) && v[0] != null) q.set(k, v[0]);
  }
  return q.toString();
}

const fmt = (n: number) => n.toLocaleString("en-US");
const ORDINAL = ["First choice", "Second choice", "Third choice", "Fourth choice"];
const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s);

function possessive(company: string): string {
  return /s$/i.test(company) ? `${company}'` : `${company}'s`;
}

function countCopy(p: MarketPayload): { label: string; note: string } {
  const label = p.countLabel ?? "companies that match your buyer profile";
  if (p.countKind === "sheet")
    return {
      label,
      note: "These are companies we already found for you, not an estimate. Each one is a real account we can reach.",
    };
  if (p.countKind === "index")
    return {
      label,
      note: "This is the ceiling: everyone in the data who matches this segment. Each one is checked before it reaches a list.",
    };
  return {
    label,
    note: "This is the ceiling: every company in our database with your buyer's industry, size and location. Each one is qualified against your offer before it reaches a list, so the list we build is a slice of this.",
  };
}

const LADDER = ["Source 1", "Source 2", "Source 3", "Source 4"];

/* ---------------------------------- icons --------------------------------- */

function Check({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ArrowLeft() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M19 12H5M11 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ------------------------------ hero network ------------------------------ */

/**
 * Desktop network: their market fans out to their titles, the titles feed the
 * email waterfall, the waterfall feeds verification, and verification feeds
 * the first email. SVG + SMIL only (no client JS); packets loop forever.
 * Hidden below md, where the step list below carries the same story.
 */
function Network({ p, company }: { p: MarketPayload; company: string }) {
  const titles = p.titles.length ? p.titles : ["Founder or CEO"];
  const tY = (i: number) => 180 + (i - (titles.length - 1) / 2) * 62;
  const ladderY = (i: number) => 96 + i * 46;
  const countText = p.count != null ? fmt(p.count) : String(p.examples.length);
  const countSize = countText.length > 7 ? 26 : countText.length > 5 ? 32 : 38;
  const paths: { id: string; d: string; delay: number }[] = [];
  titles.forEach((_, i) => {
    paths.push({ id: `a${i}`, d: `M 168 180 C 230 180, 230 ${tY(i)}, 290 ${tY(i)}`, delay: i * 0.45 });
    paths.push({ id: `b${i}`, d: `M 520 ${tY(i)} C 570 ${tY(i)}, 570 ${ladderY(0) + 16}, 612 ${ladderY(0) + 16}`, delay: 0.9 + i * 0.45 });
  });
  paths.push({ id: "c0", d: `M 780 180 L 826 180`, delay: 2.2 });
  paths.push({ id: "d0", d: `M 900 180 L 944 180`, delay: 2.8 });

  return (
    <div className="glass rounded-3xl px-2 py-4 overflow-hidden">
      <svg viewBox="0 0 1000 360" className="w-full h-auto" role="img" aria-label={`How ${company}'s buyers move from market to first email`}>
        <defs>
          <radialGradient id="rg-core" cx="50%" cy="40%" r="70%">
            <stop offset="0%" stopColor="#ff8a7d" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#ff5a4d" stopOpacity="0.04" />
          </radialGradient>
          <linearGradient id="lg-line" x1="0" x2="1">
            <stop offset="0%" stopColor="#ff5a4d" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#7c5cff" stopOpacity="0.55" />
          </linearGradient>
        </defs>

        {/* column labels */}
        {[
          [90, "YOUR MARKET"],
          [405, "WHO WE REACH"],
          [692, "WORK EMAIL"],
          [863, "VERIFIED"],
          [960, "SENT"],
        ].map(([x, t]) => (
          <text key={t as string} x={x as number} y={28} textAnchor="middle" fontFamily="ui-monospace, Menlo, monospace" fontSize="11" letterSpacing="2" fill="rgba(255,255,255,0.45)">
            {t}
          </text>
        ))}

        {/* connectors + looping packets */}
        {paths.map((pa) => (
          <g key={pa.id}>
            <path id={`p-${pa.id}`} d={pa.d} stroke="url(#lg-line)" strokeWidth="1.4" fill="none" strokeDasharray="4 5" opacity="0.8" />
            <circle r="3.2" fill="#ff8a7d">
              <animateMotion dur="2.6s" begin={`${pa.delay}s`} repeatCount="indefinite" rotate="auto">
                <mpath href={`#p-${pa.id}`} />
              </animateMotion>
            </circle>
          </g>
        ))}

        {/* market node */}
        <circle cx="90" cy="180" r="78" fill="url(#rg-core)" stroke="rgba(255,90,77,0.55)" strokeWidth="1.5" />
        <circle cx="90" cy="180" r="78" fill="none" stroke="rgba(255,90,77,0.35)" strokeWidth="1">
          <animate attributeName="r" values="78;92;78" dur="4s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.6;0;0.6" dur="4s" repeatCount="indefinite" />
        </circle>
        <text x="90" y="182" textAnchor="middle" fontFamily="var(--font-display), system-ui" fontWeight="600" fontSize={countSize} fill="#fff">
          {countText}
        </text>
        <text x="90" y="206" textAnchor="middle" fontFamily="ui-monospace, Menlo, monospace" fontSize="10.5" letterSpacing="1.5" fill="rgba(255,255,255,0.55)">
          {p.count != null ? (p.countKind === "index" ? "PEOPLE" : "COMPANIES") : "NAMED"}
        </text>

        {/* title pills */}
        {titles.map((t, i) => (
          <g key={t}>
            <rect x="290" y={tY(i) - 19} width="230" height="38" rx="19" fill="#0f1218" stroke={i === 0 ? "rgba(255,90,77,0.6)" : "rgba(255,255,255,0.14)"} />
            <text x="312" y={tY(i) + 4.5} fontFamily="ui-monospace, Menlo, monospace" fontSize="10" fill="#ff8a7d">
              {i + 1}
            </text>
            <text x="328" y={tY(i) + 5} fontFamily="var(--font-sans), system-ui" fontSize="13.5" fill="rgba(255,255,255,0.88)">
              {clip(t, 27)}
            </text>
          </g>
        ))}

        {/* email waterfall ladder */}
        <rect x="604" y="74" width="176" height="212" rx="18" fill="rgba(255,255,255,0.02)" stroke="rgba(255,255,255,0.10)" />
        {LADDER.map((s, i) => (
          <g key={s}>
            <rect x="620" y={ladderY(i)} width="144" height="32" rx="9" fill="#0f1218" stroke={i === 0 ? "rgba(255,90,77,0.55)" : "rgba(124,92,255,0.35)"} />
            <text x="638" y={ladderY(i) + 20.5} fontFamily="ui-monospace, Menlo, monospace" fontSize="11.5" fill="rgba(255,255,255,0.8)">
              {s}
            </text>
            <circle cx="748" cy={ladderY(i) + 16} r="4" fill={i === 0 ? "#ff5a4d" : "#7c5cff"} opacity="0.85">
              <animate attributeName="opacity" values="0.25;1;0.25" dur="2.4s" begin={`${i * 0.6}s`} repeatCount="indefinite" />
            </circle>
            {i < LADDER.length - 1 && <path d={`M 692 ${ladderY(i) + 32} L 692 ${ladderY(i + 1)}`} stroke="rgba(124,92,255,0.5)" strokeWidth="1.2" />}
          </g>
        ))}
        <text x="692" y="300" textAnchor="middle" fontFamily="ui-monospace, Menlo, monospace" fontSize="10" fill="rgba(255,255,255,0.4)">
          NO ANSWER? NEXT SOURCE
        </text>

        {/* verification shield */}
        <g transform="translate(863 180)">
          <path d="M 0 -40 L 34 -26 L 34 6 C 34 26 18 38 0 46 C -18 38 -34 26 -34 6 L -34 -26 Z" fill="#0f1218" stroke="rgba(255,90,77,0.6)" strokeWidth="1.5" />
          <path d="M -12 2 L -3 11 L 14 -8" stroke="#ff5a4d" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <text x="0" y="70" textAnchor="middle" fontFamily="ui-monospace, Menlo, monospace" fontSize="10" fill="rgba(255,255,255,0.45)">
            2 CHECKS
          </text>
        </g>

        {/* first email */}
        <g transform="translate(960 180)">
          <rect x="-20" y="-15" width="40" height="30" rx="5" fill="#0f1218" stroke="rgba(255,255,255,0.35)" />
          <path d="M -20 -13 L 0 3 L 20 -13" stroke="rgba(255,255,255,0.55)" fill="none" />
        </g>
      </svg>
    </div>
  );
}

/* ------------------------------- example lane ------------------------------ */

const STAGES = ["Email found", "Verified", "Catch-all check", "Ready to send"];

function Lane({ ex, index }: { ex: MarketExample; index: number }) {
  const known = ex.title ? { kicker: "Decision maker we can see", value: ex.title } : ex.hiring ? { kicker: "Hiring right now", value: ex.hiring } : null;
  return (
    <li className="relative glass rounded-2xl p-4 md:p-5">
      <div className="grid gap-4 md:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)_minmax(0,1.5fr)] md:items-center">
        {/* company */}
        <div className="min-w-0">
          <div className="font-display text-[17px] md:text-[18px] leading-snug text-white break-words">{ex.name}</div>
          {ex.place && <div className="mt-1 text-[13px] text-white/50">{ex.place}</div>}
        </div>
        {/* who */}
        <div className="min-w-0">
          {known ? (
            <div className="inline-flex max-w-full items-start gap-2 rounded-xl border border-accent/35 bg-accent/[0.06] px-3 py-2">
              <span className="mt-[3px] text-accent shrink-0">
                <Check size={12} />
              </span>
              <span className="min-w-0">
                <span className="block text-[10px] font-mono uppercase tracking-[0.14em] text-accent/80">{known.kicker}</span>
                <span className="block text-[14px] leading-snug text-white/90 break-words">{known.value}</span>
              </span>
            </div>
          ) : (
            <span className="text-[13px] text-white/40">Decision maker found when we build the list</span>
          )}
        </div>
        {/* waterfall stages, still to come */}
        <ol className="relative grid grid-cols-4 gap-1" aria-label="What happens next for this company">
          <span aria-hidden className="absolute left-[12.5%] right-[12.5%] top-[9px] h-px bg-gradient-to-r from-accent/50 via-violet-glow/40 to-white/20" />
          <span aria-hidden className="reach-packet" style={{ animationDelay: `${index * 0.7}s` }} />
          {STAGES.map((s, i) => (
            <li key={s} className="relative flex flex-col items-center text-center">
              <span
                className={`relative z-[1] h-[18px] w-[18px] rounded-full border bg-ink-900 ${
                  i === STAGES.length - 1 ? "border-accent/60" : "border-white/25"
                } border-dashed`}
              />
              <span className="mt-2 text-[10.5px] md:text-[11px] leading-tight text-white/55">{s}</span>
            </li>
          ))}
        </ol>
      </div>
    </li>
  );
}

/* ---------------------------------- page ---------------------------------- */

export default function ReachPage({ searchParams }: { searchParams: SearchParams }) {
  const query = toQuery(searchParams);
  const payload = parsePayload(query);
  if (!payload) redirect("/verify");
  const pre = parsePrefill(query);
  const company = pre?.company ?? "your company";
  const first = pre?.first;
  const p = payload;
  const cc = p.count != null ? countCopy(p) : null;
  const deckHref = pre?.company || pre?.domain ? `/?${new URLSearchParams({ ...(pre?.company ? { company: pre.company } : {}), ...(pre?.domain ? { domain: pre.domain } : {}), ...(first ? { first } : {}), go: "1" }).toString()}` : "/";

  const steps: { title: string; body: React.ReactNode }[] = [
    {
      title: cc ? "Your market, counted" : "Your market",
      body: cc ? (
        <>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="font-display text-[44px] md:text-[56px] leading-none tracking-[-0.02em] text-gradient-accent">{fmt(p.count!)}</span>
            <span className="text-[15px] text-white/75">{cc.label}</span>
          </div>
          {p.buyer && (
            <p className="mt-4 text-[15px] leading-relaxed text-white/70">
              <span className="text-white/45">Your buyer, as we read it from your site: </span>
              {p.buyer}
            </p>
          )}
          <p className="mt-3 max-w-[640px] text-[14px] leading-relaxed text-white/50">{cc.note}</p>
        </>
      ) : (
        <p className="text-[15px] leading-relaxed text-white/60">
          {p.buyer ? `Your buyer, as we read it from your site: ${p.buyer}. ` : ""}We start from the companies, not from a list of names.
        </p>
      ),
    },
    {
      title: "We find the real decision maker, in your order",
      body: (
        <>
          <p className="max-w-[640px] text-[15px] leading-relaxed text-white/60">
            At each company we look for the person who owns the problem you solve, in an order we agree with you. If the first title does not exist there, we go to the next, and at a small company that is usually the founder or CEO.
          </p>
          {p.titles.length > 0 && (
            <ol className="mt-5 flex flex-wrap gap-2.5">
              {p.titles.map((t, i) => (
                <li key={t} className={`rounded-xl border px-3.5 py-2 ${i === 0 ? "border-accent/50 bg-accent/[0.07]" : "border-white/12 bg-white/[0.03]"}`}>
                  <span className="block text-[10px] font-mono uppercase tracking-[0.14em] text-white/45">{ORDINAL[i]}</span>
                  <span className="block text-[15px] text-white/90">{t}</span>
                </li>
              ))}
            </ol>
          )}
        </>
      ),
    },
    {
      title: "We find their work email from several sources",
      body: (
        <>
          <p className="max-w-[640px] text-[15px] leading-relaxed text-white/60">
            Independent data sources, one after another, in a set order. As soon as one gives a real answer we stop. If one source does not have the person, the next picks it up, so a single gap never ends the search.
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-2 font-mono text-[11px] uppercase tracking-[0.12em]">
            {LADDER.map((s, i) => (
              <span key={s} className="inline-flex items-center gap-2">
                <span className={`rounded-lg border px-2.5 py-1.5 ${i === 0 ? "border-accent/50 text-accent" : "border-violet-glow/40 text-white/70"}`}>{s}</span>
                {i < LADDER.length - 1 && <span className="text-white/30">then</span>}
              </span>
            ))}
          </div>
        </>
      ),
    },
    {
      title: "Every address is checked before it is ever sent to",
      body: (
        <p className="max-w-[640px] text-[15px] leading-relaxed text-white/60">
          An address we found is not an address we send to. Each one is checked with the receiving mail server to confirm the mailbox is real. Shared inboxes like info@ never skip this step.
        </p>
      ),
    },
    {
      title: "Risky catch-all addresses get a second, independent check",
      body: (
        <p className="max-w-[640px] text-[15px] leading-relaxed text-white/60">
          Some companies accept mail for any address, so one check cannot tell a real inbox from a dead one. Those go to a second verifier that works independently of the first. If it does not confirm the mailbox, the address does not go out.
        </p>
      ),
    },
    {
      title: "Sending runs on separate, warmed domains",
      body: (
        <p className="max-w-[640px] text-[15px] leading-relaxed text-white/60">
          Nothing unverified ships, and nothing goes out from {possessive(company)} main domain. Campaigns run from separate domains and inboxes we set up and warm up first, so the email your team uses every day is never at risk.
        </p>
      ),
    },
  ];

  return (
    <main className="relative h-[100dvh] overflow-y-auto bg-ink-950 text-white">
      <style>{`
        .reach-packet { position: absolute; top: 6px; left: 12.5%; width: 7px; height: 7px; border-radius: 999px; background: #ff8a7d; box-shadow: 0 0 10px #ff5a4d; animation: reach-run 3.6s ease-in-out infinite; }
        @keyframes reach-run { 0% { left: 12.5%; opacity: 0; } 10% { opacity: 1; } 85% { opacity: 1; } 100% { left: calc(87.5% - 7px); opacity: 0; } }
        @media (prefers-reduced-motion: reduce) { .reach-packet { animation: none; display: none; } }
      `}</style>
      <div aria-hidden className="pointer-events-none fixed inset-0 bg-grid opacity-60 [mask-image:radial-gradient(ellipse_at_top,black_20%,transparent_70%)]" />
      <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 h-[520px] bg-radial-fade" />
      <div aria-hidden className="noise" />

      <div className="relative mx-auto max-w-[1000px] px-4 sm:px-6 pt-8 pb-24">
        <header className="flex items-center justify-between gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logos/bleedai.svg" alt="Bleed AI" className="h-[18px] w-auto opacity-95" />
          <Link
            href={deckHref}
            className="inline-flex items-center gap-2 rounded-full glass px-4 py-2 text-[11px] font-mono uppercase tracking-[0.14em] text-white/70 hover:text-accent transition-colors"
          >
            <ArrowLeft />
            The walkthrough
          </Link>
        </header>

        <section className="pt-14 md:pt-20">
          <div className="chip">
            <span className="dot" />
            Prepared for {company}
          </div>
          <h1 className="mt-6 max-w-[860px] font-display text-[34px] md:text-[54px] leading-[1.04] tracking-[-0.02em] text-gradient">
            How we would find and reach {possessive(company)} buyers
          </h1>
          <p className="mt-6 max-w-[660px] text-[16px] md:text-[18px] leading-relaxed text-white/65">
            {first ? `${first}, here` : "Here"} is the path a company in your market takes with us, from the moment we find it to the first email it gets from you. The numbers and names below are from your market, not a template.
          </p>
        </section>

        <section aria-label="Your pipeline at a glance" className="mt-12 hidden md:block">
          <Network p={p} company={company} />
        </section>

        <section aria-label="The process" className="mt-14 md:mt-20">
          <div className="kicker">The process, for your market</div>
          <h2 className="mt-3 font-display text-[26px] md:text-[34px] leading-[1.05] tracking-[-0.02em]">Six steps between your market and your first email</h2>

          <ol className="mt-10 relative">
            <span aria-hidden className="absolute left-[19px] top-2 bottom-2 w-px bg-gradient-to-b from-accent/60 via-accent/25 to-violet-glow/40" />
            {steps.map((step, i) => (
              <li key={step.title} className="relative pl-14 md:pl-16 pb-11 last:pb-0">
                <span className="absolute left-0 top-0 inline-flex h-10 w-10 items-center justify-center rounded-full border border-accent/40 bg-ink-900 font-mono text-[12px] text-accent glow-accent">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="pt-1.5 font-display text-[19px] md:text-[22px] leading-snug tracking-[-0.01em] text-white">{step.title}</h3>
                <div className="mt-3">{step.body}</div>
              </li>
            ))}
          </ol>
        </section>

        {p.examples.length > 0 && (
          <section aria-label="Companies in your market" className="mt-20">
            <div className="kicker">Already in view</div>
            <h2 className="mt-3 font-display text-[26px] md:text-[34px] leading-[1.05] tracking-[-0.02em]">
              {p.examples.length === 1 ? "A company" : `${p.examples.length} companies`} from your market, and where each one goes next
            </h2>
            <p className="mt-4 max-w-[680px] text-[15px] leading-relaxed text-white/60">
              {p.examples.some((e) => e.title)
                ? "We can already see who to reach at each of these. Their work email is found and checked through the steps above only when we build your list."
                : "Each of these is hiring for the role your product does right now. The decision maker and their work email are found and checked through the steps above when we build your list."}
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-[12px] text-white/50">
              <span className="inline-flex items-center gap-2">
                <span className="inline-flex h-[14px] w-[14px] items-center justify-center rounded-full border border-accent/60 text-accent">
                  <Check size={9} />
                </span>
                What we can see today
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="h-[14px] w-[14px] rounded-full border border-dashed border-white/35" />
                What happens when we build your list
              </span>
            </div>
            <ul className="mt-6 grid gap-3">
              {p.examples.map((ex, i) => (
                <Lane key={`${ex.name}-${i}`} ex={ex} index={i} />
              ))}
            </ul>
          </section>
        )}

        <section aria-label="Results" className="mt-20 grid gap-4 sm:grid-cols-2">
          <div className="glass rounded-2xl px-6 py-6">
            <div className="font-display text-[40px] md:text-[48px] leading-none tracking-[-0.02em] text-gradient-accent">2.22%</div>
            <div className="mt-3 text-[13px] font-mono uppercase tracking-[0.12em] text-white/55">Bounce rate across 2,163 real sends</div>
          </div>
          <div className="glass rounded-2xl px-6 py-6">
            <div className="font-display text-[40px] md:text-[48px] leading-none tracking-[-0.02em] text-gradient-accent">Under 3%</div>
            <div className="mt-3 text-[13px] font-mono uppercase tracking-[0.12em] text-white/55">The bounce rate we hold every list to</div>
          </div>
        </section>

        <section aria-label="Our promise" className="mt-6 glass rounded-2xl px-6 py-8 md:px-10 md:py-10 border border-accent/25">
          <div className="flex items-center gap-2 text-accent">
            <Check />
            <span className="text-[11px] font-mono uppercase tracking-[0.2em]">Our promise</span>
          </div>
          <p className="mt-4 font-display text-[22px] md:text-[28px] leading-[1.2] tracking-[-0.01em] text-white">
            We keep bounces under 3%, and if {possessive(company)} list ever misses that we rebuild it at our cost.
          </p>
        </section>

        <footer className="mt-12 flex flex-wrap items-center justify-between gap-4 hairline rounded-2xl px-6 py-5">
          <p className="text-[14px] text-white/60">Want to see the rest, from domain setup to live sending?</p>
          <Link
            href={deckHref}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-accent text-ink-950 font-mono text-xs uppercase tracking-[0.18em] hover:bg-accent/90 transition"
          >
            See the full walkthrough
          </Link>
        </footer>
      </div>
    </main>
  );
}
