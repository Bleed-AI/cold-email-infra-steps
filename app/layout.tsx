import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";
import SmoothScroll from "./components/SmoothScroll";
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
  title: "Cold Email Infrastructure — From Request to Revenue-Ready",
  description:
    "We build, configure, warm up, and deliver complete cold email systems.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${sans.variable} ${display.variable} bg-ink-950`}>
      <body className="bg-ink-950 text-white overflow-x-hidden antialiased">
        <ClientProvider>
          <SmoothScroll>{children}</SmoothScroll>
        </ClientProvider>
      </body>
    </html>
  );
}
