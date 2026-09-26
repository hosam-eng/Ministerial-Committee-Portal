import { describe, expect, it } from "vitest";

import { err, isOk, ok } from "@/shared/result";

describe("shared Result primitive", () => {
  it("ok() produces a success result carrying the value", () => {
    const result = ok(42);
    expect(isOk(result)).toBe(true);
    expect(result).toEqual({ ok: true, value: 42 });
  });

  it("err() produces a failure result carrying the error", () => {
    const result = err("boom");
    expect(isOk(result)).toBe(false);
    expect(result).toEqual({ ok: false, error: "boom" });
  });
});
