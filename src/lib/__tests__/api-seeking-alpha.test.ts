// ============================================================
// Integration Tests: /api/seeking-alpha route (GET/POST/PUT/DELETE)
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

// ---- Mock seeking-alpha-store ----
vi.mock("@/lib/seeking-alpha-store", () => ({
  loadSAList: vi.fn().mockResolvedValue({
    symbols: ["AAPL", "TSLA"],
    updatedAt: "2026-01-01T00:00:00.000Z",
  }),
  addToSAList: vi.fn().mockImplementation(async (symbols: string[]) => ({
    symbols: ["AAPL", "TSLA", ...symbols.map((s: string) => s.toUpperCase())],
    updatedAt: new Date().toISOString(),
  })),
  saveSAList: vi.fn().mockImplementation(async (symbols: string[]) => ({
    symbols: symbols.map((s: string) => s.toUpperCase()),
    updatedAt: new Date().toISOString(),
  })),
  removeFromSAList: vi.fn().mockImplementation(async (symbol: string) => ({
    symbols: ["AAPL", "TSLA"].filter((s) => s !== symbol.toUpperCase()),
    updatedAt: new Date().toISOString(),
  })),
}));

// Mock firebase (since seeking-alpha-store imports it)
vi.mock("@/lib/firebase", () => ({
  getDb: vi.fn(),
  ensureInitialized: vi.fn(),
}));

import { GET, POST, PUT, DELETE } from "@/app/api/seeking-alpha/route";

describe("/api/seeking-alpha", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ---- GET Tests ----

  it("GET should return the current SA symbol list", async () => {
    const req = new NextRequest("http://localhost/api/seeking-alpha");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.symbols).toEqual(["AAPL", "TSLA"]);
    expect(body.updatedAt).toBeDefined();
  });

  // ---- POST Tests ----

  it("POST should add symbols to the SA list", async () => {
    const req = new NextRequest("http://localhost/api/seeking-alpha", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symbols: ["GOOGL", "MSFT"] }),
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.symbols).toContain("GOOGL");
    expect(body.symbols).toContain("MSFT");
  });

  it("POST should return 400 for empty symbols array", async () => {
    const req = new NextRequest("http://localhost/api/seeking-alpha", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symbols: [] }),
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("INVALID_BODY");
  });

  it("POST should return 400 when symbols is not an array", async () => {
    const req = new NextRequest("http://localhost/api/seeking-alpha", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symbols: "AAPL" }),
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("INVALID_BODY");
  });

  // ---- PUT Tests ----

  it("PUT should replace the entire SA list", async () => {
    const req = new NextRequest("http://localhost/api/seeking-alpha", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symbols: ["NVDA", "AMD"] }),
    });
    const res = await PUT(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.symbols).toEqual(["NVDA", "AMD"]);
  });

  // ---- DELETE Tests ----

  it("DELETE should remove a symbol from the SA list", async () => {
    const req = new NextRequest("http://localhost/api/seeking-alpha", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symbol: "TSLA" }),
    });
    const res = await DELETE(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.symbols).not.toContain("TSLA");
    expect(body.symbols).toContain("AAPL");
  });

  it("DELETE should return 400 when symbol is missing", async () => {
    const req = new NextRequest("http://localhost/api/seeking-alpha", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const res = await DELETE(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("INVALID_BODY");
  });
});
