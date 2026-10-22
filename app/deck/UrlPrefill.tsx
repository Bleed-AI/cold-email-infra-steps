"use client";

import { useLayoutEffect } from "react";
import { useClient } from "../context/ClientContext";
import { parsePrefill } from "../lib/prefill";

/**
 * Per-lead links. Reads ?company=&domain=&first=&last= once on load and feeds
 * the ClientContext, so every step renders for that lead's company:
 *   /?company=Acme&domain=acme.com&first=Sam&last=Lee&go=1
 * `go=1` is handled by VisitorIntro (skips the welcome modal). Works together
 * with the #slide deep link, e.g. /?company=Acme&go=1#copy.
 *
 * Reads window.location in a layout effect (not useSearchParams, which would
 * force a Suspense boundary on this static page, and not a useState initializer,
 * which would mismatch the server render). Layout effects run before the deck's
 * play effects, so the first step already builds on the lead's company.
 * No params: does nothing, behaviour unchanged.
 */
export default function UrlPrefill() {
  const { client, setClient } = useClient();

  useLayoutEffect(() => {
    const p = parsePrefill(window.location.search);
    if (!p || (!p.company && !p.first && !p.last)) return;
    setClient({
      businessName: p.company ?? client.businessName,
      // Company given without a domain: let setClient derive <slug>.com.
      mainDomain: p.domain ?? (p.company ? undefined : client.mainDomain),
      firstName: p.first,
      lastName: p.last,
    });
    // Run once on load only; later edits come from the user, not the URL.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
