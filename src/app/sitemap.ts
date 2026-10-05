import type { MetadataRoute } from "next";

import { listManagedPagePublicRoutePaths } from "@/modules/managed-pages";
import { listNewsPublicRoutePaths } from "@/modules/publishing";
import { getServerConfig } from "@/platform/config";
import { staticPublicRoutePaths } from "@/platform/public-routes/static-contributor";
import { buildPublicSitemapEntries } from "@/platform/public-routes/sitemap";
import { getRuntimeDatabase } from "@/platform/runtime";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const config = getServerConfig();
  const database = getRuntimeDatabase();
  const [news, pages] = await Promise.all([
    listNewsPublicRoutePaths(database),
    listManagedPagePublicRoutePaths(database),
  ]);
  const paths = [...staticPublicRoutePaths(), ...news, ...pages];
  return buildPublicSitemapEntries(paths, config.publicSiteOrigin);
}
