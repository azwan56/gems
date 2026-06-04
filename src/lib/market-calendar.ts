// ============================================================
// US Market Calendar — simple trading day detection
// Used by the cron job to skip weekends and major holidays.
// ============================================================

/**
 * US market holidays for 2025-2026 (NYSE/NASDAQ).
 * Dates when the market is fully closed.
 * Format: "MM-DD" for recurring, or "YYYY-MM-DD" for specific year.
 */
const US_HOLIDAYS_2025_2026: string[] = [
  // 2025
  "2025-01-01", // New Year's Day
  "2025-01-20", // MLK Day
  "2025-02-17", // Presidents' Day
  "2025-04-18", // Good Friday
  "2025-05-26", // Memorial Day
  "2025-06-19", // Juneteenth
  "2025-07-04", // Independence Day
  "2025-09-01", // Labor Day
  "2025-11-27", // Thanksgiving
  "2025-12-25", // Christmas
  // 2026
  "2026-01-01", // New Year's Day
  "2026-01-19", // MLK Day
  "2026-02-16", // Presidents' Day
  "2026-04-03", // Good Friday
  "2026-05-25", // Memorial Day
  "2026-06-19", // Juneteenth
  "2026-07-03", // Independence Day (observed)
  "2026-09-07", // Labor Day
  "2026-11-26", // Thanksgiving
  "2026-12-25", // Christmas
];

/**
 * Check if a given date is a US trading day.
 * A trading day is a weekday (Mon-Fri) that's not a market holiday.
 *
 * @param date - Date to check, defaults to current date in ET
 */
export function isTradingDay(date?: Date): boolean {
  // Default to current time in US Eastern
  const now = date ?? new Date();

  // Convert to ET for accuracy
  const etStr = now.toLocaleDateString("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  // etStr format: "MM/DD/YYYY"
  const [month, day, year] = etStr.split("/");
  const dateKey = `${year}-${month}-${day}`;

  // Get day of week in ET
  const etDow = new Date(
    now.toLocaleString("en-US", { timeZone: "America/New_York" })
  ).getDay();

  // Weekend check (0=Sun, 6=Sat)
  if (etDow === 0 || etDow === 6) return false;

  // Holiday check
  if (US_HOLIDAYS_2025_2026.includes(dateKey)) return false;

  return true;
}

/**
 * Get the next expected refresh time as an ISO string.
 * Returns "5:00 PM ET today" if today is a trading day and it's before 5 PM,
 * otherwise returns the next trading day at 5:00 PM ET.
 */
export function getNextRefreshTime(): string {
  const now = new Date();
  const etNow = new Date(
    now.toLocaleString("en-US", { timeZone: "America/New_York" })
  );

  // Today at 5:00 PM ET
  const today5pm = new Date(etNow);
  today5pm.setHours(17, 0, 0, 0);

  // If before 5pm today and today is a trading day → today
  if (etNow < today5pm && isTradingDay(now)) {
    return today5pm.toISOString();
  }

  // Otherwise find the next trading day
  const nextDay = new Date(now);
  for (let i = 1; i <= 7; i++) {
    nextDay.setDate(nextDay.getDate() + 1);
    if (isTradingDay(nextDay)) {
      const next5pm = new Date(
        nextDay.toLocaleString("en-US", { timeZone: "America/New_York" })
      );
      next5pm.setHours(17, 0, 0, 0);
      return next5pm.toISOString();
    }
  }

  return "Unknown";
}

/**
 * Get the date string "YYYY-MM-DD" for a given Date in US Eastern time.
 */
function toETDateKey(date: Date): string {
  const etStr = date.toLocaleDateString("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const [month, day, year] = etStr.split("/");
  return `${year}-${month}-${day}`;
}

/**
 * Check if a specific "YYYY-MM-DD" date string is a trading day.
 * (No weekend, no holiday.)
 */
function isDateKeyTradingDay(dateKey: string): boolean {
  const [y, m, d] = dateKey.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const dow = date.getDay();
  if (dow === 0 || dow === 6) return false;
  if (US_HOLIDAYS_2025_2026.includes(dateKey)) return false;
  return true;
}

/**
 * Count the number of trading days remaining in the month AFTER the given date,
 * up to and including the last trading day of the month.
 *
 * Returns 0 if today IS the last trading day.
 * Returns -1 if today is AFTER the last trading day (e.g. a weekend at month end).
 *
 * Example for May 2026 (Memorial Day May 25):
 *   May 22 (Fri) → returns 4 (26,27,28,29 are trading days)
 *   May 27 (Wed) → returns 2 (28,29)
 *   May 28 (Thu) → returns 1 (29)
 *   May 29 (Fri) → returns 0 (last trading day)
 *
 * @param date - Date to check (uses ET timezone)
 */
export function tradingDaysUntilMonthEnd(date?: Date): number {
  const now = date ?? new Date();
  const dateKey = toETDateKey(now);
  const [year, month] = dateKey.split("-").map(Number);

  // Get all calendar days from tomorrow until end of month
  const lastCalendarDay = new Date(year, month, 0).getDate(); // e.g. 31 for May
  const todayDay = parseInt(dateKey.split("-")[2], 10);

  let tradingDaysRemaining = 0;
  for (let d = todayDay + 1; d <= lastCalendarDay; d++) {
    const dk = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    if (isDateKeyTradingDay(dk)) tradingDaysRemaining++;
  }

  return tradingDaysRemaining;
}

/**
 * Check if the given date is the first trading day of its month.
 *
 * Handles cases where the 1st is a weekend or holiday (e.g., Jan 1, Jul 4 observed).
 * In those cases, the 2nd, 3rd, or even 4th could be the first trading day.
 *
 * @param date - Date to check (uses ET timezone)
 */
export function isFirstTradingDayOfMonth(date?: Date): boolean {
  const now = date ?? new Date();
  const dateKey = toETDateKey(now);

  // If today itself is not a trading day, it can't be the first
  if (!isDateKeyTradingDay(dateKey)) return false;

  const [year, month] = dateKey.split("-").map(Number);

  // Walk from the 1st of this month forward until we find a trading day
  for (let d = 1; d <= 7; d++) {
    const dk = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    if (isDateKeyTradingDay(dk)) {
      return dk === dateKey; // True only if today is that first trading day
    }
  }

  return false;
}

// ============================================================
// Macro & Event-Driven Calendar Logic
// ============================================================

export type EventCategory = "MACRO_DATA" | "FED_POLICY" | "OPTIONS_EXPIRY" | "REBALANCE_WINDOW";

export interface MacroEvent {
  date: string;
  name: string;
  severity: "HIGH" | "MEDIUM";
  category: EventCategory;
}

/**
 * Hardcoded macro events for 2025-2026.
 * FOMC meetings (focus on rate decision day), CPI release days, and Jackson Hole.
 */
const MACRO_EVENTS_2025_2026: MacroEvent[] = [
  // 2025 FOMC
  { date: "2025-01-29", name: "FOMC Rate Decision", severity: "HIGH", category: "FED_POLICY" },
  { date: "2025-03-19", name: "FOMC Rate Decision & SEP", severity: "HIGH", category: "FED_POLICY" },
  { date: "2025-05-07", name: "FOMC Rate Decision", severity: "MEDIUM", category: "FED_POLICY" },
  { date: "2025-06-18", name: "FOMC Rate Decision & SEP", severity: "HIGH", category: "FED_POLICY" },
  { date: "2025-07-30", name: "FOMC Rate Decision", severity: "MEDIUM", category: "FED_POLICY" },
  { date: "2025-09-17", name: "FOMC Rate Decision & SEP", severity: "HIGH", category: "FED_POLICY" },
  { date: "2025-10-29", name: "FOMC Rate Decision", severity: "MEDIUM", category: "FED_POLICY" },
  { date: "2025-12-10", name: "FOMC Rate Decision & SEP", severity: "HIGH", category: "FED_POLICY" },
  
  // 2026 FOMC (Estimated based on 6-week cadence)
  { date: "2026-01-28", name: "FOMC Rate Decision", severity: "HIGH", category: "FED_POLICY" },
  { date: "2026-03-18", name: "FOMC Rate Decision & SEP", severity: "HIGH", category: "FED_POLICY" },
  { date: "2026-05-06", name: "FOMC Rate Decision", severity: "MEDIUM", category: "FED_POLICY" },
  { date: "2026-06-17", name: "FOMC Rate Decision & SEP", severity: "HIGH", category: "FED_POLICY" },
  { date: "2026-07-29", name: "FOMC Rate Decision", severity: "MEDIUM", category: "FED_POLICY" },
  { date: "2026-09-16", name: "FOMC Rate Decision & SEP", severity: "HIGH", category: "FED_POLICY" },
  { date: "2026-10-28", name: "FOMC Rate Decision", severity: "MEDIUM", category: "FED_POLICY" },
  { date: "2026-12-16", name: "FOMC Rate Decision & SEP", severity: "HIGH", category: "FED_POLICY" },

  // 2025 CPI
  { date: "2025-01-15", name: "CPI Print", severity: "HIGH", category: "MACRO_DATA" },
  { date: "2025-02-12", name: "CPI Print", severity: "HIGH", category: "MACRO_DATA" },
  { date: "2025-03-12", name: "CPI Print", severity: "HIGH", category: "MACRO_DATA" },
  { date: "2025-04-09", name: "CPI Print", severity: "HIGH", category: "MACRO_DATA" },
  { date: "2025-05-14", name: "CPI Print", severity: "HIGH", category: "MACRO_DATA" },
  { date: "2025-06-11", name: "CPI Print", severity: "HIGH", category: "MACRO_DATA" },
  { date: "2025-07-16", name: "CPI Print", severity: "HIGH", category: "MACRO_DATA" },
  { date: "2025-08-13", name: "CPI Print", severity: "HIGH", category: "MACRO_DATA" },
  { date: "2025-09-10", name: "CPI Print", severity: "HIGH", category: "MACRO_DATA" },
  { date: "2025-10-15", name: "CPI Print", severity: "HIGH", category: "MACRO_DATA" },
  { date: "2025-11-12", name: "CPI Print", severity: "HIGH", category: "MACRO_DATA" },
  { date: "2025-12-10", name: "CPI Print", severity: "HIGH", category: "MACRO_DATA" },

  // 2026 CPI (Estimated)
  { date: "2026-01-14", name: "CPI Print", severity: "HIGH", category: "MACRO_DATA" },
  { date: "2026-02-11", name: "CPI Print", severity: "HIGH", category: "MACRO_DATA" },
  { date: "2026-03-11", name: "CPI Print", severity: "HIGH", category: "MACRO_DATA" },
  { date: "2026-04-08", name: "CPI Print", severity: "HIGH", category: "MACRO_DATA" },
  { date: "2026-05-13", name: "CPI Print", severity: "HIGH", category: "MACRO_DATA" },
  { date: "2026-06-10", name: "CPI Print", severity: "HIGH", category: "MACRO_DATA" },
  { date: "2026-07-15", name: "CPI Print", severity: "HIGH", category: "MACRO_DATA" },
  { date: "2026-08-12", name: "CPI Print", severity: "HIGH", category: "MACRO_DATA" },
  { date: "2026-09-09", name: "CPI Print", severity: "HIGH", category: "MACRO_DATA" },
  { date: "2026-10-14", name: "CPI Print", severity: "HIGH", category: "MACRO_DATA" },
  { date: "2026-11-11", name: "CPI Print", severity: "HIGH", category: "MACRO_DATA" },
  { date: "2026-12-09", name: "CPI Print", severity: "HIGH", category: "MACRO_DATA" },

  // Jackson Hole
  { date: "2025-08-22", name: "Jackson Hole Symposium", severity: "HIGH", category: "FED_POLICY" },
  { date: "2026-08-28", name: "Jackson Hole Symposium", severity: "HIGH", category: "FED_POLICY" },
];

/**
 * Get the date of the monthly OPEX (Option Expiration) - the 3rd Friday of the month.
 * @param year 
 * @param month 1-indexed (1 = Jan)
 */
export function getMonthlyOPEX(year: number, month: number): string {
  const d = new Date(year, month - 1, 1);
  // Find first Friday
  while (d.getDay() !== 5) {
    d.setDate(d.getDate() + 1);
  }
  // Add 14 days for the third Friday
  d.setDate(d.getDate() + 14);
  
  // Format as YYYY-MM-DD
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Checks if a specific date is a Quadruple Witching day.
 * (3rd Friday of March, June, September, December)
 */
export function isQuadWitching(dateKey: string): boolean {
  const [year, month] = dateKey.split("-").map(Number);
  if (![3, 6, 9, 12].includes(month)) return false;
  const opexDate = getMonthlyOPEX(year, month);
  return dateKey === opexDate;
}

/**
 * Returns upcoming macro and micro structure events within the next N days.
 * Now also injects dynamic REBALANCE_WINDOW events when ≤7 calendar days from month/quarter end.
 */
export function getUpcomingMacroEvents(date?: Date, lookaheadDays: number = 14): MacroEvent[] {
  const now = new Date(date ?? new Date());
  // Strip time for clean comparison
  now.setHours(0, 0, 0, 0);
  const nowTime = now.getTime();
  const futureTime = nowTime + lookaheadDays * 24 * 60 * 60 * 1000;
  
  const upcoming: MacroEvent[] = [];

  // 1. Check static events
  for (const event of MACRO_EVENTS_2025_2026) {
    const [y, m, d] = event.date.split("-").map(Number);
    const eventDate = new Date(y, m - 1, d).getTime();
    if (eventDate >= nowTime && eventDate <= futureTime) {
      upcoming.push(event);
    }
  }

  // 2. Dynamically calculate OPEX/Quad Witching for current and next month
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  
  // Current month OPEX
  const currentOpexStr = getMonthlyOPEX(currentYear, currentMonth);
  const currentOpexDate = new Date(currentYear, currentMonth - 1, parseInt(currentOpexStr.split("-")[2])).getTime();
  
  if (currentOpexDate >= nowTime && currentOpexDate <= futureTime) {
    const isQuad = [3, 6, 9, 12].includes(currentMonth);
    upcoming.push({
      date: currentOpexStr,
      name: isQuad ? "Quadruple Witching (Quarterly OPEX)" : "Monthly OPEX",
      severity: isQuad ? "HIGH" : "MEDIUM",
      category: "OPTIONS_EXPIRY",
    });
  }

  // Next month OPEX (if lookahead window crosses month boundary)
  const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1;
  const nextYear = currentMonth === 12 ? currentYear + 1 : currentYear;
  
  const nextOpexStr = getMonthlyOPEX(nextYear, nextMonth);
  const nextOpexDate = new Date(nextYear, nextMonth - 1, parseInt(nextOpexStr.split("-")[2])).getTime();
  
  if (nextOpexDate >= nowTime && nextOpexDate <= futureTime) {
    const isQuad = [3, 6, 9, 12].includes(nextMonth);
    upcoming.push({
      date: nextOpexStr,
      name: isQuad ? "Quadruple Witching (Quarterly OPEX)" : "Monthly OPEX",
      severity: isQuad ? "HIGH" : "MEDIUM",
      category: "OPTIONS_EXPIRY",
    });
  }

  // 3. Dynamically inject REBALANCE_WINDOW events
  // Check if we are within 7 calendar days of the current month end
  const lastDayOfMonth = new Date(currentYear, currentMonth, 0); // day 0 of next month = last day of this month
  lastDayOfMonth.setHours(0, 0, 0, 0);
  const daysToMonthEnd = Math.round((lastDayOfMonth.getTime() - nowTime) / (1000 * 60 * 60 * 24));

  if (daysToMonthEnd >= 0 && daysToMonthEnd <= 7) {
    const lastDayStr = `${currentYear}-${String(currentMonth).padStart(2, "0")}-${String(lastDayOfMonth.getDate()).padStart(2, "0")}`;
    const isQuarterEnd = [3, 6, 9, 12].includes(currentMonth);
    upcoming.push({
      date: lastDayStr,
      name: isQuarterEnd ? "Quarter-End Rebalancing Window" : "Month-End Rebalancing Window",
      severity: isQuarterEnd ? "HIGH" : "MEDIUM",
      category: "REBALANCE_WINDOW",
    });
  }

  // Sort chronologically
  return upcoming.sort((a, b) => a.date.localeCompare(b.date));
}
