import { NextRequest, NextResponse } from "next/server";
import { requirePremium } from "@/lib/auth-middleware";
import { loadRecentScreenerChanges } from "@/lib/screener-snapshot-store";
import { loadStockPool } from "@/lib/stock-pool-store";
import { loadSAList } from "@/lib/seeking-alpha-store";

/**
 * GET: Return the recent strategy stock addition/removal changes history log.
 * Also supports internal vault sync via ?token=<VAULT_SECRET>.
 */
export async function GET(request: NextRequest) {
  const tokenParam = request.nextUrl.searchParams.get("token");
  const vaultSecret = process.env.ALIYUN_VAULT_SECRET || "Zhangjiang2025@@@";
  const isInternalSync = Boolean(tokenParam && tokenParam === vaultSecret);

  if (!isInternalSync) {
    const authResult = await requirePremium(request);
    if (!authResult.success) return authResult.response;
  }

  try {
    const limitParam = request.nextUrl.searchParams.get("limit");
    const limit = limitParam ? parseInt(limitParam, 10) : 20;
    const includePool = request.nextUrl.searchParams.get("include_pool") === "true";

    const changes = await loadRecentScreenerChanges(limit);

    if (isInternalSync && includePool) {
      const [pool, saList] = await Promise.all([
        loadStockPool(),
        loadSAList().catch(() => ({ symbols: [] as string[] })),
      ]);
      return NextResponse.json({
        changes,
        stocks: pool?.stocks ?? [],
        saSymbols: saList.symbols ?? [],
        poolUpdatedAt: pool?.meta?.updatedAt ?? null,
      });
    }

    return NextResponse.json({ changes });
  } catch (err) {
    return NextResponse.json(
      { error: "CHANGES_LOAD_ERROR", message: String(err) },
      { status: 500 }
    );
  }
}
