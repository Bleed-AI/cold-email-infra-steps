/**
 * Per-lead link prefill: turns a query string like
 *   ?company=Acme&domain=acme.com&first=Sam&last=Lee&go=1
 * into clean, plain-text values for the ClientContext.
 *
 * Pure (no window, no React) so it can be unit tested with `npm test`.
 * Everything is treated as untrusted input: tags and control characters are
 * stripped, whitespace is collapsed, and each field is length-capped. Empty
 * fields come back as `undefined`, never "", because setClient treats an
 * empty string as a real value and would wipe the default persona.
 */

export type Prefill = {
  company?: string;
  domain?: string;
  first?: string;
  last?: string;
  /** `go=1`: skip the welcome modal and start the personalized deck. */
  go: boolean;
};

export const PREFILL_LIMITS = {
  company: 28, // matches the inline company editor's maxLength
  name: 40,
  domain: 63,
} as const;

/** Control characters, zero-width marks and line/paragraph separators. */
function isInvisible(ch: string): boolean {
  const c = ch.codePointAt(0) ?? 0;
  return c < 0x20 || (c >= 0x7f && c <= 0x9f) || (c >= 0x200b && c <= 0x200f) || c === 0x2028 || c === 0x2029;
}

/** Plain text only: drop tags, angle brackets, control chars; collapse spaces. */
export function cleanText(raw: string | null | undefined, max: number): string | undefined {
  if (raw == null) return undefined;
  const out = String(raw)
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, " ") // drop script/style bodies
    .replace(/<[^>]*>/g, " ") // strip anything tag-shaped
    .replace(/[<>"`\\{}]/g, "") // and any stray markup characters (apostrophes stay: O'Brien)
    .replace(/./gsu, (ch) => (isInvisible(ch) ? " " : ch))
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max)
    .trim();
  return out || undefined;
}

/** A bare hostname: no scheme, www, path, port, or credentials. */
export function cleanDomain(raw: string | null | undefined): string | undefined {
  if (raw == null) return undefined;
  let d = String(raw).trim().toLowerCase();
  d = d.replace(/^[a-z][a-z0-9+.-]*:\/\//, ""); // scheme
  d = d.replace(/^[^@/]*@/, ""); // user@
  d = d.split(/[/?#:\s]/)[0] ?? ""; // path, query, port
  d = d.replace(/^www\./, "").replace(/\.$/, "");
  if (d.length > PREFILL_LIMITS.domain) return undefined;
  const label = "[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?";
  const host = new RegExp(`^(?:${label}\\.)+[a-z]{2,24}$`);
  return host.test(d) ? d : undefined;
}

/** "acme-labs.co.uk" -> "Acme Labs" (used only when no company is given). */
export function companyFromDomain(domain: string): string | undefined {
  const head = domain.split(".")[0] ?? "";
  const words = head
    .split("-")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1));
  return cleanText(words.join(" "), PREFILL_LIMITS.company);
}

const TRUE_VALUES = new Set(["1", "true", "yes"]);

/**
 * Parse a query string (with or without the leading "?"). Returns null when
 * the link carries no prefill at all, so callers can leave behaviour unchanged.
 */
export function parsePrefill(search: string): Prefill | null {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);

  const domain = cleanDomain(params.get("domain"));
  let company = cleanText(params.get("company"), PREFILL_LIMITS.company);
  if (!company && domain) company = companyFromDomain(domain);
  const first = cleanText(params.get("first"), PREFILL_LIMITS.name);
  const last = cleanText(params.get("last"), PREFILL_LIMITS.name);
  const go = TRUE_VALUES.has((params.get("go") ?? "").trim().toLowerCase());

  if (!company && !domain && !first && !last && !go) return null;
  return { company, domain, first, last, go };
}

/* ------------------------------------------------------------------------ */
/* Market payload (`p=`): the lead's own market, for /reach.                */
/* ------------------------------------------------------------------------ */

/**
 * `p=` carries one base64url JSON object built by bleedai-campaign-master
 * `scripts/lib/followup-playbook.cjs` marketPayload():
 *   { v: 1, c: count, cl: count label, k: "ceiling" | "sheet" | "index",
 *     t: [titles], e: [{ n: name, p: place, t: title, h: hiring }], b: buyer }
 * Untrusted like every other param: every string goes through cleanText with
 * the caps below (kept equal to MARKET_PAYLOAD_LIMITS on the sender side),
 * the count must be a bounded integer, and anything malformed drops the
 * whole payload rather than rendering half of it.
 */

export type CountKind = "ceiling" | "sheet" | "index";

export type MarketExample = {
  name: string;
  place?: string;
  title?: string;
  hiring?: string;
};

export type MarketPayload = {
  count?: number;
  countLabel?: string;
  countKind?: CountKind;
  titles: string[];
  examples: MarketExample[];
  buyer?: string;
};

export const PAYLOAD_LIMITS = {
  raw: 4000, // max length of the encoded param itself
  label: 90,
  buyer: 160,
  title: 48,
  titles: 4,
  exName: 48,
  exPlace: 48,
  exTitle: 60,
  examples: 5,
  countMax: 99_999_999,
} as const;

const COUNT_KINDS: ReadonlySet<string> = new Set(["ceiling", "sheet", "index"]);

/** base64url -> UTF-8 string, or undefined on any malformed input. */
export function decodeBase64Url(raw: string): string | undefined {
  if (!/^[A-Za-z0-9_-]+={0,2}$/.test(raw)) return undefined;
  let b64 = raw.replace(/=+$/, "").replace(/-/g, "+").replace(/_/g, "/");
  if (b64.length % 4 === 1) return undefined;
  while (b64.length % 4) b64 += "=";
  try {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return undefined;
  }
}

/** A positive whole number within bounds, else undefined (never rounded). */
export function boundedInt(v: unknown, max: number): number | undefined {
  return typeof v === "number" && Number.isInteger(v) && v > 0 && v <= max ? v : undefined;
}

/** Em and en dashes never reach the page, whatever the sender did. */
function noDash(s: string | undefined): string | undefined {
  if (!s) return s;
  const out = s.replace(/\s*[‒-―−]\s*/g, ", ").replace(/\s+/g, " ").trim();
  return out || undefined;
}

function str(v: unknown, max: number): string | undefined {
  return typeof v === "string" ? noDash(cleanText(v, max)) : undefined;
}

/**
 * Parse `p=` out of a query string (with or without "?"). Returns null when
 * there is no payload, it is malformed, or it has nothing personal to show
 * (no count and no named examples), so /reach can fall back to /verify.
 */
export function parsePayload(search: string): MarketPayload | null {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const raw = params.get("p");
  if (!raw || raw.length > PAYLOAD_LIMITS.raw) return null;
  const json = decodeBase64Url(raw.trim());
  if (!json) return null;
  let o: unknown;
  try {
    o = JSON.parse(json);
  } catch {
    return null;
  }
  if (!o || typeof o !== "object" || Array.isArray(o)) return null;
  const r = o as Record<string, unknown>;

  const count = boundedInt(r.c, PAYLOAD_LIMITS.countMax);
  const countLabel = count ? str(r.cl, PAYLOAD_LIMITS.label) : undefined;
  const countKind = count && typeof r.k === "string" && COUNT_KINDS.has(r.k) ? (r.k as CountKind) : undefined;

  const titles = (Array.isArray(r.t) ? r.t : [])
    .map((t) => str(t, PAYLOAD_LIMITS.title))
    .filter((t): t is string => !!t)
    .filter((t, i, a) => a.indexOf(t) === i)
    .slice(0, PAYLOAD_LIMITS.titles);

  const examples: MarketExample[] = [];
  for (const e of Array.isArray(r.e) ? r.e : []) {
    if (examples.length >= PAYLOAD_LIMITS.examples) break;
    if (!e || typeof e !== "object" || Array.isArray(e)) continue;
    const x = e as Record<string, unknown>;
    const name = str(x.n, PAYLOAD_LIMITS.exName);
    if (!name) continue;
    const ex: MarketExample = { name };
    const place = str(x.p, PAYLOAD_LIMITS.exPlace);
    const title = str(x.t, PAYLOAD_LIMITS.exTitle);
    const hiring = str(x.h, PAYLOAD_LIMITS.exTitle);
    if (place) ex.place = place;
    if (title) ex.title = title;
    if (hiring) ex.hiring = hiring;
    examples.push(ex);
  }

  const buyer = str(r.b, PAYLOAD_LIMITS.buyer);
  if (!count && !examples.length) return null;
  const out: MarketPayload = { titles, examples };
  if (count) out.count = count;
  if (countLabel) out.countLabel = countLabel;
  if (countKind) out.countKind = countKind;
  if (buyer) out.buyer = buyer;
  return out;
}
