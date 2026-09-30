import { SiteSettingsError } from "./errors";

const UNSAFE_PROTOCOL = /^(?:javascript|data|vbscript|file|blob):/iu;

/** HTTPS external URLs only — aligned with Managed Page external-link policy. */
export function validateSocialUrl(value: string): string {
  const href = value.trim();
  if (
    !href ||
    href.length > 2000 ||
    UNSAFE_PROTOCOL.test(href) ||
    href.includes("\\")
  ) {
    throw new SiteSettingsError("INVALID_SOCIAL_URL");
  }
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    throw new SiteSettingsError("INVALID_SOCIAL_URL");
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    !url.hostname
  ) {
    throw new SiteSettingsError("INVALID_SOCIAL_URL");
  }
  return href;
}
