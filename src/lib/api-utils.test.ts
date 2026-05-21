// ============================================================
// Tests for shared API utilities
// ============================================================

import { describe, it, expect, vi, beforeEach } from "vitest";
import { createErrorResponse, parseJsonBody, hasRateLimitErrors } from "./api-utils";
import { NextRequest } from "next/server";

describe("createErrorResponse", () => {
  it("returns a JSON response with the correct status and body", async () => {
    const res = createErrorResponse("TEST_ERROR", "Something went wrong", 400);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("TEST_ERROR");
    expect(body.message).toBe("Something went wrong");
  });

  it("includes extra fields when provided", async () => {
    const res = createErrorResponse("LIMIT", "Too many", 429, { retryAfter: 60 });
    const body = await res.json();
    expect(body.retryAfter).toBe(60);
    expect(body.error).toBe("LIMIT");
  });

  it("returns 500 status for server errors", async () => {
    const res = createErrorResponse("INTERNAL", "Server error", 500);
    expect(res.status).toBe(500);
  });
});

describe("parseJsonBody", () => {
  it("parses valid JSON body", async () => {
    const req = new NextRequest("http://localhost/api/test", {
      method: "POST",
      body: JSON.stringify({ name: "test" }),
      headers: { "Content-Type": "application/json" },
    });
    const result = await parseJsonBody<{ name: string }>(req);
    expect(result.error).toBeUndefined();
    expect(result.data).toEqual({ name: "test" });
  });

  it("returns error response for invalid JSON", async () => {
    const req = new NextRequest("http://localhost/api/test", {
      method: "POST",
      body: "not-json",
      headers: { "Content-Type": "application/json" },
    });
    const result = await parseJsonBody(req);
    expect(result.data).toBeUndefined();
    expect(result.error).toBeDefined();
    expect(result.error!.status).toBe(400);
  });

  it("returns error response for empty body", async () => {
    const req = new NextRequest("http://localhost/api/test", {
      method: "POST",
    });
    const result = await parseJsonBody(req);
    expect(result.error).toBeDefined();
  });
});

describe("hasRateLimitErrors", () => {
  it("detects 429 errors", () => {
    expect(hasRateLimitErrors(["FMP 429: Too Many Requests"])).toBe(true);
  });

  it("detects 402 errors", () => {
    expect(hasRateLimitErrors(["FMP 402: Payment Required"])).toBe(true);
  });

  it("detects 'limit reach' errors (case insensitive)", () => {
    expect(hasRateLimitErrors(["API Limit Reached for today"])).toBe(true);
  });

  it("returns false for non-rate-limit errors", () => {
    expect(hasRateLimitErrors(["FMP 500: Internal Server Error"])).toBe(false);
  });

  it("returns false for empty array", () => {
    expect(hasRateLimitErrors([])).toBe(false);
  });

  it("returns true if any error matches", () => {
    expect(
      hasRateLimitErrors(["normal error", "another error", "FMP 429: rate limited"])
    ).toBe(true);
  });
});
