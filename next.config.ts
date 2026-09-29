import path from "node:path";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

import {
  PREVIEW_CACHE_CONTROL,
  PREVIEW_ROBOTS_TAG,
} from "./src/shared/preview/safety";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Playwright acceptance uses http://127.0.0.1. Next.js blocks that dev origin otherwise.
  allowedDevOrigins: ["127.0.0.1"],
  turbopack: {
    root: path.resolve(import.meta.dirname),
  },
  async headers() {
    return [
      {
        source: "/:locale/admin/preview/:path*",
        headers: [
          { key: "Cache-Control", value: PREVIEW_CACHE_CONTROL },
          { key: "X-Robots-Tag", value: PREVIEW_ROBOTS_TAG },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
