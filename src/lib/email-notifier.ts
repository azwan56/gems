// ============================================================
// Email Notifier — sends alert emails via Resend
// Supports screener alerts, rebalancing alerts, and SA updates.
//
// Env vars:
//   RESEND_API_KEY — Resend API key (https://resend.com)
//   RESEND_FROM_EMAIL — sender address (must be verified domain)
// ============================================================

import { Resend } from "resend";

let resendClient: Resend | null = null;

function getResend(): Resend | null {
  if (resendClient) return resendClient;
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  resendClient = new Resend(apiKey);
  return resendClient;
}

function getFromEmail(): string {
  return process.env.RESEND_FROM_EMAIL || "alerts@gems.vanpower.live";
}

// ---- Types ----

export interface EmailRecipient {
  userId: string;
  email: string;
}

export interface EmailPayload {
  subject: string;
  html: string;
}

// ============================================================
// Send helpers
// ============================================================

/**
 * Send an email to a single recipient. Returns true on success.
 */
export async function sendEmail(
  to: string,
  subject: string,
  html: string
): Promise<boolean> {
  const resend = getResend();
  if (!resend) {
    console.warn("[Email] RESEND_API_KEY not configured. Skipping email.");
    return false;
  }

  try {
    const { error } = await resend.emails.send({
      from: getFromEmail(),
      to,
      subject,
      html,
    });

    if (error) {
      console.error("[Email] Send failed:", error);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[Email] Send error:", e);
    return false;
  }
}

/**
 * Fan out an email to multiple recipients in batches.
 */
export async function fanOutEmails(
  recipients: EmailRecipient[],
  payload: EmailPayload
): Promise<{ sent: number; failed: number }> {
  if (recipients.length === 0) return { sent: 0, failed: 0 };

  const resend = getResend();
  if (!resend) {
    console.warn("[Email] RESEND_API_KEY not configured. Skipping all emails.");
    return { sent: 0, failed: 0 };
  }

  let sent = 0;
  let failed = 0;

  // Batch in groups of 10 to respect rate limits
  const BATCH = 10;
  for (let i = 0; i < recipients.length; i += BATCH) {
    const batch = recipients.slice(i, i + BATCH);
    const results = await Promise.allSettled(
      batch.map(({ email }) => sendEmail(email, payload.subject, payload.html))
    );

    for (const r of results) {
      if (r.status === "fulfilled" && r.value) sent++;
      else failed++;
    }

    if (i + BATCH < recipients.length) {
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  console.log(`[Email] Fan-out complete: ${sent} sent, ${failed} failed.`);
  return { sent, failed };
}

// ============================================================
// Email HTML templates
// ============================================================

/** Shared email styles */
const EMAIL_STYLES = `
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #e2e8f0; margin: 0; padding: 0; }
  .container { max-width: 640px; margin: 0 auto; padding: 24px; }
  .header { text-align: center; padding: 24px 0; border-bottom: 1px solid #334155; }
  .header h1 { color: #60a5fa; margin: 0; font-size: 22px; }
  .header p { color: #94a3b8; margin: 8px 0 0; font-size: 14px; }
  .section { padding: 16px 0; border-bottom: 1px solid #1e293b; }
  .section h2 { color: #f8fafc; font-size: 16px; margin: 0 0 12px; }
  .stock-new { padding: 8px 12px; margin: 4px 0; background: #064e3b20; border-left: 3px solid #10b981; border-radius: 4px; }
  .stock-out { padding: 8px 12px; margin: 4px 0; background: #7f1d1d20; border-left: 3px solid #ef4444; border-radius: 4px; text-decoration: line-through; color: #94a3b8; }
  .stock-symbol { font-weight: 700; color: #f8fafc; }
  .stock-metrics { color: #94a3b8; font-size: 13px; font-family: monospace; }
  .no-change { color: #64748b; font-style: italic; font-size: 13px; }
  .footer { text-align: center; padding: 24px 0; color: #64748b; font-size: 12px; }
  .footer a { color: #60a5fa; text-decoration: none; }
  .pool-size { color: #64748b; font-size: 12px; margin-top: 8px; }
`;

interface ScreenerDiffForEmail {
  strategyId: string;
  strategyName: string;
  strategyNameZh: string;
  added: { symbol: string; companyName: string; marketCap: number; peRatio: number | null; freeCashFlowYield: number | null; revenueGrowthYoY: number | null; epsGrowthYoY: number | null; grossMargin: number | null }[];
  removed: string[];
  currentCount: number;
  previousCount: number;
}

/** Format market cap for email display */
function emailFmtCap(val: number): string {
  if (val >= 1e12) return `$${(val / 1e12).toFixed(1)}T`;
  if (val >= 1e9) return `$${(val / 1e9).toFixed(0)}B`;
  if (val >= 1e6) return `$${(val / 1e6).toFixed(0)}M`;
  return `$${val.toLocaleString()}`;
}

/**
 * Build email HTML for screener alert.
 */
export function buildScreenerAlertEmail(diffs: ScreenerDiffForEmail[]): EmailPayload {
  const totalAdded = diffs.reduce((sum, d) => sum + d.added.length, 0);
  const totalRemoved = diffs.reduce((sum, d) => sum + d.removed.length, 0);
  const date = new Date().toISOString().split("T")[0];

  const strategyIcons: Record<string, string> = {
    value: "📊", large_growth: "📈", small_growth: "🚀", seeking_alpha: "📖",
  };

  let sectionsHtml = "";
  for (const diff of diffs) {
    const icon = strategyIcons[diff.strategyId] ?? "📋";
    const changeLabel = [];
    if (diff.added.length > 0) changeLabel.push(`+${diff.added.length} new`);
    if (diff.removed.length > 0) changeLabel.push(`-${diff.removed.length} out`);
    const suffix = changeLabel.length > 0 ? ` (${changeLabel.join(", ")})` : "";

    let stocksHtml = "";

    for (const stock of diff.added.slice(0, 10)) {
      const metricParts: string[] = [emailFmtCap(stock.marketCap)];
      if (diff.strategyId === "value") {
        if (stock.peRatio !== null) metricParts.push(`P/E ${stock.peRatio.toFixed(1)}x`);
        if (stock.freeCashFlowYield !== null) metricParts.push(`FCF ${stock.freeCashFlowYield.toFixed(1)}%`);
      } else {
        if (stock.revenueGrowthYoY !== null) metricParts.push(`Rev ${stock.revenueGrowthYoY >= 0 ? "+" : ""}${stock.revenueGrowthYoY.toFixed(1)}%`);
        if (stock.epsGrowthYoY !== null) metricParts.push(`EPS ${stock.epsGrowthYoY >= 0 ? "+" : ""}${stock.epsGrowthYoY.toFixed(1)}%`);
      }

      stocksHtml += `<div class="stock-new">🟢 <span class="stock-symbol">${stock.symbol}</span> (${stock.companyName}) — <span class="stock-metrics">${metricParts.join(" | ")}</span></div>`;
    }
    if (diff.added.length > 10) {
      stocksHtml += `<div class="no-change">...and ${diff.added.length - 10} more</div>`;
    }

    for (const sym of diff.removed.slice(0, 5)) {
      stocksHtml += `<div class="stock-out">🔴 ${sym}</div>`;
    }
    if (diff.removed.length > 5) {
      stocksHtml += `<div class="no-change">...and ${diff.removed.length - 5} more removed</div>`;
    }

    if (!stocksHtml) {
      stocksHtml = `<div class="no-change">No changes — all stocks remain the same.</div>`;
    }

    sectionsHtml += `
      <div class="section">
        <h2>${icon} ${diff.strategyName} / ${diff.strategyNameZh}${suffix}</h2>
        ${stocksHtml}
        <div class="pool-size">Pool: ${diff.previousCount} → ${diff.currentCount} stocks</div>
      </div>
    `;
  }

  const subject = totalAdded > 0
    ? `🔍 Screener Alert — ${totalAdded} New Stock${totalAdded !== 1 ? "s" : ""} Qualify`
    : totalRemoved > 0
      ? `🔍 Screener Alert — ${totalRemoved} Stock${totalRemoved !== 1 ? "s" : ""} Removed`
      : "🔍 Screener Alert — No Changes Today";

  const html = `<!DOCTYPE html><html><head><style>${EMAIL_STYLES}</style></head><body>
    <div class="container">
      <div class="header">
        <h1>🔍 Gems Screener Alert</h1>
        <p>${date} — ${totalAdded} new entries, ${totalRemoved} exits</p>
      </div>
      ${sectionsHtml}
      <div class="footer">
        <p><a href="https://gems.vanpower.live/screener/value">View in Gems →</a></p>
        <p>Gems Screener • gems.vanpower.live</p>
      </div>
    </div>
  </body></html>`;

  return { subject, html };
}

/**
 * Build email HTML for SA list update notification.
 */
export function buildSAUpdateEmail(
  action: "added" | "removed" | "replaced",
  symbols: string[],
  totalCount: number
): EmailPayload {
  const date = new Date().toISOString().split("T")[0];

  let actionLabel: string;
  let stocksHtml = "";

  if (action === "added") {
    actionLabel = `${symbols.length} symbol${symbols.length !== 1 ? "s" : ""} added`;
    for (const sym of symbols) {
      stocksHtml += `<div class="stock-new">🟢 <span class="stock-symbol">${sym}</span></div>`;
    }
  } else if (action === "removed") {
    actionLabel = `${symbols.length} symbol${symbols.length !== 1 ? "s" : ""} removed`;
    for (const sym of symbols) {
      stocksHtml += `<div class="stock-out">🔴 ${sym}</div>`;
    }
  } else {
    actionLabel = `List replaced with ${symbols.length} symbols`;
    for (const sym of symbols.slice(0, 10)) {
      stocksHtml += `<div class="stock-new"><span class="stock-symbol">${sym}</span></div>`;
    }
    if (symbols.length > 10) {
      stocksHtml += `<div class="no-change">...and ${symbols.length - 10} more</div>`;
    }
  }

  const subject = `📖 SA Watchlist Updated — ${actionLabel}`;

  const html = `<!DOCTYPE html><html><head><style>${EMAIL_STYLES}</style></head><body>
    <div class="container">
      <div class="header">
        <h1>📖 Seeking Alpha Watchlist Update</h1>
        <p>${date} — ${actionLabel}</p>
      </div>
      <div class="section">
        <h2>📖 Seeking Alpha Picks / SA 精选${action !== "replaced" ? ` (${actionLabel})` : ""}</h2>
        ${stocksHtml}
        <div class="pool-size">Total in list: ${totalCount} symbols</div>
      </div>
      <div class="footer">
        <p><a href="https://gems.vanpower.live/screener/seeking_alpha">View in Gems →</a></p>
        <p>Gems Screener • gems.vanpower.live</p>
      </div>
    </div>
  </body></html>`;

  return { subject, html };
}
