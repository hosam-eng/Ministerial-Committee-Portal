export type PublicRouteLocale = "ar" | "en";

/** Path-only public route (no origin). */
export type PublicRoutePath = {
  locale: PublicRouteLocale;
  pathname: string;
  lastModified?: Date;
  /** Live sibling locale paths for the same content entity (not inferred from slug). */
  alternatePathnames: Partial<Record<PublicRouteLocale, string>>;
};
