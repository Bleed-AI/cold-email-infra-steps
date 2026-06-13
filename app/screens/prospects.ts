/**
 * Deterministic prospect recipients for the Live-sending screen. These are the
 * RIGHT-hand column — the people receiving the cold email. Everything about a
 * prospect (which ones reply) is a pure function of its index, so the whole
 * screen can be re-rendered at any clock value by `renderAt(t)`.
 */
export type Prospect = {
  name: string;
  role: string;
  company: string;
  /** true => this prospect sends a positive reply during the run. */
  replies: boolean;
};

const POOL: Omit<Prospect, "replies">[] = [
  { name: "Dana Cho", role: "VP Sales", company: "Northwind" },
  { name: "Marcus Hale", role: "Head of Growth", company: "Lumen Labs" },
  { name: "Priya Nair", role: "Founder", company: "Cedar & Co" },
  { name: "Tom Becker", role: "RevOps Lead", company: "Brightline" },
  { name: "Elena Ruiz", role: "CMO", company: "Vantage" },
  { name: "Sam Okafor", role: "Director", company: "Harbor Point" },
  { name: "Grace Lin", role: "VP Marketing", company: "Foundry 9" },
];

/** Which indices reply — fixed, so the counter and summary always agree. */
const REPLY_INDICES = new Set([1, 4]);

export function buildProspects(): Prospect[] {
  return POOL.map((p, i) => ({ ...p, replies: REPLY_INDICES.has(i) }));
}

/** Total positive replies the run produces (kept in lockstep with the visuals). */
export const REPLY_COUNT = REPLY_INDICES.size;

/** Tunable on-screen cadence figure. */
export const PER_INBOX_PER_DAY = 27;
