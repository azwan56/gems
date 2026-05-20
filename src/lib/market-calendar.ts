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
