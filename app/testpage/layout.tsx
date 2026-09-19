import type { Metadata } from "next";

// noindex: keeps /testpage out of Google while it's a staging copy of home.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function TestPageLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
