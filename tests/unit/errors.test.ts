import { describe, expect, it } from "vitest";

import { AppError, problemResponse, toProblemDetails } from "@/platform/errors";

describe("AppError", () => {
  it("carries stable code, status, and cause", () => {
    const cause = new Error("pg connection refused at /var/run/secret");
    const error = new AppError("DEPENDENCY_UNAVAILABLE", {
      cause,
      publicMessage: "A required dependency is unavailable.",
    });
    expect(error.code).toBe("DEPENDENCY_UNAVAILABLE");
    expect(error.httpStatus).toBe(503);
    expect(error.cause).toBe(cause);
  });

  it("maps every code to a deterministic status", () => {
    expect(new AppError("VALIDATION_FAILED").httpStatus).toBe(400);
    expect(new AppError("RESOURCE_NOT_FOUND").httpStatus).toBe(404);
    expect(new AppError("INTERNAL_ERROR").httpStatus).toBe(500);
  });
});

describe("RFC 9457 problem details", () => {
  it("serializes AppError with code, title, status, requestId", () => {
    const body = toProblemDetails(
      new AppError("VALIDATION_FAILED", {
        publicMessage: "The request payload is invalid.",
      }),
      { requestId: "req-abc", instance: "/api/health/ready" },
    );
    expect(body).toEqual({
      type: "about:blank",
      title: "Bad Request",
      status: 400,
      detail: "The request payload is invalid.",
      code: "VALIDATION_FAILED",
      requestId: "req-abc",
      instance: "/api/health/ready",
    });
  });

  it("maps unexpected errors to a generic 500 without leaking internals", () => {
    const secret = "SELECT * FROM users WHERE password='hunter2'";
    const body = toProblemDetails(new Error(secret), {
      requestId: "req-1",
    });
    expect(body.code).toBe("INTERNAL_ERROR");
    expect(body.status).toBe(500);
    expect(body.detail).toBe("An unexpected error occurred.");
    expect(JSON.stringify(body)).not.toContain(secret);
    expect(JSON.stringify(body)).not.toContain("stack");
  });

  it("produces application/problem+json responses", async () => {
    const response = problemResponse(
      new AppError("DEPENDENCY_UNAVAILABLE", {
        publicMessage: "A required dependency is currently unavailable.",
      }),
      { requestId: "req-99", instance: "/api/health/ready" },
    );
    expect(response.status).toBe(503);
    expect(response.headers.get("content-type")).toBe(
      "application/problem+json",
    );
    expect(response.headers.get("x-request-id")).toBe("req-99");
    expect(response.headers.get("cache-control")).toBe("no-store");
    const body = await response.json();
    expect(body.code).toBe("DEPENDENCY_UNAVAILABLE");
  });
});
