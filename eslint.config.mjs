import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import eslintConfigPrettier from "eslint-config-prettier";

/**
 * Architecture boundary rules (ADR-002 / docs/architecture/module-boundaries.md).
 *
 * These are duplicated as executable architecture tests in
 * tests/architecture/ — keep both in sync.
 */

const MODULE_PUBLIC_CONTRACT = {
  group: ["@/modules/*/**"],
  message:
    "Cross-module imports must go through the module's public contract (@/modules/<name>). Use relative imports for a module's own internals.",
};

const NO_FRAMEWORK = {
  group: [
    "next",
    "next/*",
    "react",
    "react/*",
    "react-dom",
    "react-dom/*",
    "server-only",
  ],
  message: "This layer must not depend on Next.js/React.",
};

const NO_PERSISTENCE = {
  group: ["prisma", "@prisma/*", "pg"],
  message: "This layer must not depend on ORM/database code.",
};

const NO_APP = {
  group: ["@/app", "@/app/**", "**/app/**"],
  message: "This layer must not depend on the Next.js delivery layer.",
};

const NO_PLATFORM = {
  group: ["@/platform", "@/platform/**", "**/platform/**"],
  message: "This layer must not depend on concrete platform infrastructure.",
};

const NO_INFRASTRUCTURE = {
  group: ["@/modules/*/infrastructure/**", "**/infrastructure/**"],
  message:
    "This layer must not depend on module infrastructure implementations.",
};

const NO_MODULES = {
  group: ["@/modules", "@/modules/**", "**/modules/**"],
  message: "This layer must not depend on business modules.",
};

const SRC_FILES = ["src/**/*.{ts,tsx,mts,cts}"];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  eslintConfigPrettier,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "coverage/**",
    "playwright-report/**",
    "test-results/**",
    "next-env.d.ts",
    "src/platform/database/generated/**",
  ]),
  {
    files: SRC_FILES,
    rules: {
      // Global: nobody may deep-import into a module's internals.
      "no-restricted-imports": [
        "error",
        { patterns: [MODULE_PUBLIC_CONTRACT] },
      ],
    },
  },
  {
    // Domain: pure business rules only.
    files: ["src/modules/*/domain/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            MODULE_PUBLIC_CONTRACT,
            NO_FRAMEWORK,
            NO_PERSISTENCE,
            NO_APP,
            NO_PLATFORM,
            NO_INFRASTRUCTURE,
          ],
        },
      ],
    },
  },
  {
    // Application: use cases and ports; domain + domain-neutral shared only.
    files: ["src/modules/*/application/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            MODULE_PUBLIC_CONTRACT,
            NO_FRAMEWORK,
            NO_PERSISTENCE,
            NO_APP,
            NO_PLATFORM,
            NO_INFRASTRUCTURE,
          ],
        },
      ],
    },
  },
  {
    // Presentation: module UI; calls use cases, never infrastructure internals.
    files: ["src/modules/*/presentation/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            MODULE_PUBLIC_CONTRACT,
            NO_PERSISTENCE,
            NO_APP,
            NO_PLATFORM,
            NO_INFRASTRUCTURE,
          ],
        },
      ],
    },
  },
  {
    // Platform: technical infrastructure; never depends on business modules.
    files: ["src/platform/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        { patterns: [MODULE_PUBLIC_CONTRACT, NO_APP, NO_MODULES] },
      ],
    },
  },
  {
    // Shared: domain-neutral code only.
    files: ["src/shared/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            MODULE_PUBLIC_CONTRACT,
            NO_APP,
            NO_MODULES,
            NO_PLATFORM,
            NO_PERSISTENCE,
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
