import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";
import ts from "typescript";

import { SRC_ROOT } from "./boundaries";
import {
  findForeignPrismaDelegateAccess,
  loadModelOwnership,
  scanModuleTree,
} from "./prisma-ownership";

const ownership = loadModelOwnership();

describe("prisma model ownership", () => {
  it("maps Identity and Publishing models to their modules", () => {
    expect(ownership.delegateOwner.get("userRole")).toBe("identity");
    expect(ownership.delegateOwner.get("role")).toBe("identity");
    expect(ownership.delegateOwner.get("permission")).toBe("identity");
    expect(ownership.delegateOwner.get("rolePermission")).toBe("identity");
    expect(ownership.delegateOwner.get("news")).toBe("publishing");
    expect(ownership.delegateOwner.get("managedPage")).toBe("managed-pages");
  });
});

describe("foreign prisma delegate access", () => {
  it("detects Publishing access to Identity UserRole", () => {
    const violations = findForeignPrismaDelegateAccess(
      "modules/publishing/news-service.ts",
      "export async function bad(db: { userRole: { findMany: () => unknown } }) {\n  return db.userRole.findMany();\n}\n",
      ownership,
    );
    expect(violations).toEqual([
      {
        file: "modules/publishing/news-service.ts",
        delegate: "userRole",
        operation: "findMany",
        owner: "identity",
        accessor: "publishing",
      },
    ]);
  });

  it("detects Publishing access to Identity Role", () => {
    const violations = findForeignPrismaDelegateAccess(
      "modules/publishing/news-service.ts",
      "export async function bad(prisma: { role: { findUnique: () => unknown } }) {\n  return prisma.role.findUnique();\n}\n",
      ownership,
    );
    expect(violations.map((item) => item.delegate)).toEqual(["role"]);
    expect(violations[0]?.owner).toBe("identity");
  });

  it("detects Identity access to Publishing News", () => {
    const violations = findForeignPrismaDelegateAccess(
      "modules/identity/infrastructure/rbac/store.ts",
      "export async function bad(client: { news: { findFirst: () => unknown } }) {\n  return client.news.findFirst();\n}\n",
      ownership,
    );
    expect(violations.map((item) => [item.delegate, item.owner])).toEqual([
      ["news", "publishing"],
    ]);
  });

  it("allows Managed Pages access to Managed Pages", () => {
    expect(
      findForeignPrismaDelegateAccess(
        "modules/managed-pages/infrastructure/managed-page-service.ts",
        "export async function ok(tx: { managedPage: { create: () => unknown } }) {\n  return tx.managedPage.create();\n}\n",
        ownership,
      ),
    ).toEqual([]);
  });

  it("denies Managed Pages access to Identity persistence", () => {
    const violations = findForeignPrismaDelegateAccess(
      "modules/managed-pages/infrastructure/managed-page-service.ts",
      "export async function bad(tx: { userRole: { findMany: () => unknown } }) {\n  return tx.userRole.findMany();\n}\n",
      ownership,
    );
    expect(
      violations.map((item) => [item.delegate, item.owner, item.accessor]),
    ).toEqual([["userRole", "identity", "managed-pages"]]);
  });

  it("denies Publishing access to Managed Pages persistence", () => {
    const violations = findForeignPrismaDelegateAccess(
      "modules/publishing/news-service.ts",
      "export async function bad(tx: { managedPage: { findMany: () => unknown } }) {\n  return tx.managedPage.findMany();\n}\n",
      ownership,
    );
    expect(violations.map((item) => item.owner)).toEqual(["managed-pages"]);
  });

  it("denies Identity access to Managed Pages persistence", () => {
    const violations = findForeignPrismaDelegateAccess(
      "modules/identity/infrastructure/rbac/store.ts",
      "export async function bad(tx: { managedPage: { findFirst: () => unknown } }) {\n  return tx.managedPage.findFirst();\n}\n",
      ownership,
    );
    expect(violations.map((item) => [item.delegate, item.accessor])).toEqual([
      ["managedPage", "identity"],
    ]);
  });

  it("allows Publishing access to Publishing News", () => {
    expect(
      findForeignPrismaDelegateAccess(
        "modules/publishing/news-service.ts",
        "export async function ok(tx: { news: { create: () => unknown } }) {\n  return tx.news.create();\n}\n",
        ownership,
      ),
    ).toEqual([]);
  });

  it("allows Identity access to Identity Role", () => {
    expect(
      findForeignPrismaDelegateAccess(
        "modules/identity/infrastructure/rbac/store.ts",
        "export async function ok(database: { prisma: { role: { findUnique: () => unknown } } }) {\n  return database.prisma.role.findUnique();\n}\n",
        ownership,
      ),
    ).toEqual([]);
  });

  it("finds no foreign Prisma delegate access in the current module tree", () => {
    expect(scanModuleTree(ownership)).toEqual([]);
  });
});

describe("identity public authorization contract", () => {
  it("exports requireActorPermission without a database or Prisma parameter", () => {
    const index = readFileSync(
      path.join(SRC_ROOT, "modules/identity/index.ts"),
      "utf8",
    );
    expect(index).toContain("requireActorPermission");

    const service = readFileSync(
      path.join(SRC_ROOT, "modules/identity/infrastructure/rbac/service.ts"),
      "utf8",
    );
    const source = ts.createSourceFile(
      "service.ts",
      service,
      ts.ScriptTarget.Latest,
      true,
    );
    let parameters: string[] = [];
    const visit = (node: ts.Node) => {
      if (
        ts.isFunctionDeclaration(node) &&
        node.name?.text === "requireActorPermission"
      ) {
        parameters = node.parameters.map((parameter) =>
          parameter.getText(source),
        );
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
    expect(parameters).toEqual([
      "actorId: string",
      "permission: PermissionKey",
    ]);
  });
});
