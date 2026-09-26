import { notFound } from "next/navigation";

/**
 * Catch-all inside the locale segment: unknown paths under a valid locale
 * (e.g. /ar/anything-unknown) render the localized not-found page instead
 * of falling through to the global root 404.
 */
export default function CatchAllPage() {
  notFound();
}
