import type { ReactNode } from "react";

/**
 * Passthrough root layout required while `app/not-found.tsx` owns a full
 * document for non-localized requests. Locale routes render `<html>`/`<body>`
 * in `app/[locale]/layout.tsx` only.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
