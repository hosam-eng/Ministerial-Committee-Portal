import { describe, expect, it } from "vitest";

import {
  analyzeFile,
  checkSource,
  listSourceFiles,
  SRC_ROOT,
} from "./boundaries";

describe("architecture boundaries — real source tree", () => {
  it("src/ contains no forbidden dependencies", () => {
    const violations = listSourceFiles(SRC_ROOT).flatMap((file) =>
      analyzeFile(file),
    );
    expect(violations).toEqual([]);
  });
});

// Synthetic sources prove the checker detects representative forbidden
// dependencies — a real violation in src/ fails the suite above in CI.
type Case = [
  name: string,
  file: string,
  source: string,
  expectedRule: string | null,
];

const VIOLATIONS: Case[] = [
  [
    "domain → Prisma",
    "modules/publishing/domain/news.ts",
    'import { PrismaClient } from "@prisma/client";\nexport const x = 1;',
    "layer must not depend on Prisma",
  ],
  [
    "domain → next/headers",
    "modules/publishing/domain/news.ts",
    'import { cookies } from "next/headers";\nexport const x = 1;',
    "layer must not depend on Next.js",
  ],
  [
    "domain → react",
    "modules/publishing/domain/news.ts",
    'import { useState } from "react";\nexport const x = 1;',
    "layer must not depend on React",
  ],
  [
    "domain → platform database",
    "modules/publishing/domain/news.ts",
    'import { db } from "@/platform/database/client";\nexport const x = 1;',
    "domain must not depend on platform infrastructure",
  ],
  [
    "domain → other module public contract",
    "modules/publishing/domain/news.ts",
    'import { getMedia } from "@/modules/media";\nexport const x = 1;',
    "domain must not depend on other modules",
  ],
  [
    "application → own module infrastructure (alias)",
    "modules/publishing/application/create-news.ts",
    'import { NewsRepo } from "@/modules/publishing/infrastructure/news-repository";\nexport const x = 1;',
    "application must not depend on infrastructure or presentation",
  ],
  [
    "application → own module infrastructure (relative)",
    "modules/publishing/application/create-news.ts",
    'import { NewsRepo } from "../infrastructure/news-repository";\nexport const x = 1;',
    "application must not depend on infrastructure or presentation",
  ],
  [
    "application → other module internals",
    "modules/publishing/application/create-news.ts",
    'import { thing } from "@/modules/media/domain/media";\nexport const x = 1;',
    "cross-module imports must use the target module's public contract",
  ],
  [
    "module infrastructure → other module internals",
    "modules/publishing/infrastructure/news-repository.ts",
    'import { MediaRepo } from "@/modules/media/infrastructure/media-repository";\nexport const x = 1;',
    "cross-module imports must use the target module's public contract",
  ],
  [
    "app delivery → module internals",
    "app/news/page.tsx",
    'import { NewsRepo } from "@/modules/publishing/infrastructure/news-repository";\nexport default function P() { return null; }',
    "app must consume modules only through their public contract (@/modules/<name>)",
  ],
  [
    "platform → business module",
    "platform/database/client.ts",
    'import { News } from "@/modules/publishing";\nexport const x = 1;',
    "platform must not depend on business modules",
  ],
  [
    "shared → platform",
    "shared/ui/button.tsx",
    'import { cfg } from "@/platform/config/env";\nexport const x = 1;',
    "shared must not depend on platform infrastructure",
  ],
  [
    "shared → business module",
    "shared/util/x.ts",
    'import { News } from "@/modules/publishing";\nexport const x = 1;',
    "shared must not depend on business modules",
  ],
  [
    "client component → platform infrastructure",
    "modules/publishing/presentation/news-editor.tsx",
    '"use client";\nimport { db } from "@/platform/database/client";\nexport function C() { return null; }',
    "client components must not import platform infrastructure",
  ],
  [
    "client component → module infrastructure",
    "modules/publishing/presentation/news-editor.tsx",
    '"use client";\nimport { NewsRepo } from "../infrastructure/news-repository";\nexport function C() { return null; }',
    "client components must not import module application/infrastructure code",
  ],
  [
    "presentation → infrastructure",
    "modules/publishing/presentation/news-card.tsx",
    'import { NewsRepo } from "../infrastructure/news-repository";\nexport function C() { return null; }',
    "presentation must not depend on infrastructure",
  ],
  [
    "domain → presentation",
    "modules/publishing/domain/news.ts",
    'import { NewsCard } from "../presentation/news-card";\nexport const x = 1;',
    "domain may only depend on its own domain layer",
  ],
  // IMP-02 — persistence stack confinement.
  [
    "application → @prisma/adapter-pg",
    "modules/publishing/application/create-news.ts",
    'import { PrismaPg } from "@prisma/adapter-pg";\nexport const x = 1;',
    "layer must not depend on Prisma",
  ],
  [
    "presentation → @prisma/client",
    "modules/publishing/presentation/news-card.tsx",
    'import { PrismaClient } from "@prisma/client";\nexport function C() { return null; }',
    "layer must not depend on Prisma",
  ],
  [
    "shared → pg driver",
    "shared/util/x.ts",
    'import pg from "pg";\nexport const x = 1;',
    "layer must not depend on the PostgreSQL driver",
  ],
  [
    "shared → generated Prisma client (alias)",
    "shared/util/x.ts",
    'import { PrismaClient } from "@/platform/database/generated/client";\nexport const x = 1;',
    "shared must not depend on platform infrastructure",
  ],
  [
    "domain → generated Prisma client (relative)",
    "modules/publishing/domain/news.ts",
    'import { PrismaClient } from "../../../platform/database/generated/client";\nexport const x = 1;',
    "domain must not depend on platform infrastructure",
  ],
  [
    "presentation → generated Prisma client",
    "modules/media/presentation/card.tsx",
    'import { PrismaClient } from "@/platform/database/generated/client";\nexport function C() { return null; }',
    "presentation must not depend on platform infrastructure",
  ],
  // IMP-03 — runtime-platform confinement.
  [
    "domain → pino",
    "modules/publishing/domain/news.ts",
    'import { pino } from "pino";\nexport const x = 1;',
    "layer must not depend on Pino",
  ],
  [
    "application → @opentelemetry/sdk-node",
    "modules/publishing/application/create-news.ts",
    'import { NodeSDK } from "@opentelemetry/sdk-node";\nexport const x = 1;',
    "layer must not depend on OpenTelemetry",
  ],
  [
    "infrastructure → pino",
    "modules/publishing/infrastructure/news-repository.ts",
    'import { pino } from "pino";\nexport const x = 1;',
    "layer must not depend on Pino",
  ],
  [
    "module root → @opentelemetry/api",
    "modules/publishing/index.ts",
    'import { trace } from "@opentelemetry/api";\nexport const x = 1;',
    "layer must not depend on OpenTelemetry",
  ],
  [
    "shared → pino",
    "shared/util/x.ts",
    'import { pino } from "pino";\nexport const x = 1;',
    "layer must not depend on Pino",
  ],
  // IMP-04 — localization framework confinement.
  [
    "domain → next-intl",
    "modules/publishing/domain/news.ts",
    'import { useTranslations } from "next-intl";\nexport const x = 1;',
    "layer must not depend on the localization framework",
  ],
  [
    "application → next-intl/server",
    "modules/publishing/application/create-news.ts",
    'import { getTranslations } from "next-intl/server";\nexport const x = 1;',
    "layer must not depend on the localization framework",
  ],
  [
    "infrastructure → use-intl",
    "modules/publishing/infrastructure/news-repository.ts",
    'import { useLocale } from "use-intl";\nexport const x = 1;',
    "layer must not depend on the localization framework",
  ],
  [
    "module root → next-intl/navigation",
    "modules/publishing/index.ts",
    'import { Link } from "next-intl/navigation";\nexport const x = 1;',
    "layer must not depend on the localization framework",
  ],
  [
    "shared → next-intl",
    "shared/util/x.ts",
    'import { useTranslations } from "next-intl";\nexport const x = 1;',
    "layer must not depend on the localization framework",
  ],
  // IMP-05 — auth implementation confinement.
  [
    "domain → better-auth",
    "modules/publishing/domain/news.ts",
    'import { betterAuth } from "better-auth";\nexport const x = 1;',
    "auth implementation is confined to identity infrastructure (client APIs allowed in identity presentation)",
  ],
  [
    "application → @node-rs/argon2",
    "modules/publishing/application/create-news.ts",
    'import { hash } from "@node-rs/argon2";\nexport const x = 1;',
    "auth implementation is confined to identity infrastructure (client APIs allowed in identity presentation)",
  ],
  [
    "infrastructure (non-identity) → prisma adapter",
    "modules/publishing/infrastructure/news-repository.ts",
    'import { prismaAdapter } from "@better-auth/prisma-adapter";\nexport const x = 1;',
    "auth implementation is confined to identity infrastructure (client APIs allowed in identity presentation)",
  ],
  [
    "identity presentation → better-auth server surface",
    "modules/identity/presentation/login-form.tsx",
    'import { betterAuth } from "better-auth";\nexport function C() { return null; }',
    "auth implementation is confined to identity infrastructure (client APIs allowed in identity presentation)",
  ],
  [
    "presentation (non-identity) → better-auth client",
    "modules/publishing/presentation/news-card.tsx",
    'import { createAuthClient } from "better-auth/react";\nexport function C() { return null; }',
    "auth implementation is confined to identity infrastructure (client APIs allowed in identity presentation)",
  ],
  [
    "app → better-auth/next-js",
    "app/api/auth/route.ts",
    'import { toNextJsHandler } from "better-auth/next-js";\nexport const GET = 1;',
    "auth implementation is confined to identity infrastructure (client APIs allowed in identity presentation)",
  ],
  [
    "shared → better-auth",
    "shared/util/x.ts",
    'import { betterAuth } from "better-auth";\nexport const x = 1;',
    "auth implementation is confined to identity infrastructure (client APIs allowed in identity presentation)",
  ],
  [
    "module → process.env",
    "modules/publishing/application/create-news.ts",
    "export const url = process.env.DATABASE_URL;",
    "process.env access is centralized in src/platform/config",
  ],
  [
    "shared → process.env",
    "shared/util/x.ts",
    'const env = process["env"];\nexport const x = env;',
    "process.env access is centralized in src/platform/config",
  ],
  [
    "platform (non-config) → process.env",
    "platform/runtime/x.ts",
    "export const env = process.env.NODE_ENV;",
    "process.env access is centralized in src/platform/config",
  ],
];

const ALLOWED: Case[] = [
  [
    "app → module public contract",
    "app/news/page.tsx",
    'import { getNews } from "@/modules/publishing";\nexport default function P() { return null; }',
    null,
  ],
  [
    "app → platform and shared",
    "app/layout.tsx",
    'import { config } from "@/platform/config";\nimport { ok } from "@/shared/result";\nexport default function L() { return null; }',
    null,
  ],
  [
    "domain → domain-neutral shared",
    "modules/publishing/domain/news.ts",
    'import { ok } from "@/shared/result";\nexport const x = 1;',
    null,
  ],
  [
    "application → own domain (relative)",
    "modules/publishing/application/create-news.ts",
    'import { News } from "../domain/news";\nexport const x = 1;',
    null,
  ],
  [
    "application → other module public contract",
    "modules/publishing/application/create-news.ts",
    'import { getMedia } from "@/modules/media";\nexport const x = 1;',
    null,
  ],
  // IMP-05 — identity module is the auth implementation site.
  [
    "identity infrastructure → better-auth server + adapter + argon2",
    "modules/identity/infrastructure/auth/auth.ts",
    'import { betterAuth } from "better-auth";\nimport { APIError } from "better-auth/api";\nimport { twoFactor } from "better-auth/plugins";\nimport { toNextJsHandler } from "better-auth/next-js";\nimport { prismaAdapter } from "@better-auth/prisma-adapter";\nimport { hash } from "@node-rs/argon2";\nexport const x = 1;',
    null,
  ],
  [
    "identity presentation → better-auth client APIs + next-intl",
    "modules/identity/presentation/login-form.tsx",
    '"use client";\nimport { createAuthClient } from "better-auth/react";\nimport { twoFactorClient } from "better-auth/client/plugins";\nimport { useTranslations } from "next-intl";\nexport function C() { return null; }',
    null,
  ],
  [
    "identity presentation → own client (relative)",
    "modules/identity/presentation/login-form.tsx",
    '"use client";\nimport { authClient } from "./auth-client";\nexport function C() { return null; }',
    null,
  ],
  [
    "infrastructure → Prisma + platform + own domain",
    "modules/publishing/infrastructure/news-repository.ts",
    'import { PrismaClient } from "@prisma/client";\nimport { db } from "@/platform/database";\nimport { News } from "../domain/news";\nexport const x = 1;',
    null,
  ],
  [
    "module infrastructure → adapter-pg + generated client",
    "modules/publishing/infrastructure/db.ts",
    'import { PrismaPg } from "@prisma/adapter-pg";\nimport { PrismaClient } from "@/platform/database/generated/client";\nexport const x = 1;',
    null,
  ],
  [
    "platform database → pg + adapter + generated client",
    "platform/database/client.ts",
    'import pg from "pg";\nimport { PrismaPg } from "@prisma/adapter-pg";\nimport { PrismaClient } from "./generated/client";\nexport const x = 1;',
    null,
  ],
  [
    "module index → own internals",
    "modules/publishing/index.ts",
    'export { News } from "./domain/news";\nexport { createNews } from "./application/create-news";',
    null,
  ],
  [
    "client component → own presentation + shared",
    "modules/publishing/presentation/news-form.tsx",
    '"use client";\nimport { Label } from "./field";\nimport { ok } from "@/shared/result";\nexport function C() { return null; }',
    null,
  ],
  [
    "platform config → process.env (centralized seam)",
    "platform/config/server.ts",
    "export const env = process.env.DATABASE_URL;",
    null,
  ],
  [
    "platform runtime → config + logging + telemetry",
    "platform/runtime/x.ts",
    'import { getServerConfig } from "@/platform/config";\nimport { getLogger } from "@/platform/logging";\nimport { initTelemetry } from "@/platform/telemetry";\nexport const x = 1;',
    null,
  ],
  [
    "app route → platform abstractions",
    "app/api/health/ready/route.ts",
    'import { withRequestContext } from "@/platform/context";\nimport { problemResponse } from "@/platform/errors";\nexport const x = 1;',
    null,
  ],
  [
    "platform logging → pino (implementation allowed)",
    "platform/logging/logger.ts",
    'import { pino } from "pino";\nexport const x = 1;',
    null,
  ],
  [
    "presentation → next-intl (localized module UI)",
    "modules/publishing/presentation/news-card.tsx",
    'import { useTranslations } from "next-intl";\nexport function C() { return null; }',
    null,
  ],
  [
    "app → i18n routing and localized navigation",
    "app/[locale]/page.tsx",
    'import { Link } from "@/i18n/navigation";\nimport { routing } from "@/i18n/routing";\nexport default function P() { return null; }',
    null,
  ],
];

describe("architecture boundaries — detection", () => {
  it.each(VIOLATIONS)("flags %s", (_name, file, source, expectedRule) => {
    const violations = checkSource(file, source);
    expect(violations.map((v) => v.rule)).toContain(expectedRule);
  });

  it.each(ALLOWED)("allows %s", (_name, file, source) => {
    expect(checkSource(file, source)).toEqual([]);
  });
});
