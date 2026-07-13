import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "CineRating — Guess the Score",
  description: "How well do you know movies? Guess IMDB and Rotten Tomatoes ratings of iconic films.",
  openGraph: {
    title: "CineRating — Guess the Score",
    description: "Guess IMDB & Rotten Tomatoes ratings of iconic films.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`h-full antialiased ${inter.variable}`}>
      <body className="min-h-full flex flex-col" style={{ background: "#252c35", color: "#f0f0f0", fontFamily: "var(--font-inter), -apple-system, sans-serif" }}>
        {children}
        {/* CineLinks suite engines — same origin in production (served through the
            /rating/* proxy), so Top Trumps can bank cards into the shared collection
            and reveals get sound. 404s harmlessly when the app runs standalone. */}
        <Script src="/sfx.js" strategy="afterInteractive" />
        <Script src="/analytics.js" strategy="afterInteractive" />
        <Script src="/feedback.js" strategy="afterInteractive" />
        <Script src="/collection.js" strategy="afterInteractive" />
      </body>
    </html>
  );
}
