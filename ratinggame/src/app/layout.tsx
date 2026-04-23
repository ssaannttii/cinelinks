import type { Metadata } from "next";
import { Inter } from "next/font/google";
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
      <body className="min-h-full flex flex-col" style={{ background: "#0d0d0d", color: "#f0f0f0", fontFamily: "var(--font-inter), -apple-system, sans-serif" }}>
        {children}
      </body>
    </html>
  );
}
