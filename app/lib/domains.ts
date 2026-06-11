export function deterministicShuffle<T>(arr: T[], seed: string): T[] {
  let s = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i++) {
    s = ((s ^ seed.charCodeAt(i)) * 16777619) >>> 0;
  }
  const result = arr.slice();
  for (let i = result.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const j = s % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function buildSendingDomains(slug: string): string[] {
  const s = slug || "client";
  return [
    `join${s}.com`,
    `use${s}.co`,
    `${s}-hq.co`,
    `${s}sync.com`,
    `${s}flow.co`,
    `try${s}.com`,
    `${s}cloud.com`,
  ];
}

export function buildResearchPool(slug: string): {
  approved: string[];
  rejects: string[];
} {
  const s = slug || "client";
  const TLDS = [".com", ".co"];
  const ROOTS = [
    `get${s}`,
    `${s}-app`,
    `${s}grid`,
    `${s}verify`,
    `${s}team`,
    `join${s}`,
    `use${s}`,
    `${s}-hq`,
    `${s}sync`,
    `${s}flow`,
    `${s}-now`,
    `${s}-pro`,
    `${s}cloud`,
    `${s}soft`,
    `${s}tech`,
    `${s}-os`,
    `${s}-labs`,
    `${s}relay`,
    `${s}mail`,
    `try${s}`,
  ];
  const approved = ROOTS.map((r, i) => r + TLDS[i % TLDS.length]);
  const rejects = [
    `spammy-discount-${s}`,
    `${s}-cheap-offer`,
    `free-${s}-promo`,
    `buy-${s}-now`,
  ].map((r) => r + ".com");
  return { approved, rejects };
}

const FIRST_NAMES = [
  "Mia", "Jordan", "Alex", "Sara", "Noah", "Liam", "Olivia",
  "Ethan", "Ava", "Leo", "Maya", "Ryan", "Zoe", "Eli", "Nina",
  "Owen", "Aria", "Theo", "Ivy", "Sam", "Lily",
];
const LAST_NAMES = ["Walker", "Reed", "Cole", "Brooks", "Hayes", "Wells", "Bishop"];

export type Mailbox = {
  domain: string;
  handle: string;
  name: string;
  hue: number;
};

export function buildMailboxes(domains: string[], perDomain = 3): Mailbox[] {
  let idx = 0;
  return domains.flatMap((domain) =>
    Array.from({ length: perDomain }).map(() => {
      const first = FIRST_NAMES[idx % FIRST_NAMES.length];
      const last = LAST_NAMES[idx % LAST_NAMES.length];
      const handle = `${first}.${last}`.toLowerCase();
      idx += 1;
      return {
        domain,
        handle: `${handle}@${domain}`,
        name: `${first} ${last}`,
        hue: (idx * 47) % 360,
      };
    })
  );
}
