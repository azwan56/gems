// ============================================================
// Core domain types for the stock screener platform
// ============================================================

/** A stock with its key financial metrics */
export interface StockMetrics {
  symbol: string;
  companyName: string;
  sector: string;
  industry: string;
  marketCap: number;
  price: number;
  entryDate?: string | null;         // 默认/最新入选日期
  entryPrice?: number | null;        // 默认/最新入选价格
  firstEntryDate?: string | null;    // 首次入选日期 (e.g. 2026-07-10)
  firstEntryPrice?: number | null;   // 首次入选价格 (e.g. 32.50)
  latestEntryDate?: string | null;   // 最新调仓/入选日期 (e.g. 2026-07-28)
  latestEntryPrice?: number | null;  // 最新调仓/入选价格 (e.g. 35.11)
  // Value metrics


  peRatio: number | null;
  pbRatio: number | null;
  freeCashFlowYield: number | null;
  dividendYield: number | null;
  currentRatio: number | null;
  debtToEquity: number | null;
  // Growth metrics
  revenueGrowthYoY: number | null;
  epsGrowthYoY: number | null;
  pegRatio: number | null;
  roe: number | null;
  grossMargin: number | null;
  netMargin: number | null;
  // Price data
  priceVs50SMA: number | null; // percentage above/below 50-day SMA
  priceVs200SMA: number | null;
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
  beta?: number | null;
}

/** The strategy types supported by the MVP */
export type StrategyType = "value" | "large_growth" | "small_growth" | "seeking_alpha" | "garp" | "wide_moat" | "short_term_catalyst";

/** A single filter criterion for screening */
export interface FilterCriterion {
  field: keyof StockMetrics;
  operator: "gt" | "lt" | "gte" | "lte" | "eq" | "between";
  value: number;
  /** Used only for 'between' operator */
  valueTo?: number;
}

/** Full screener request parameters */
export interface ScreenerRequest {
  strategy: StrategyType;
  filters: FilterCriterion[];
  sortBy?: keyof StockMetrics;
  sortOrder?: "asc" | "desc";
  limit?: number;
  offset?: number;
  /** 'live' (default): runs current filters; 'roster': loads backtested history roster */
  mode?: "live" | "roster";
  /** Filter the backtest roster by a specific calendar year (e.g. 2026). Defaults to current year if omitted. */
  year?: number;
}

/** Screener response with pagination */
export interface ScreenerResponse {
  stocks: StockMetrics[];
  total: number;
  limit: number;
  offset: number;
  strategy: StrategyType;
  appliedFilters: FilterCriterion[];
}

/** Predefined strategy preset (default filter set) */
export interface StrategyPreset {
  id: StrategyType;
  name: string;
  nameZh: string;
  description: string;
  descriptionZh: string;
  icon: string;
  color: string;
  defaultFilters: FilterCriterion[];
}

/** User's saved custom strategy */
export interface SavedStrategy {
  id: string;
  userId: string;
  name: string;
  baseStrategy: StrategyType;
  filters: FilterCriterion[];
  createdAt: string;
  updatedAt: string;
}

/** User watchlist item */
export interface WatchlistItem {
  symbol: string;
  addedAt: string;
  notes?: string;
  role?: "anchor" | "striker" | "rocket" | "core_dividend" | "turnaround" | "special_situation";
}

/** API error response */
export interface ApiError {
  error: string;
  message: string;
  statusCode: number;
}
