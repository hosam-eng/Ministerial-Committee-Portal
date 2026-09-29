import { ManagedPageError } from "./errors";
import { isUuid } from "./ids";

export const EXTERNAL_LINK_REL = "noopener noreferrer";
export const EXTERNAL_LINK_TARGET = "_blank";

const UNSAFE_PROTOCOL = /^(?:javascript|data|vbscript|file|blob):/iu;

/**
 * External Managed Page links are https URLs only.
 * mailto/tel and unsafe schemes are rejected. Credentials are rejected.
 */
export function validateExternalUrl(value: string): string {
  const href = value.trim();
  if (
    !href ||
    href.length > 2000 ||
    UNSAFE_PROTOCOL.test(href) ||
    href.includes("\\")
  ) {
    throw new ManagedPageError("INVALID_LINK");
  }
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    throw new ManagedPageError("INVALID_LINK");
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    !url.hostname
  ) {
    throw new ManagedPageError("INVALID_LINK");
  }
  return href;
}

export function requirePageId(value: string): string {
  if (!isUuid(value)) throw new ManagedPageError("INVALID_REFERENCE");
  return value.toLowerCase();
}
