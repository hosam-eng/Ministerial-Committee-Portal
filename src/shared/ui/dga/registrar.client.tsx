"use client";

import { useEffect } from "react";

/**
 * DGA Platforms Code vendor seam (IMP-08).
 *
 * `@platformscode/core` is a Stencil web-component library. Its exports
 * map declares a public per-component entry (`./components/*.js` →
 * `dist/components/*.js`); each module ships `{ defineCustomElement }`.
 * We register ONLY the elements actually rendered by the application,
 * behind this single client module — the documented React wrapper
 * (`platformscode-new-react`) is SSR-unsafe (IMP-07) and is not used.
 *
 * All vendor imports stay inside src/shared/ui/dga/ so the package
 * internals remain replaceable. Server components emit plain
 * `<dga-*>` tags; this registrar upgrades them client-side.
 */
const DGA_ELEMENTS: ReadonlyArray<
  () => Promise<{ defineCustomElement(): void }>
> = [() => import("@platformscode/core/components/dga-button-v2.js")];

/** Mount once near the shell root — registers the used DGA elements. */
export function DgaRegistrar() {
  useEffect(() => {
    for (const load of DGA_ELEMENTS) {
      void load().then((module) => module.defineCustomElement());
    }
  }, []);
  return null;
}
