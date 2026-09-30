import { PublicNavigationError } from "./errors";

const UNSAFE_PROTOCOL = /^(?:javascript|data|vbscript|file|blob):/iu;

/** HTTPS external URLs only — aligned with Site Settings social-link policy. */
export function validateNavigationExternalUrl(value: string): string {
  const href = value.trim();
  if (
    !href ||
    href.length > 2000 ||
    UNSAFE_PROTOCOL.test(href) ||
    href.includes("\\")
  ) {
    throw new PublicNavigationError("INVALID_EXTERNAL_URL");
  }
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    throw new PublicNavigationError("INVALID_EXTERNAL_URL");
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    !url.hostname
  ) {
    throw new PublicNavigationError("INVALID_EXTERNAL_URL");
  }
  return href;
}
