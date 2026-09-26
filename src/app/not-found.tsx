/**
 * Global not-found surface for requests outside the localized segment.
 * The document root lives in app/[locale]/layout.tsx, so this catch-all
 * renders its own minimal html/body — interface text stays English here
 * since no locale context exists.
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
