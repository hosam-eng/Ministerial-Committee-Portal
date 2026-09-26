import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import ts from "typescript";

/**
 * Executable module-boundary checks for the B1 baseline
 * (docs/architecture/module-boundaries.md, ADR-002).
 *
 * Every import/export specifier in src/ is resolved to a real source area and
 * checked against the layer rules below. ESLint `no-restricted-imports`
 * provides the fast first-line check; this suite additionally resolves
 * relative imports, so boundary violations cannot bypass lint via `../..`.
 */

export const SRC_ROOT = fileURLToPath(new URL("../../src", import.meta.url));

const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".mts", ".cts"]);

export type ModuleLayer =
  "domain" | "application" | "infrastructure" | "presentation" | "root";

export type SourceArea =
  | { kind: "app" }
  | { kind: "module"; module: string; layer: ModuleLayer }
  | { kind: "platform" }
  | { kind: "shared" }
  | { kind: "styles" }
  | { kind: "root" };

export interface ImportEdge {
  /** Resolved specifier as written in the source file. */
  specifier: string;
  /** Posix path of the importer relative to src/ (e.g. "modules/news/domain/a.ts"). */
  importerRel: string;
  /** Posix path of the resolved target relative to src/, when internal. */
  targetRel?: string;
  isTypeOnly: boolean;
}

export interface Violation {
  file: string;
  specifier: string;
  rule: string;
}

export function toPosix(p: string): string {
  return p.split(path.sep).join("/");
}

/** Classify a src/-relative posix path into its architectural area. */
export function classify(rel: string): SourceArea {
  const seg = rel.split("/");
  const [head, second, third] = seg;
  if (head === "app") return { kind: "app" };
  if (head === "platform") return { kind: "platform" };
  if (head === "shared") return { kind: "shared" };
  if (head === "styles") return { kind: "styles" };
  if (head === "modules" && seg.length >= 2) {
    const moduleName = second.replace(/\.[^.]+$/, "");
    const layer = seg.length >= 3 ? third.replace(/\.[^.]+$/, "") : "index";
    if (
      layer === "domain" ||
      layer === "application" ||
      layer === "infrastructure" ||
      layer === "presentation"
    ) {
      return { kind: "module", module: moduleName, layer };
    }
    return { kind: "module", module: moduleName, layer: "root" };
  }
  return { kind: "root" };
}

/** True when the resolved path is the module's public surface (module dir or index). */
function isModulePublicSurface(rel: string): boolean {
  const seg = rel.split("/");
  return (
    seg[0] === "modules" &&
    seg.length >= 2 &&
    (seg.length === 2 || (seg.length === 3 && /^index(\.[^.]+)?$/.test(seg[2])))
  );
}

interface ResolvedSpecifier {
  internal: boolean;
  /** src/-relative posix path (without extension guarantee). */
  rel?: string;
}

function resolveSpecifier(
  specifier: string,
  importerAbs: string,
): ResolvedSpecifier {
  if (specifier.startsWith("@/")) {
    return { internal: true, rel: specifier.slice(2) };
  }
  if (specifier.startsWith(".")) {
    const abs = path.resolve(path.dirname(importerAbs), specifier);
    const rel = toPosix(path.relative(SRC_ROOT, abs));
    if (rel.startsWith("..")) return { internal: false };
    return { internal: true, rel };
  }
  return { internal: false };
}

/** Collect static/dynamic import and re-export specifiers from a source file. */
export function collectEdges(fileAbs: string, content: string): ImportEdge[] {
  const importerRel = relativeToSrc(fileAbs);
  const sf = ts.createSourceFile(
    fileAbs,
    content,
    ts.ScriptTarget.Latest,
    true,
  );
  const edges: ImportEdge[] = [];

  const push = (
    node: ts.Node,
    specifier: ts.Expression | undefined,
    isTypeOnly: boolean,
  ) => {
    if (specifier && ts.isStringLiteralLike(specifier)) {
      edges.push({
        specifier: specifier.text,
        importerRel,
        isTypeOnly,
      });
    }
    void node;
  };

  const visit = (node: ts.Node) => {
    if (ts.isImportDeclaration(node)) {
      push(node, node.moduleSpecifier, Boolean(node.importClause?.isTypeOnly));
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier) {
      push(node, node.moduleSpecifier, node.isTypeOnly);
    } else if (
      ts.isCallExpression(node) &&
      node.arguments.length === 1 &&
      ts.isStringLiteralLike(node.arguments[0])
    ) {
      const expr = node.expression;
      if (
        expr.kind === ts.SyntaxKind.ImportKeyword ||
        expr.getText(sf) === "require"
      ) {
        push(node, node.arguments[0], false);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return edges;
}

export function relativeToSrc(fileAbs: string): string {
  return toPosix(path.relative(SRC_ROOT, fileAbs));
}

function hasUseClientDirective(content: string): boolean {
  const first = content.trimStart().slice(0, 40);
  return first.startsWith('"use client"') || first.startsWith("'use client'");
}

const EXTERNAL_BANS: { pattern: RegExp; rule: string }[] = [
  { pattern: /^next(\/.*)?$/, rule: "layer must not depend on Next.js" },
  { pattern: /^react(\/.*)?$/, rule: "layer must not depend on React" },
  { pattern: /^react-dom(\/.*)?$/, rule: "layer must not depend on React DOM" },
  { pattern: /^@prisma(\/.*)?$/, rule: "layer must not depend on Prisma" },
  { pattern: /^prisma$/, rule: "layer must not depend on Prisma" },
  { pattern: /^pg$/, rule: "layer must not depend on the PostgreSQL driver" },
  {
    pattern: /^server-only$/,
    rule: "layer must not import server-only markers",
  },
];

const PERSISTENCE_BANS: { pattern: RegExp; rule: string }[] = [
  { pattern: /^@prisma(\/.*)?$/, rule: "layer must not depend on Prisma" },
  { pattern: /^prisma$/, rule: "layer must not depend on Prisma" },
  { pattern: /^pg$/, rule: "layer must not depend on the PostgreSQL driver" },
];

const OBSERVABILITY_BANS: { pattern: RegExp; rule: string }[] = [
  { pattern: /^pino(\/.*)?$/, rule: "layer must not depend on Pino" },
  {
    pattern: /^@opentelemetry(\/.*)?$/,
    rule: "layer must not depend on OpenTelemetry",
  },
];

function externalViolation(area: SourceArea, specifier: string): string | null {
  let bans: { pattern: RegExp; rule: string }[] = [];
  if (area.kind === "module") {
    // IMP-03: no module layer may import observability implementation
    // packages. Persistence imports stay confined per the IMP-02
    // contract (infrastructure may use the platform persistence stack).
    bans =
      area.layer === "domain" || area.layer === "application"
        ? [...EXTERNAL_BANS, ...OBSERVABILITY_BANS]
        : area.layer === "infrastructure"
          ? [...OBSERVABILITY_BANS]
          : [...PERSISTENCE_BANS, ...OBSERVABILITY_BANS];
  } else if (area.kind === "shared") {
    bans = [...PERSISTENCE_BANS, ...OBSERVABILITY_BANS];
  }
  const hit = bans.find((b) => b.pattern.test(specifier));
  return hit ? hit.rule : null;
}

/** True when the source reads process.env outside platform/config. */
function hasEnvAccess(content: string, fileAbs: string): boolean {
  const sf = ts.createSourceFile(
    fileAbs,
    content,
    ts.ScriptTarget.Latest,
    true,
  );
  let found = false;
  const visit = (node: ts.Node) => {
    if (
      ts.isPropertyAccessExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "process" &&
      node.name.text === "env"
    ) {
      found = true;
    }
    if (
      ts.isElementAccessExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "process" &&
      ts.isStringLiteralLike(node.argumentExpression) &&
      node.argumentExpression.text === "env"
    ) {
      found = true;
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return found;
}

/**
 * Internal target rule. Returns a violation description or null.
 * `target` is the classified resolved path inside src/.
 */
function internalViolation(
  source: SourceArea,
  target: SourceArea,
  targetRel: string,
): string | null {
  // Nobody imports application code from the delivery layer upward.
  if (source.kind === "app" || source.kind === "root") {
    if (target.kind === "module" && !isModulePublicSurface(targetRel)) {
      return "app must consume modules only through their public contract (@/modules/<name>)";
    }
    return null;
  }

  if (source.kind === "platform") {
    if (target.kind === "app")
      return "platform must not depend on the delivery layer";
    if (target.kind === "module")
      return "platform must not depend on business modules";
    return null;
  }

  if (source.kind === "shared") {
    if (target.kind === "app")
      return "shared must not depend on the delivery layer";
    if (target.kind === "module")
      return "shared must not depend on business modules";
    if (target.kind === "platform")
      return "shared must not depend on platform infrastructure";
    return null;
  }

  if (source.kind === "styles") {
    return target.kind === "styles" ? null : "styles must not depend on code";
  }

  // source is a module
  if (target.kind === "app")
    return "modules must not depend on the delivery layer";
  if (target.kind === "styles") return "modules must not depend on styles";

  if (target.kind === "module") {
    const sameModule = target.module === source.module;

    if (!sameModule) {
      if (source.layer === "domain") {
        return "domain must not depend on other modules";
      }
      if (!isModulePublicSurface(targetRel)) {
        return "cross-module imports must use the target module's public contract";
      }
      return null;
    }

    // Same module — layer direction rules.
    switch (source.layer) {
      case "domain":
        return target.layer === "domain"
          ? null
          : "domain may only depend on its own domain layer";
      case "application":
        if (
          target.layer === "infrastructure" ||
          target.layer === "presentation"
        ) {
          return "application must not depend on infrastructure or presentation";
        }
        return null;
      case "presentation":
        if (target.layer === "infrastructure") {
          return "presentation must not depend on infrastructure";
        }
        return null;
      case "infrastructure":
        if (target.layer === "presentation") {
          return "infrastructure must not depend on presentation";
        }
        return null;
      case "root":
        return null; // module index may re-export own internals
    }
  }

  if (target.kind === "platform") {
    if (source.layer === "infrastructure" || source.layer === "root")
      return null;
    return `${source.layer} must not depend on platform infrastructure`;
  }

  return null; // shared / other neutral targets
}

/** Extra bans for files with a "use client" directive. */
function clientBoundaryViolation(target: SourceArea): string | null {
  if (target.kind === "platform")
    return "client components must not import platform infrastructure";
  if (
    target.kind === "module" &&
    (target.layer === "infrastructure" || target.layer === "application")
  ) {
    return "client components must not import module application/infrastructure code";
  }
  return null;
}

export function checkSource(
  importerRelPosix: string,
  content: string,
): Violation[] {
  const importerAbs = path.join(
    SRC_ROOT,
    importerRelPosix.split("/").join(path.sep),
  );
  const source = classify(importerRelPosix);
  const isClient = hasUseClientDirective(content);
  const violations: Violation[] = [];

  // IMP-03: env access is centralized in src/platform/config — modules,
  // shared, and the rest of platform must not read process.env.
  const envAllowed =
    importerRelPosix.startsWith("platform/config/") ||
    importerRelPosix === "instrumentation.ts";
  if (!envAllowed && hasEnvAccess(content, importerAbs)) {
    violations.push({
      file: importerRelPosix,
      specifier: "process.env",
      rule: "process.env access is centralized in src/platform/config",
    });
  }

  for (const edge of collectEdges(importerAbs, content)) {
    const resolved = resolveSpecifier(edge.specifier, importerAbs);

    if (!resolved.internal || !resolved.rel) {
      const rule = externalViolation(source, edge.specifier);
      if (rule)
        violations.push({
          file: importerRelPosix,
          specifier: edge.specifier,
          rule,
        });
      if (isClient && edge.specifier === "server-only") {
        violations.push({
          file: importerRelPosix,
          specifier: edge.specifier,
          rule: "client modules must not import server-only",
        });
      }
      continue;
    }

    const target = classify(resolved.rel);
    const rule = internalViolation(source, target, resolved.rel);
    if (rule) {
      violations.push({
        file: importerRelPosix,
        specifier: edge.specifier,
        rule,
      });
    }
    if (isClient) {
      const clientRule = clientBoundaryViolation(target);
      if (clientRule) {
        violations.push({
          file: importerRelPosix,
          specifier: edge.specifier,
          rule: clientRule,
        });
      }
    }
  }

  return violations;
}

export function analyzeFile(fileAbs: string): Violation[] {
  const content = readFileSync(fileAbs, "utf8");
  return checkSource(relativeToSrc(fileAbs), content);
}

export function listSourceFiles(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (SOURCE_EXTENSIONS.has(path.extname(entry.name))) out.push(full);
    }
  };
  walk(root);
  return out.sort();
}
