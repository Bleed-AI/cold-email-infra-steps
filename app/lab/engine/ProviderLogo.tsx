"use client";

export type Provider = "gmail" | "outlook";

export function providerName(p: Provider) {
  return p === "gmail" ? "Google Workspace" : "Microsoft 365";
}

/**
 * The real Gmail mail glyph (the white envelope with the colour "M"), rebuilt as
 * inline SVG. This is the v2 fix for "use the actual Gmail square icon, not a
 * circular G" — the previous /logos/gmail.png was Google's circle-G. Designed to
 * sit on a white tile so the envelope's white fold reads.
 */
export function GmailMark({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-label="Gmail" role="img">
      <path fill="#4caf50" d="M45 16.2l-5 2.75-5 4.75L35 40h7c1.657 0 3-1.343 3-3V16.2z" />
      <path fill="#1e88e5" d="M3 16.2l3.614 1.71L13 23.7V40H6c-1.657 0-3-1.343-3-3V16.2z" />
      <polygon fill="#e53935" points="35,11.2 24,19.45 13,11.2 12,17 13,23.7 24,31.95 35,23.7 36,17" />
      <path fill="#c62828" d="M3 12.298V16.2l10 7.5V11.2L9.876 8.859C9.132 8.301 8.228 8 7.298 8 4.924 8 3 9.924 3 12.298z" />
      <path fill="#fbc02d" d="M45 12.298V16.2l-10 7.5V11.2l3.124-2.341C38.868 8.301 39.772 8 40.702 8 43.076 8 45 9.924 45 12.298z" />
    </svg>
  );
}

/**
 * A clean "app-icon" provider badge. The mark sits on a white rounded tile so it
 * reads as a deliberate badge. Gmail uses the inline envelope mark above;
 * Outlook uses its (already-square) brand PNG.
 */
export function ProviderLogo({ provider, size = 22 }: { provider: Provider; size?: number }) {
  const inner = Math.round(size * 0.66);
  return (
    <span
      className="inline-flex items-center justify-center rounded-md bg-white shrink-0 shadow-[0_1px_4px_rgba(0,0,0,0.4)]"
      style={{ width: size, height: size }}
    >
      {provider === "gmail" ? (
        <GmailMark size={inner} />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src="/logos/outlook.png"
          alt="Microsoft"
          className="object-contain"
          style={{ width: inner, height: inner }}
        />
      )}
    </span>
  );
}
