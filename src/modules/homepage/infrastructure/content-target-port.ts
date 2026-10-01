import type { HomepageContentTargetKind } from "../domain/sections";

/** Owning-module contract for stable content identity (no foreign Prisma in Homepage). */
export type ContentTargetResolution = {
  available: boolean;
  href: string | null;
  defaultLabelAr: string | null;
  defaultLabelEn: string | null;
};

export type ContentTargetPort = {
  resolve(
    kind: HomepageContentTargetKind,
    targetId: string,
    locale: "ar" | "en",
  ): Promise<ContentTargetResolution>;
};
