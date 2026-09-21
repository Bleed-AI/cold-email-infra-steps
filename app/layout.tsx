import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { ClientProvider } from "./context/ClientContext";

const sans = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const display = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Multi-Channel Outreach — From Request to Revenue-Ready",
  description:
    "We build, warm up, and run coordinated outreach on email and LinkedIn — with call and SMS follow-up handled in your CRM.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${sans.variable} ${display.variable} bg-ink-950`}>
      <body className="bg-ink-950 text-white overflow-hidden antialiased">
        <ClientProvider>{children}</ClientProvider>
      </body>
    </html>
  );
}
