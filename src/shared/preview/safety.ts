/**
 * Domain-neutral Preview isolation values.
 * Managed Pages uses them now. News and Homepage can adopt the same
 * constants later without a Preview framework.
 */
export const PREVIEW_CACHE_CONTROL =
  "private, no-store, max-age=0, must-revalidate";

export const PREVIEW_ROBOTS_TAG = "noindex, nofollow";

export const previewRobots = {
  index: false,
  follow: false,
  nocache: true,
} as const;

export function isPreviewPath(pathname: string): boolean {
  return /\/admin\/preview\//u.test(pathname);
}
