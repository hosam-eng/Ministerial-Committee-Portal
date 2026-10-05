export type PublicRouteLocale = "ar" | "en";

/** Path-only public route (no origin). */
export type PublicRoutePath = {
  locale: PublicRouteLocale;
  pathname: string;
  lastModified?: Date;
  /** Other locales where the same live content is available at this route. */
  alternateLocales: PublicRouteLocale[];
};
