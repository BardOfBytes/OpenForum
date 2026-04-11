/**
 * Root Layout — OpenForum
 *
 * Loads DM Sans (body) and Fraunces (editorial headings) via next/font,
 * applies them as CSS custom properties, and wraps the application
 * with global metadata and the OpenForum design system.
 */

import type { Metadata } from "next";
import { DM_Sans, Fraunces } from "next/font/google";
import "./globals.css";

/**
 * DM Sans — geometric sans-serif for body text and UI.
 * Subsets: latin. Weights: 400 (regular), 500 (medium), 700 (bold).
 * Applied as `--font-dm-sans` CSS variable.
 */
const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-dm-sans",
  display: "swap",
});

/**
 * Fraunces — old-style serif for editorial headings.
 * Subsets: latin. Weights: 400, 600 (semibold), 700 (bold).
 * Optical size axis enabled for better rendering at different sizes.
 * Applied as `--font-fraunces` CSS variable.
 */
const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-fraunces",
  display: "swap",
});

/** Global metadata for OpenForum — SEO baseline. */
export const metadata: Metadata = {
  title: {
    template: "%s | OpenForum",
    default: "OpenForum — Student Editorial Platform",
  },
  description:
    "The student-run editorial and journalism platform for UTD CSVTU. " +
    "Campus news, opinions, investigations, and long-form stories.",
  keywords: [
    "OpenForum",
    "CSVTU",
    "student journalism",
    "editorial",
    "campus news",
    "UTD",
  ],
  openGraph: {
    type: "website",
    locale: "en_IN",
    siteName: "OpenForum",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${dmSans.variable} ${fraunces.variable}`}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
