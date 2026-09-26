import { getRequestConfig } from "next-intl/server";

import { resolveRequestConfig } from "./config";

export default getRequestConfig(async ({ requestLocale }) =>
  resolveRequestConfig(await requestLocale),
);
