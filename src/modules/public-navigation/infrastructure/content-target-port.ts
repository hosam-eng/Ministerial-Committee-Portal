import type { NavigationContentTargetKind } from "../domain/draft";

/** Owning-module contract for stable content identity (no foreign Prisma in Navigation). */
export type ContentTargetResolution = {
  available: boolean;
  href: string | null;
  defaultLabelAr: string | null;
  defaultLabelEn: string | null;
};

export type ContentTargetPort = {
  resolve(
    kind: NavigationContentTargetKind,
    targetId: string,
    locale: "ar" | "en",
  ): Promise<ContentTargetResolution>;
};
