import { describe, expect, it } from "vitest";

import {
  hashPassword,
  verifyPassword,
} from "@/modules/identity/infrastructure/auth/password";

describe("identity password hashing (Argon2id)", () => {
  it("produces an Argon2id PHC string with the pinned parameters", async () => {
    const hashed = await hashPassword("correct horse battery staple!");
    expect(hashed).toMatch(/^\$argon2id\$v=19\$m=65536,t=3,p=4\$/);
  });

  it("verifies a correct password and rejects a wrong one", async () => {
    const hashed = await hashPassword("s3cure-local-password");
    await expect(
      verifyPassword({ hash: hashed, password: "s3cure-local-password" }),
    ).resolves.toBe(true);
    await expect(
      verifyPassword({ hash: hashed, password: "wrong-password" }),
    ).resolves.toBe(false);
  });

  it("fails closed on a malformed stored hash", async () => {
    await expect(
      verifyPassword({ hash: "not-a-phc-string", password: "x" }),
    ).resolves.toBe(false);
  });

  it("produces distinct salts per hash", async () => {
    const a = await hashPassword("same-password-value!");
    const b = await hashPassword("same-password-value!");
    expect(a).not.toBe(b);
  });
});
