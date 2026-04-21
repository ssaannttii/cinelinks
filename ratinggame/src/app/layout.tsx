import type { Metadata } from "next";
import "./globals.css";

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
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-[#0a0a0f] text-[#f0f0f5]">
        {children}
      </body>
    </html>
  );
}
