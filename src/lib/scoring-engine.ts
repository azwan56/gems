import type { StockMetrics } from "./types";

/**
 * Normalizes a value between min and max into a 0-100 scale.
 * Values outside the bounds are clamped to 0 or 100.
 */
function normalize(val: number | null | undefined, min: number, max: number, invert = false): number {
  if (val === null || val === undefined) return 50; // default middle score for missing data
  
  let score = ((val - min) / (max - min)) * 100;
  if (invert) score = 100 - score;
  
  return Math.max(0, Math.min(100, score));
}

/**
 * Generates a deterministic Fundamental Score (0-100) based on financial metrics.
 * 
 * - Profitability (ROE, Margins)
 * - Growth (Revenue YoY, EPS YoY)
 * - Valuation Safety (FCF Yield, Current Ratio)
 */
export function calculateFundamentalScore(stock: StockMetrics): number {
  // Profitability (30%)
  const roeScore = normalize(stock.roe, 0, 30); // 0% to 30%+ ROE
  const grossMarginScore = normalize(stock.grossMargin, 10, 80); // 10% to 80%+ margin
  
  // Growth (40%)
  const revGrowthScore = normalize(stock.revenueGrowthYoY, 0, 40); // 0% to 40%+ YoY
  const epsGrowthScore = normalize(stock.epsGrowthYoY, 0, 40);
  
  // Safety & Cash Flow (30%)
  const fcfYieldScore = normalize(stock.freeCashFlowYield, 0, 10); // 0% to 10%+ yield
  const currentRatioScore = normalize(stock.currentRatio, 0.5, 3.0); // 0.5x to 3.0x+
  
  const score = (
    (roeScore * 0.15) +
    (grossMarginScore * 0.15) +
    (revGrowthScore * 0.20) +
    (epsGrowthScore * 0.20) +
    (fcfYieldScore * 0.20) +
    (currentRatioScore * 0.10)
  );

  return Math.round(score);
}

/**
 * Generates a deterministic Technical Score (0-100) based on momentum and trend.
 * 
 * - Trend Alignment (Price vs 50SMA, Price vs 200SMA)
 * - 52-Week Range Proximity
 */
export function calculateTechnicalScore(stock: StockMetrics): number {
  // Momentum relative to moving averages
  // -20% to +20% distance from moving averages as normal bounds
  const sma50Score = normalize(stock.priceVs50SMA, -20, 20); 
  const sma200Score = normalize(stock.priceVs200SMA, -20, 20);
  
  // Proximity to 52w High/Low
  let highLowScore = 50;
  if (stock.price > 0 && stock.fiftyTwoWeekHigh && stock.fiftyTwoWeekLow) {
    const range = stock.fiftyTwoWeekHigh - stock.fiftyTwoWeekLow;
    if (range > 0) {
      // 0 = at 52w low, 100 = at 52w high
      highLowScore = ((stock.price - stock.fiftyTwoWeekLow) / range) * 100;
      highLowScore = Math.max(0, Math.min(100, highLowScore));
    }
  }

  // Weightings: Short-term momentum (50SMA) 40%, Long-term (200SMA) 30%, Range proximity 30%
  const score = (sma50Score * 0.40) + (sma200Score * 0.30) + (highLowScore * 0.30);
  
  return Math.round(score);
}

/**
 * Generates a deterministic Sector Rotation Score (0-100) based on RRG quadrant & wind status.
 */
export function calculateSectorScore(stock: StockMetrics): number {
  if (stock.sectorScore !== undefined && stock.sectorScore !== null) {
    return Math.round(stock.sectorScore);
  }

  const quad = stock.sectorQuadrant;
  const wind = stock.sectorWind;

  if (wind === "tailwind" || quad === "Leading") return 90;
  if (quad === "Improving") return 78;
  if (quad === "Weakening") return 45;
  if (wind === "headwind" || quad === "Lagging") return 25;

  return 50; // default neutral
}

/**
 * Generates a 3D Composite Score (0-100) balancing:
 * - Fundamental Score (40%)
 * - Technical Score (30%)
 * - Sector Rotation / RRG Score (30%)
 */
export function calculateCompositeScore(stock: StockMetrics): {
  compositeScore: number;
  fundamentalScore: number;
  technicalScore: number;
  sectorScore: number;
} {
  const fund = calculateFundamentalScore(stock);
  const tech = calculateTechnicalScore(stock);
  const sector = calculateSectorScore(stock);

  const composite = Math.round(fund * 0.40 + tech * 0.30 + sector * 0.30);

  return {
    compositeScore: composite,
    fundamentalScore: fund,
    technicalScore: tech,
    sectorScore: sector,
  };
}

