// Run with `npm test` (node --test, Node 22.18+ strips the TypeScript types natively).
import { test } from "node:test";
import assert from "node:assert/strict";
import { parsePrefill, cleanDomain, cleanText } from "./prefill.ts";

test("no params means no prefill (behaviour unchanged)", () => {
  assert.equal(parsePrefill(""), null);
  assert.equal(parsePrefill("?"), null);
  assert.equal(parsePrefill("?utm_source=email"), null);
});

test("full per-lead link", () => {
  assert.deepEqual(parsePrefill("?company=Acme&domain=acme.com&first=Sam&last=Lee&go=1"), {
    company: "Acme",
    domain: "acme.com",
    first: "Sam",
    last: "Lee",
    go: true,
  });
});

test("go only when explicitly truthy", () => {
  assert.equal(parsePrefill("?company=Acme")?.go, false);
  assert.equal(parsePrefill("?company=Acme&go=0")?.go, false);
  assert.equal(parsePrefill("?company=Acme&go=true")?.go, true);
});

test("HTML and script are stripped to plain text", () => {
  const p = parsePrefill("?company=" + encodeURIComponent("<script>alert(1)</script>Acme <b>Labs</b>"));
  assert.equal(p.company, "Acme Labs");
  assert.equal(cleanText('"><img src=x onerror=alert(1)>Sam', 40), "Sam");
});

test("lengths are capped", () => {
  const p = parsePrefill("?company=" + "A".repeat(200) + "&first=" + "B".repeat(200));
  assert.equal(p.company.length, 28);
  assert.equal(p.first.length, 40);
});

test("apostrophes and accents survive", () => {
  assert.equal(parsePrefill("?last=O'Brien&first=Ren%C3%A9e").last, "O'Brien");
  assert.equal(parsePrefill("?first=Ren%C3%A9e").first, "Renée");
});

test("domain is normalised to a bare hostname", () => {
  assert.equal(cleanDomain("https://www.Acme.com/about?x=1"), "acme.com");
  assert.equal(cleanDomain("acme.co.uk:443"), "acme.co.uk");
  assert.equal(cleanDomain("javascript:alert(1)"), undefined);
  assert.equal(cleanDomain("not a domain"), undefined);
  assert.equal(cleanDomain("<b>acme.com</b>"), undefined);
});

test("company falls back to the domain when missing", () => {
  assert.equal(parsePrefill("?domain=acme-labs.io").company, "Acme Labs");
});

test("empty values come back undefined, never empty strings", () => {
  const p = parsePrefill("?company=%20%20&first=&go=1");
  assert.equal(p.company, undefined);
  assert.equal(p.first, undefined);
  assert.equal(p.go, true);
});
