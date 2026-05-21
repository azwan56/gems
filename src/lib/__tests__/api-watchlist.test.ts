// ============================================================
// Integration Tests: /api/watchlist route (GET/POST/DELETE/PATCH)
// ============================================================

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import type { WatchlistItem } from "@/lib/types";

// ---- Mock Auth (verifyAuth) ----
vi.mock("@/lib/auth-middleware", () => ({
  verifyAuth: vi.fn().mockResolvedValue({
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
const mockWatchlist: WatchlistItem[] = [];

vi.mock("@/lib/user-store", () => ({
  getWatchlist: vi.fn().mockImplementation(async () => [...mockWatchlist]),
  addToWatchlist: vi.fn().mockImplementation(async (_uid: string, symbol: string, notes?: string, role?: string) => {
    const item: WatchlistItem = {
      symbol: symbol.toUpperCase(),
      addedAt: new Date().toISOString(),
      notes,
      role: role as WatchlistItem["role"],
    };
    mockWatchlist.push(item);
    return item;
  }),
  removeFromWatchlist: vi.fn().mockImplementation(async (_uid: string, symbol: string) => {
    const idx = mockWatchlist.findIndex((i) => i.symbol === symbol.toUpperCase());
    if (idx === -1) return false;
    mockWatchlist.splice(idx, 1);
    return true;
  }),
  updateWatchlistRole: vi.fn().mockImplementation(async (_uid: string, symbol: string, role: string) => {
    const item = mockWatchlist.find((i) => i.symbol === symbol.toUpperCase());
    if (!item) return null;
    item.role = role as WatchlistItem["role"];
    return item;
  }),
}));

import { GET, POST, DELETE, PATCH } from "@/app/api/watchlist/route";

describe("/api/watchlist", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWatchlist.length = 0; // clear the mock array
  });

  // ---- GET Tests ----

  it("GET should return empty watchlist initially", async () => {
    const req = new NextRequest("http://localhost/api/watchlist");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.watchlist).toEqual([]);
  });

  // ---- POST Tests ----

  it("POST should add a symbol to the watchlist", async () => {
    const req = new NextRequest("http://localhost/api/watchlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symbol: "AAPL", notes: "Great company", role: "core_dividend" }),
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.item).toBeDefined();
    expect(body.item.symbol).toBe("AAPL");
    expect(body.item.notes).toBe("Great company");
    expect(body.item.role).toBe("core_dividend");
  });

  it("POST should return 400 when symbol is missing", async () => {
    const req = new NextRequest("http://localhost/api/watchlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes: "No symbol" }),
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("MISSING_FIELDS");
  });

  // ---- DELETE Tests ----

  it("DELETE should remove a symbol from the watchlist", async () => {
    // Pre-populate
    mockWatchlist.push({ symbol: "AAPL", addedAt: new Date().toISOString() });

    const req = new NextRequest("http://localhost/api/watchlist", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symbol: "AAPL" }),
    });
    const res = await DELETE(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it("DELETE should return 404 for non-existent symbol", async () => {
    const req = new NextRequest("http://localhost/api/watchlist", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symbol: "ZZZZ" }),
    });
    const res = await DELETE(req);
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe("NOT_FOUND");
  });

  it("DELETE should return 400 when symbol is missing", async () => {
    const req = new NextRequest("http://localhost/api/watchlist", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const res = await DELETE(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("MISSING_FIELDS");
  });

  // ---- PATCH Tests ----

  it("PATCH should update the role of a watchlist item", async () => {
    // Pre-populate
    mockWatchlist.push({ symbol: "AAPL", addedAt: new Date().toISOString(), role: "core_dividend" });

    const req = new NextRequest("http://localhost/api/watchlist", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symbol: "AAPL", role: "striker" }),
    });
    const res = await PATCH(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.item).toBeDefined();
    expect(body.item.role).toBe("striker");
  });

  it("PATCH should return 404 for non-existent symbol", async () => {
    const req = new NextRequest("http://localhost/api/watchlist", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symbol: "ZZZZ", role: "anchor" }),
    });
    const res = await PATCH(req);
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe("NOT_FOUND");
  });

  it("PATCH should return 400 when symbol is missing", async () => {
    const req = new NextRequest("http://localhost/api/watchlist", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: "anchor" }),
    });
    const res = await PATCH(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("MISSING_FIELDS");
  });
});
