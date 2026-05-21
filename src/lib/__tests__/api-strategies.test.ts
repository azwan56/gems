// ============================================================
// Integration Tests: /api/strategies route (GET & POST)
// ============================================================

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ---- Mock Auth ----
vi.mock("@/lib/auth-middleware", () => ({
  requirePremium: vi.fn().mockResolvedValue({
    success: true,
    user: {
      uid: "test-user",
      email: "test@test.com",
      planType: "paid",
      isPremium: true,
      isExpired: false,
    },
  }),
}));

// ---- Mock user-store ----
vi.mock("@/lib/user-store", () => ({
  saveStrategy: vi.fn().mockImplementation(async (_uid: string, strategy: Record<string, unknown>) => ({
    id: "mock-strategy-id",
    userId: _uid,
    ...strategy,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  })),
}));

import { GET, POST } from "@/app/api/strategies/route";

describe("/api/strategies", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ---- GET Tests ----

  it("GET should return all strategy presets", async () => {
    const req = new NextRequest("http://localhost/api/strategies");
    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.strategies).toBeDefined();
    expect(Array.isArray(body.strategies)).toBe(true);
    expect(body.strategies.length).toBeGreaterThanOrEqual(3);

    // Each preset should have an id and name
    for (const preset of body.strategies) {
      expect(preset.id).toBeDefined();
      expect(preset.name).toBeDefined();
      expect(preset.defaultFilters).toBeDefined();
    }
  });

  it("GET should include value, large_growth, small_growth presets", async () => {
    const res = await GET();
    const body = await res.json();

    const ids = body.strategies.map((s: { id: string }) => s.id);
    expect(ids).toContain("value");
    expect(ids).toContain("large_growth");
    expect(ids).toContain("small_growth");
  });

  // ---- POST Tests ----

  it("POST should save a custom strategy", async () => {
    const req = new NextRequest("http://localhost/api/strategies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "My Custom Strategy",
        baseStrategy: "value",
        filters: [{ field: "peRatio", operator: "lt", value: 15 }],
      }),
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.strategy).toBeDefined();
    expect(body.strategy.name).toBe("My Custom Strategy");
    expect(body.strategy.baseStrategy).toBe("value");
    expect(body.strategy.userId).toBe("test-user");
  });

  it("POST should return 400 when name is missing", async () => {
    const req = new NextRequest("http://localhost/api/strategies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        baseStrategy: "value",
        filters: [{ field: "peRatio", operator: "lt", value: 15 }],
      }),
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("MISSING_FIELDS");
  });

  it("POST should return 400 when filters are missing", async () => {
    const req = new NextRequest("http://localhost/api/strategies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Test",
        baseStrategy: "value",
      }),
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("MISSING_FIELDS");
  });

  it("POST should return 400 when baseStrategy is missing", async () => {
    const req = new NextRequest("http://localhost/api/strategies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Test",
        filters: [{ field: "peRatio", operator: "lt", value: 15 }],
      }),
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("MISSING_FIELDS");
  });
});
