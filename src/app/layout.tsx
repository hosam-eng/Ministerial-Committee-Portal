import type { Metadata } from "next";

import "@/styles/globals.css";

export const metadata: Metadata = {
  title: "Ministerial Committee Portal",
  description:
    "Technical foundation bootstrap for the Ministerial Committee public digital portal.",
};

/**
 * Bootstrap-only shell.
 *
 * Localization ("/ar" + "/en" routes, Arabic default, RTL/LTR, next-intl) is
 * owned by IMP-04 — the temporary `lang="en"` markup below must be replaced
 * when that increment lands.
 */
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
