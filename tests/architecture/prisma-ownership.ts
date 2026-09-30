import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import ts from "typescript";

import { listSourceFiles, relativeToSrc, SRC_ROOT } from "./boundaries";

/**
 * Foreign Prisma model-ownership guard (ARCH-1). Architecture tests only.
 *
 * Ownership comes from the Prisma schema files plus the manifest below.
 * A module may call Prisma delegates for models declared in its own schema
 * file. Calling a delegate owned by another module is a violation.
 *
 * Matcher assumptions:
 * - A hit is a call whose callee is `<receiver>.<delegate>.<operation>()`
 *   or the string-index form `<receiver>["delegate"]["operation"]()`.
 * - `<receiver>` may be any expression (`tx`, `prisma`, `client`,
 *   `database.prisma`, a call, and so on). Renaming the local does not
 *   hide the access.
 * - `<delegate>` must be the Prisma Client property for a known model
 *   (PascalCase model name, first character lowercased). `@@map` changes
 *   the SQL table name only, not this client property.
 * - `<operation>` must be one of the Prisma model CRUD / aggregate methods
 *   listed in DELEGATE_OPERATIONS. Ordinary property reads
 *   (`row.permission.key`, relation selects) are not delegate calls.
 * - Local aliases (`const rows = tx.userRole; rows.findMany()`) are not
 *   followed. The guarded pattern is the direct delegate call.
 * - Raw SQL is out of scope for this guard.
 */

/** Schema file name → owning module. Root `schema.prisma` has no models. */
export const PRISMA_SCHEMA_OWNERS: Readonly<Record<string, string>> = {
  "identity.prisma": "identity",
  "publishing.prisma": "publishing",
  "managed-pages.prisma": "managed-pages",
  "reference-data.prisma": "reference-data",
  "site-settings.prisma": "site-settings",
};

const SCHEMA_DIR = fileURLToPath(
  new URL("../../prisma/schema", import.meta.url),
);

const MODEL_PATTERN = /^model\s+([A-Za-z_][A-Za-z0-9_]*)\b/gm;

/** Prisma Client model operations this guard treats as delegate use. */
export const DELEGATE_OPERATIONS: ReadonlySet<string> = new Set([
  "findUnique",
  "findUniqueOrThrow",
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "create",
  "createMany",
  "createManyAndReturn",
  "update",
  "updateMany",
  "updateManyAndReturn",
  "upsert",
  "delete",
  "deleteMany",
  "count",
  "aggregate",
  "groupBy",
]);

export interface ForeignPrismaAccess {
  file: string;
  delegate: string;
  operation: string;
  owner: string;
  accessor: string;
}

export interface ModelOwnership {
  /** Prisma Client delegate name → owning module. */
  readonly delegateOwner: ReadonlyMap<string, string>;
}

/** Prisma's default client property for a PascalCase model name. */
export function prismaDelegateName(modelName: string): string {
  return modelName.slice(0, 1).toLowerCase() + modelName.slice(1);
}

export function moduleOfSource(relPosix: string): string | null {
  const [root, moduleName] = relPosix.split("/");
  if (root !== "modules" || !moduleName) return null;
  return moduleName.replace(/\.[^.]+$/, "");
}

function modelNames(content: string): string[] {
  return [...content.matchAll(MODEL_PATTERN)].map((match) => match[1]);
}

/** Load delegate ownership from prisma/schema and the module manifest. */
export function loadModelOwnership(
  schemaDir: string = SCHEMA_DIR,
): ModelOwnership {
  const delegateOwner = new Map<string, string>();
  const files = readdirSync(schemaDir).filter((name) =>
    name.endsWith(".prisma"),
  );
  for (const file of files) {
    const models = modelNames(readFileSync(path.join(schemaDir, file), "utf8"));
    if (models.length === 0) continue;
    const owner = PRISMA_SCHEMA_OWNERS[file];
    if (!owner) {
      throw new Error(
        `Prisma schema ${file} declares models but has no module owner in PRISMA_SCHEMA_OWNERS`,
      );
    }
    for (const model of models) {
      const delegate = prismaDelegateName(model);
      const existing = delegateOwner.get(delegate);
      if (existing && existing !== owner) {
        throw new Error(
          `Prisma delegate ${delegate} is claimed by both ${existing} and ${owner}`,
        );
      }
      delegateOwner.set(delegate, owner);
    }
  }
  return { delegateOwner };
}

function propertyName(node: ts.Node): string | null {
  if (ts.isPropertyAccessExpression(node) || ts.isPropertyAccessChain(node)) {
    return node.name.text;
  }
  if (
    (ts.isElementAccessExpression(node) || ts.isElementAccessChain(node)) &&
    node.argumentExpression &&
    ts.isStringLiteralLike(node.argumentExpression)
  ) {
    return node.argumentExpression.text;
  }
  return null;
}

function accessTarget(node: ts.Node): ts.Expression | null {
  if (
    ts.isPropertyAccessExpression(node) ||
    ts.isPropertyAccessChain(node) ||
    ts.isElementAccessExpression(node) ||
    ts.isElementAccessChain(node)
  ) {
    return node.expression;
  }
  return null;
}

function delegateCall(
  node: ts.CallExpression,
): { delegate: string; operation: string } | null {
  const operation = propertyName(node.expression);
  const target = accessTarget(node.expression);
  if (!operation || !target || !DELEGATE_OPERATIONS.has(operation)) return null;
  const delegate = propertyName(target);
  if (!delegate) return null;
  return { delegate, operation };
}

/**
 * Foreign delegate calls in one module source file.
 * `file` is a src/-relative posix path such as `modules/publishing/news-service.ts`.
 */
export function findForeignPrismaDelegateAccess(
  file: string,
  content: string,
  ownership: ModelOwnership,
): ForeignPrismaAccess[] {
  const accessor = moduleOfSource(file);
  if (!accessor) return [];
  const sourceFile = ts.createSourceFile(
    file,
    content,
    ts.ScriptTarget.Latest,
    true,
  );
  const violations: ForeignPrismaAccess[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node)) {
      const call = delegateCall(node);
      const owner = call
        ? ownership.delegateOwner.get(call.delegate)
        : undefined;
      if (call && owner && owner !== accessor) {
        violations.push({
          file,
          delegate: call.delegate,
          operation: call.operation,
          owner,
          accessor,
        });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return violations;
}

/** Scan src/modules for foreign Prisma delegate calls. */
export function scanModuleTree(
  ownership: ModelOwnership = loadModelOwnership(),
): ForeignPrismaAccess[] {
  return listSourceFiles(SRC_ROOT).flatMap((fileAbs) => {
    const file = relativeToSrc(fileAbs);
    if (!moduleOfSource(file)) return [];
    return findForeignPrismaDelegateAccess(
      file,
      readFileSync(fileAbs, "utf8"),
      ownership,
    );
  });
}
