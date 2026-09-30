/**
 * Global not-found surface for requests outside the localized segment.
 * Localized routes use app/[locale]/layout.tsx for `<html lang>` / `dir`.
 * This global surface renders its own minimal html/body for requests
 * outside the locale segment — interface text stays English since no
 * locale context exists. `app/layout.tsx` is a passthrough required
 * by Next.js when this file is present.
 */
export default function RootNotFound() {
  return (
    <html lang="en" dir="ltr">
      <body>
        <main>
          <h1>Page not found</h1>
          <p>The page you requested could not be found.</p>
        </main>
      </body>
    </html>
  );
}
