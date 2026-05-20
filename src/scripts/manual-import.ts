// ============================================================
// Script: Manual Stock Import
//
// Sequentially processes all 6 chunks to fetch quotes, ratios,
// growth, and key metrics for all 742 stocks and merge them
// into the Firestore stock pool.
// ============================================================

import fs from "fs";
import path from "path";

// ---- Step 1: Manually load environment variables from .env ----
function loadEnv() {
  const envPath = path.resolve(process.cwd(), ".env");
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, "utf-8");
    for (const line of content.split("\n")) {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/);
      if (match) {
        const key = match[1];
        let val = match[2].trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.substring(1, val.length - 1);
        }
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}
loadEnv();

import { fetchFullUniverse } from "../lib/fmp-batch-fetcher";
import { mergeStockPool, loadStockPool } from "../lib/stock-pool-store";
import { buildFullUniverse, chunkUniverse } from "../lib/universe-provider";

const TOTAL_CHUNKS = 6;

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function run() {
  console.log("============================================================");
  console.log("STARTING MANUAL IMPORT FOR ALL INDEX CONSTITUENTS");
  console.log("============================================================");

  const startMs = Date.now();
  const fullUniverse = await buildFullUniverse();
  console.log(`[Import] Target Universe Size: ${fullUniverse.length} symbols`);

  let totalImported = 0;
  let totalApiCalls = 0;

  for (let i = 0; i < TOTAL_CHUNKS; i++) {
    const chunkSymbols = chunkUniverse(fullUniverse, TOTAL_CHUNKS, i);
    console.log(`\n------------------------------------------------------------`);
    console.log(`[Import] Processing Chunk ${i + 1}/${TOTAL_CHUNKS} (${chunkSymbols.length} symbols)`);
    console.log(`------------------------------------------------------------`);

    const chunkStart = Date.now();
    try {
      const result = await fetchFullUniverse(chunkSymbols);
      
      const hasRateLimit = result.errors.some(
        (e) =>
          e.includes("429") ||
          e.includes("402") ||
          e.toLowerCase().includes("limit reach")
      );

      if (result.stocks.length === 0 || hasRateLimit) {
        console.warn(`[Import] Warning: Chunk ${i + 1} skipped or API limited.`);
        console.warn(`Errors encountered:`, result.errors);
        continue;
      }

      // Merge into Firestore
      const meta = await mergeStockPool(result.stocks, "fmp", result.apiCallsUsed);
      const duration = ((Date.now() - chunkStart) / 1000).toFixed(1);

      totalImported += result.stocks.length;
      totalApiCalls += result.apiCallsUsed;

      console.log(`[Import] Chunk ${i + 1}/${TOTAL_CHUNKS} Success:`);
      console.log(`  - Stocks Imported/Updated: ${result.stocks.length}`);
      console.log(`  - API Calls Used: ${result.apiCallsUsed}`);
      console.log(`  - Duration: ${duration}s`);
      console.log(`  - Firestore pool now has: ${meta.symbolCount} total stocks`);

    } catch (err) {
      console.error(`[Import] Error processing chunk ${i + 1}:`, err);
    }

    // Delay between chunks to prevent overlapping limit exhaustion
    if (i < TOTAL_CHUNKS - 1) {
      console.log(`[Import] Sleeping 10 seconds before next chunk...`);
      await sleep(10000);
    }
  }

  const finalPool = await loadStockPool();
  const totalDuration = ((Date.now() - startMs) / 1000).toFixed(0);

  console.log("\n============================================================");
  console.log("IMPORT SUMMARY");
  console.log("============================================================");
  console.log(`- Total Chunks Processed: ${TOTAL_CHUNKS}`);
  console.log(`- Stocks Successfully Synced in this run: ${totalImported}`);
  console.log(`- Total API Calls Used: ${totalApiCalls}`);
  console.log(`- Elapsed Time: ${totalDuration}s (${Math.round(parseInt(totalDuration) / 60)}m)`);
  console.log(`- Final Firestore Stock Pool Size: ${finalPool?.meta.symbolCount ?? 0} stocks`);
  console.log(`- Source: ${finalPool?.meta.source ?? "unknown"}`);
  console.log(`- Last Updated: ${finalPool?.meta.updatedAt}`);
  console.log("============================================================");

  // Force exit since Firebase Admin maintains background connections
  process.exit(0);
}

run().catch((err) => {
  console.error("Fatal error during import:", err);
  process.exit(1);
});
