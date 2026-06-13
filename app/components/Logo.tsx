"use client";

// Real vendor logos (PNGs in /public/logos). Rendered on a subtle tile so the
// full-colour marks read cleanly on the dark UI. Keep this list in sync with
// the files in public/logos.
export type LogoName =
  | "apify"
  | "apollo"
  | "claude"
  | "clay"
  | "cloudflare"
  | "findymail"
  | "gmail"
  | "googlemaps"
  | "instantly"
  | "leadmagic"
  | "linkedin"
  | "n8n"
  | "openai"
  | "openwebninja"
  | "outlook"
  | "parallel"
  | "prospeo"
  | "serper"
  | "supabase"
  | "trykit"
  | "zapmail";

const LABELS: Partial<Record<LogoName, string>> = {
  apify: "Apify",
  apollo: "Apollo",
  clay: "Clay",
  cloudflare: "Cloudflare",
  findymail: "Findymail",
  gmail: "Gmail",
  googlemaps: "Google Maps",
  instantly: "Instantly",
  leadmagic: "LeadMagic",
  linkedin: "LinkedIn",
  openai: "OpenAI",
  outlook: "Outlook",
  parallel: "Parallel.ai",
  prospeo: "Prospeo",
  serper: "Serper",
  trykit: "TryKit",
  zapmail: "Zapmail",
};

export function logoLabel(name: LogoName): string {
  return LABELS[name] ?? name;
}

type LogoProps = {
  name: LogoName;
  size?: number;
  /** Wrap the mark in a rounded tile (default true). */
  tile?: boolean;
  className?: string;
};

/** A single vendor mark. */
export function Logo({ name, size = 26, tile = true, className }: LogoProps) {
  const img = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/logos/${name}.png`}
      alt={logoLabel(name)}
      width={size}
      height={size}
      loading="lazy"
      className="object-contain"
      style={{ width: size, height: size }}
    />
  );
  if (!tile) return img;
  return (
    <span
      className={`inline-flex items-center justify-center rounded-lg bg-white/[0.07] border border-white/10 ${className ?? ""}`}
      style={{ width: size + 14, height: size + 14 }}
    >
      {img}
    </span>
  );
}

/** A pill: logo mark + label, styled like the existing .chip. */
export function LogoChip({
  name,
  label,
  size = 16,
}: {
  name: LogoName;
  label?: string;
  size?: number;
}) {
  return (
    <span className="chip !gap-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/logos/${name}.png`}
        alt=""
        width={size}
        height={size}
        loading="lazy"
        className="object-contain"
        style={{ width: size, height: size }}
      />
      {label ?? logoLabel(name)}
    </span>
  );
}
