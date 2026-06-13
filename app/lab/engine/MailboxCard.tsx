"use client";

import { ProviderLogo, providerName, type Provider } from "./ProviderLogo";

/**
 * A readable mailbox: the FULL email address + a clean provider badge. This is
 * the direct fix for "those circles should have been email icons … I can't even
 * read that." Used big during the focus beat, then summarized in the overview.
 */
export function MailboxCard({
  email,
  name,
  provider,
  style,
  className,
}: {
  email: string;
  name?: string;
  provider: Provider;
  style?: React.CSSProperties;
  className?: string;
}) {
  return (
    <div
      className={`inline-flex items-center gap-2.5 rounded-lg bg-ink-800/95 border border-white/12 pl-2 pr-3 py-2 backdrop-blur-sm shadow-[0_8px_24px_rgba(0,0,0,0.45)] ${className ?? ""}`}
      style={style}
    >
      <ProviderLogo provider={provider} size={24} />
      <div className="leading-tight min-w-0">
        <div className="font-mono text-[13px] text-white truncate">{email}</div>
        <div className="text-[10px] text-white/45 truncate">
          {name ? `${name} · ` : ""}
          {providerName(provider)}
        </div>
      </div>
    </div>
  );
}
