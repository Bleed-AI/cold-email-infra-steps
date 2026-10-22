// Run with `npm test`. Tests the `p=` market payload parser used by /reach.
import { test } from "node:test";
import assert from "node:assert/strict";
import { parsePayload, parsePrefill, decodeBase64Url, boundedInt, PAYLOAD_LIMITS } from "./prefill.ts";

const enc = (o) => Buffer.from(typeof o === "string" ? o : JSON.stringify(o), "utf8").toString("base64url");
const q = (o) => "?company=Acme&p=" + enc(o);

test("no p means no payload", () => {
  assert.equal(parsePayload(""), null);
  assert.equal(parsePayload("?company=Acme&go=1"), null);
});

test("a real payload round-trips", () => {
  const p = parsePayload(
    q({
      v: 1,
      c: 3498,
      cl: "companies in our database that match your buyer profile",
      k: "ceiling",
      t: ["Plant Manager", "Director of Operations"],
      e: [{ n: "Redwood Logistics", p: "Chicago, United States", t: "Supply Chain Director" }],
      b: "Manufacturers and warehouses",
    }),
  );
  assert.deepEqual(p, {
    count: 3498,
    countLabel: "companies in our database that match your buyer profile",
    countKind: "ceiling",
    titles: ["Plant Manager", "Director of Operations"],
    examples: [{ name: "Redwood Logistics", place: "Chicago, United States", title: "Supply Chain Director" }],
    buyer: "Manufacturers and warehouses",
  });
});

test("the payload does not change the existing prefill parser", () => {
  assert.equal(parsePrefill("?p=" + enc({ c: 5 })), null);
  assert.equal(parsePrefill(q({ c: 5 })).company, "Acme");
});

test("malformed input drops the whole payload", () => {
  assert.equal(parsePayload("?p=%%%"), null);
  assert.equal(parsePayload("?p=" + enc("not json")), null);
  assert.equal(parsePayload("?p=" + enc([1, 2])), null);
  assert.equal(parsePayload("?p=" + "A".repeat(PAYLOAD_LIMITS.raw + 1)), null);
  assert.equal(decodeBase64Url("a"), undefined);
  assert.equal(decodeBase64Url(Buffer.from([0xff, 0xfe]).toString("base64url")), undefined); // invalid UTF-8
});

test("count must be a bounded positive integer, never rounded", () => {
  assert.equal(boundedInt(12.5, 100), undefined);
  assert.equal(boundedInt("12", 100), undefined);
  assert.equal(boundedInt(0, 100), undefined);
  assert.equal(boundedInt(101, 100), undefined);
  assert.equal(parsePayload(q({ c: 1e9, e: [] })), null);
  assert.equal(parsePayload(q({ c: 12.5, e: [{ n: "X" }] })).count, undefined);
});

test("nothing personal to show gives null", () => {
  assert.equal(parsePayload(q({ t: ["CEO"], b: "Buyers" })), null);
  assert.equal(parsePayload(q({ e: [{ p: "no name" }] })), null);
});

test("markup, dashes and lengths are cleaned on every field", () => {
  const p = parsePayload(
    q({
      c: 10,
      cl: "<b>firms</b> — a ceiling",
      k: "made-up",
      t: ["<script>x</script>CEO", "CEO", "A", "B", "C", "D"],
      e: Array.from({ length: 9 }, (_, i) => ({ n: "Co " + i + " – " + "x".repeat(80), p: "<img onerror=1>Leeds", h: "FSQA Manager" })),
      b: "y".repeat(400),
    }),
  );
  assert.equal(p.countLabel, "firms, a ceiling");
  assert.equal(p.countKind, undefined);
  assert.deepEqual(p.titles, ["CEO", "A", "B", "C"]);
  assert.equal(p.examples.length, 5);
  assert.ok(p.examples.every((e) => e.name.length <= PAYLOAD_LIMITS.exName + 1 && !/[–—<>]/.test(e.name)));
  assert.equal(p.examples[0].place, "Leeds");
  assert.equal(p.examples[0].hiring, "FSQA Manager");
  assert.equal(p.buyer.length, PAYLOAD_LIMITS.buyer);
});

test("accents survive the base64url round trip", () => {
  assert.equal(parsePayload(q({ c: 3, cl: "Gründer firms", e: [] })).countLabel, "Gründer firms");
});
