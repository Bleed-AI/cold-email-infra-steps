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
