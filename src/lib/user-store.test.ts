import { describe, it, expect, beforeEach } from "vitest";
import {
  getWatchlist, addToWatchlist, removeFromWatchlist,
  getSavedStrategies, saveStrategy, deleteStrategy,
  clearAllUserData,
} from "@/lib/user-store";

const USER = "test-user-123";
beforeEach(async () => await clearAllUserData());

describe("Watchlist", () => {
  it("returns empty for new user", async () => {
    expect(await getWatchlist(USER)).toEqual([]);
  });
  it("adds a symbol", async () => {
    const item = await addToWatchlist(USER, "AAPL");
    expect(item.symbol).toBe("AAPL");
    expect(await getWatchlist(USER)).toHaveLength(1);
  });
  it("uppercases symbols", async () => {
    expect((await addToWatchlist(USER, "aapl")).symbol).toBe("AAPL");
  });
  it("prevents duplicates", async () => {
    await addToWatchlist(USER, "AAPL");
    await addToWatchlist(USER, "AAPL");
    expect(await getWatchlist(USER)).toHaveLength(1);
  });
  it("updates notes on re-add", async () => {
    await addToWatchlist(USER, "AAPL", "v1");
    await addToWatchlist(USER, "AAPL", "v2");
    expect((await getWatchlist(USER))[0].notes).toBe("v2");
  });
  it("removes a symbol", async () => {
    await addToWatchlist(USER, "AAPL");
    expect(await removeFromWatchlist(USER, "AAPL")).toBe(true);
    expect(await getWatchlist(USER)).toHaveLength(0);
  });
  it("returns false removing non-existent", async () => {
    expect(await removeFromWatchlist(USER, "ZZZ")).toBe(false);
  });
  it("isolates between users", async () => {
    await addToWatchlist("a", "AAPL");
    await addToWatchlist("b", "MSFT");
    expect((await getWatchlist("a"))[0].symbol).toBe("AAPL");
    expect((await getWatchlist("b"))[0].symbol).toBe("MSFT");
  });
});

describe("Saved Strategies", () => {
  it("returns empty for new user", async () => {
    expect(await getSavedStrategies(USER)).toEqual([]);
  });
  it("saves and returns with ID", async () => {
    const s = await saveStrategy(USER, { name: "S1", baseStrategy: "value", filters: [] });
    expect(s.id).toBeTruthy();
    expect(s.userId).toBe(USER);
  });
  it("lists all for user", async () => {
    await saveStrategy(USER, { name: "A", baseStrategy: "value", filters: [] });
    await saveStrategy(USER, { name: "B", baseStrategy: "large_growth", filters: [] });
    expect(await getSavedStrategies(USER)).toHaveLength(2);
  });
  it("deletes by ID", async () => {
    const s = await saveStrategy(USER, { name: "X", baseStrategy: "value", filters: [] });
    expect(await deleteStrategy(USER, s.id)).toBe(true);
    expect(await getSavedStrategies(USER)).toHaveLength(0);
  });
  it("returns false deleting non-existent", async () => {
    expect(await deleteStrategy(USER, "fake")).toBe(false);
  });
});
