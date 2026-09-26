import { createNavigation } from "next-intl/navigation";

import { routing } from "./routing";

/**
 * Locale-aware navigation helpers bound to the portal routing config.
 * `Link` resolves `href` against the explicit "/{locale}/…" prefix scheme.
 */
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
