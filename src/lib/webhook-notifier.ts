// ============================================================
// Discord Webhook Notifier for Rebalancing & Screener Alerts
// Supports system-level webhook + per-user fan-out
// ============================================================

import { MacroDriftResult, WindowDressingResult } from "./rebalance-engine";
import { getAllEnabledWebhooks, getAllEnabledEmails } from "./rebalance-store";
import type { RetrospectiveReport } from "./rebalance-retrospective";
import type { ScreenerDiff, SnapshotStockSummary } from "./screener-snapshot-store";
import { fanOutEmails, buildScreenerAlertEmail } from "./email-notifier";

export interface RebalanceAlertPayload {
  period: "MTD" | "QTD";
  date: string;
  macro: MacroDriftResult;
  micro?: WindowDressingResult;
}

/** Discord embed field shape */
interface DiscordEmbedField {
  name: string;
  value: string;
  inline: boolean;
}

/** Discord embed shape */
interface DiscordEmbed {
  title: string;
  description: string;
  color: number;
  fields: DiscordEmbedField[];
  footer: { text: string };
  timestamp: string;
}

/** Full Discord webhook payload shape */
interface DiscordWebhookPayload {
  username: string;
  avatar_url: string;
  embeds: DiscordEmbed[];
}

/** Pattern for valid Discord webhook URLs */
const DISCORD_WEBHOOK_PATTERN = /^https:\/\/discord\.com\/api\/webhooks\/\d+\/.+$/;

/**
 * Validate that a URL is a legitimate Discord webhook URL.
 */
export function isValidDiscordWebhookUrl(url: string): boolean {
  return DISCORD_WEBHOOK_PATTERN.test(url);
}

/**
 * Build a rich, actionable Discord embed payload from alert data.
 */
function buildDiscordPayload(payload: RebalanceAlertPayload): DiscordWebhookPayload {
  const { period, date, macro, micro } = payload;

  let color = 0x808080;
  let emoji = "⚖️";
  if (macro.signal === "SELL_EQUITY") {
    color = 0xff4136;
    emoji = "⚠️ 📉";
  } else if (macro.signal === "BUY_EQUITY") {
    color = 0x2ecc40;
    emoji = "⚠️ 📈";
  }

  const periodLabel = period === "QTD" ? "Quarter" : "Month";
  const spySign = macro.spyReturn >= 0 ? "+" : "";
  const bndSign = macro.bndReturn >= 0 ? "+" : "";
  const spreadSign = macro.spread >= 0 ? "+" : "";

  const fields: DiscordEmbedField[] = [
    {
      name: "📊 Macro Drift (60/40 Portfolio)",
      value: [
        `**SPY ${period}:** ${spySign}${macro.spyReturn.toFixed(2)}%`,
        `**BND ${period}:** ${bndSign}${macro.bndReturn.toFixed(2)}%`,
        `**Spread:** ${spreadSign}${macro.spread.toFixed(2)}% (threshold: ±3.0%)`,
      ].join("\n"),
      inline: false,
    },
  ];

  // Signal interpretation with actionable advice (calibrated by backtesting)
  if (macro.signal === "SELL_EQUITY") {
    fields.push({
      name: "🔴 Signal: Equities Overheated",
      value: [
        "Stocks significantly outperformed bonds this " + periodLabel.toLowerCase() + ".",
        "Institutional 60/40 rebalancers (pension funds, insurers) need to **sell stocks** and **buy bonds** to restore target allocation.",
        "",
        "**⚡ Action Items:**",
        "• 📊 Expect **upside momentum to slow** in the final 2-3 trading days — outright declines are possible but not guaranteed in bull markets",
        "• 📈 Bonds (BND/AGG) typically see modest inflows from rebalancing",
        "• ⚠️ **Avoid chasing momentum at extremes** — mechanical rebalancing creates headwinds",
        "• 🏆 **Watch the Winners list below** — window dressing buy momentum has historically been the highest-conviction signal",
      ].join("\n"),
      inline: false,
    });
  } else if (macro.signal === "BUY_EQUITY") {
    fields.push({
      name: "🟢 Signal: Equities Oversold",
      value: [
        "Bonds outperformed stocks this " + periodLabel.toLowerCase() + ".",
        "Institutional rebalancers need to **buy stocks** and **sell bonds** to restore 60/40.",
        "",
        "**⚡ Action Items:**",
        "• 📈 Expect **buying support** for equities in the final 2-3 trading days — dips may be shallow",
        "• 📉 Bonds may face mild selling pressure from rebalancing outflows",
        "• 💡 Institutional bids provide a floor — consider accumulating on weakness",
        "• 💀 **Watch the Losers list below** — oversold names may see sharp mean-reversion bounces",
      ].join("\n"),
      inline: false,
    });
  } else {
    fields.push({
      name: "⚖️ Signal: Neutral",
      value: "Drift is within normal limits. Minimal rebalancing impact expected.",
      inline: false,
    });
  }

  // Liquidity & Events
  if (macro.liquidity) {
    const { vix, vixTrend, tnx, upcomingEvents } = macro.liquidity;
    let vixStr = vix?.toFixed(2) ?? "N/A";
    if (vixTrend === "SPIKING") vixStr += " 🔴 (Spiking)";
    else if (vixTrend === "SUPPRESSED") vixStr += " 🟠 (Suppressed)";

    const tnxStr = tnx != null ? `${tnx.toFixed(3)}%` : "N/A";
    
    let eventStr = "No major events in next 14 days.";
    if (upcomingEvents.length > 0) {
      eventStr = upcomingEvents.map(e => `• **${e.date.substring(5)}**: ${e.name} ${e.severity === "HIGH" ? "🔴" : "🟠"}`).join("\n");
    }

    let checklistStr = "";
    if (upcomingEvents.some(e => e.severity === "HIGH") && vixTrend === "SUPPRESSED") {
      checklistStr = "\n\n⚠️ **TACTICAL WARNING: Gamma Un-pegging Risk** ⚠️\nVIX is artificially suppressed heading into a major liquidity event. Pure 'buy and hold' is dangerous. Consider protective measures:\n• **Rolling Profit Taking**: Trim 15-20% from high-flying tech.\n• **Hedging**: Buy OTM SPY protective puts.\n• **Income**: Sell Covered Calls on concentrated positions.";
    }

    fields.push({
      name: "🌊 Liquidity & Macro Events",
      value: `**VIX:** ${vixStr}\n**US 10Y Yield:** ${tnxStr}\n\n**Upcoming Events:**\n${eventStr}${checklistStr}`,
      inline: false,
    });
  }

  // Window Dressing data
  if (micro && (micro.winners.length > 0 || micro.losers.length > 0)) {
    const formatStocks = (list: { symbol: string; return: number }[], positive: boolean) =>
      list.slice(0, 5).map((s, i) =>
        `${i + 1}. **${s.symbol}** (${positive && s.return >= 0 ? "+" : ""}${s.return.toFixed(1)}%)`
      ).join("\n") || "—";

    fields.push({
      name: "🏆 Top Performers — High-Conviction Window Dressing Buys ⭐",
      value: [
        formatStocks(micro.winners, true),
        "",
        "_**Highest-conviction signal.** Fund managers buy these winners to showcase holdings in " + periodLabel.toLowerCase() + "-end reports. Backtesting shows **~100% continued to rally** in the final 2-3 days. Watch for reversal after " + periodLabel.toLowerCase() + " end._",
      ].join("\n"),
      inline: false,
    });

    fields.push({
      name: "💀 Severely Oversold — Mean Reversion / Short-Cover Watch",
      value: [
        formatStocks(micro.losers, false),
        "",
        "_⚠️ **Do NOT chase shorts here.** Backtesting shows ~70% of deeply oversold names **bounced** at " + periodLabel.toLowerCase() + "-end due to bargain hunting and short covering. These are better treated as a **bounce/contrarian watch-list** than as sell targets._",
      ].join("\n"),
      inline: false,
    });
  }

  return {
    username: "Rebalance Radar",
    avatar_url: "https://financialmodelingprep.com/favicon.ico",
    embeds: [
      {
        title: `${emoji} End of ${period} Rebalancing Alert`,
        description: `**${periodLabel}-end rebalancing window is active.** Institutional 60/40 portfolio drift detected — actionable intelligence below.`,
        color,
        fields,
        footer: { text: `${date} • Rebalance Radar by Gems • gems.vanpower.live/rebalance` },
        timestamp: new Date().toISOString(),
      },
    ],
  };
}

/**
 * Send a Discord webhook payload to a single URL.
 * Returns true if successful.
 */
export async function sendToWebhookUrl(
  webhookUrl: string,
  discordPayload: DiscordWebhookPayload
): Promise<boolean> {
  if (!isValidDiscordWebhookUrl(webhookUrl)) {
    console.error(`[Webhook] Invalid URL rejected: ${webhookUrl.slice(0, 40)}...`);
    return false;
  }

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(discordPayload),
    });

    if (!response.ok) {
      console.error(`[Webhook] Discord API error: ${response.status} ${response.statusText}`);
      return false;
    }
    return true;
  } catch (error) {
    console.error("[Webhook] Send failed:", error);
    return false;
  }
}

/**
 * Send alert to the system-level webhook (env var).
 * Backwards-compatible single-target function.
 */
export async function sendDiscordAlert(payload: RebalanceAlertPayload): Promise<boolean> {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) {
    console.warn("[Webhook] DISCORD_WEBHOOK_URL not configured. Skipping system alert.");
    return false;
  }

  const discordPayload = buildDiscordPayload(payload);
  const result = await sendToWebhookUrl(webhookUrl, discordPayload);
  if (result) console.log("[Webhook] System alert dispatched successfully.");
  return result;
}

/**
 * Fan out alerts to system webhook + all per-user webhooks.
 * Returns { sent, failed } counts.
 */
export async function fanOutAlerts(
  payload: RebalanceAlertPayload
): Promise<{ sent: number; failed: number }> {
  const discordPayload = buildDiscordPayload(payload);
  let sent = 0;
  let failed = 0;

  // 1. System-level webhook
  const systemUrl = process.env.DISCORD_WEBHOOK_URL;
  if (systemUrl && isValidDiscordWebhookUrl(systemUrl)) {
    const ok = await sendToWebhookUrl(systemUrl, discordPayload);
    if (ok) sent++;
    else failed++;
  }

  // 2. Per-user webhooks from Firestore
  const userWebhooks = await getAllEnabledWebhooks();
  console.log(`[Webhook] Fan-out: ${userWebhooks.length} user webhook(s) to deliver.`);

  // Send in parallel batches of 10 to avoid overwhelming Discord
  const BATCH = 10;
  for (let i = 0; i < userWebhooks.length; i += BATCH) {
    const batch = userWebhooks.slice(i, i + BATCH);
    const results = await Promise.allSettled(
      batch.map(({ webhookUrl }) => sendToWebhookUrl(webhookUrl, discordPayload))
    );

    for (const r of results) {
      if (r.status === "fulfilled" && r.value) sent++;
      else failed++;
    }

    // Small delay between batches to respect Discord rate limits
    if (i + BATCH < userWebhooks.length) {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  console.log(`[Webhook] Fan-out complete: ${sent} sent, ${failed} failed.`);
  return { sent, failed };
}

// ============================================================
// Monthly Retrospective Report
// ============================================================

/**
 * Build a rich Discord embed for the monthly retrospective report.
 */
function buildRetrospectivePayload(report: RetrospectiveReport): DiscordWebhookPayload {
  const pct = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
  const rate = (n: number) => `${(n * 100).toFixed(0)}%`;

  // Color based on overall accuracy
  let color = 0x808080;
  if (report.overallAccuracy >= 0.7) color = 0x2ecc40;      // Green
  else if (report.overallAccuracy >= 0.5) color = 0xf39c12;  // Orange
  else color = 0xff4136;                                      // Red

  const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const [, monthNum] = report.month.split("-").map(Number);
  const monthLabel = monthNames[monthNum - 1] || report.month;

  const fields: DiscordEmbedField[] = [];

  // Scorecard
  fields.push({
    name: "📊 Accuracy Scorecard",
    value: [
      `**Overall:** ${report.totalCorrect}/${report.totalPredictions} = **${rate(report.overallAccuracy)}**`,
      `**🏆 Winners (continued up):** ${report.winnersOutcome.filter(w => w.correct).length}/${report.winnersOutcome.length} = **${rate(report.winnersAccuracy)}**`,
      `**💀 Losers (continued down):** ${report.losersOutcome.filter(l => l.correct).length}/${report.losersOutcome.length} = **${rate(report.losersAccuracy)}**`,
      `**Macro (SPY):** ${report.macro.spyCorrect ? "✅" : "❌"} | **Macro (BND):** ${report.macro.bndCorrect ? "✅" : "❌"}`,
    ].join("\n"),
    inline: false,
  });

  // Macro details
  fields.push({
    name: `📈 Macro Signal: ${report.signal.replace("_", " ")}`,
    value: [
      `Predicted on **${report.predictionDate}**, validated over **${report.validationDates}**`,
      `SPY actual: **${pct(report.macro.spyReturn)}** ${report.macro.spyCorrect ? "✅" : "❌"}`,
      `BND actual: **${pct(report.macro.bndReturn)}** ${report.macro.bndCorrect ? "✅" : "❌"}`,
    ].join("\n"),
    inline: false,
  });

  // Winners detail
  if (report.winnersOutcome.length > 0) {
    const lines = report.winnersOutcome.slice(0, 5).map(w =>
      `${w.correct ? "✅" : "❌"} **${w.symbol}**: predicted top performer → actual ${pct(w.actualReturn)}`
    );
    fields.push({
      name: `🏆 Winners Validation (${rate(report.winnersAccuracy)})`,
      value: lines.join("\n"),
      inline: false,
    });
  }

  // Losers detail
  if (report.losersOutcome.length > 0) {
    const lines = report.losersOutcome.slice(0, 5).map(l =>
      `${l.correct ? "✅" : "❌"} **${l.symbol}**: predicted worst performer → actual ${pct(l.actualReturn)}`
    );
    fields.push({
      name: `💀 Losers Validation (${rate(report.losersAccuracy)})`,
      value: lines.join("\n"),
      inline: false,
    });
  }

  // Insights
  if (report.insights.length > 0) {
    fields.push({
      name: "💡 Key Insights & Lessons",
      value: report.insights.join("\n\n"),
      inline: false,
    });
  }

  // Actionable takeaway
  fields.push({
    name: "🎯 What This Means for Next Month",
    value: [
      report.winnersAccuracy >= 0.7
        ? "• **Winners signal remains reliable** — continue to watch top performers for short-term momentum plays at month/quarter end."
        : "• **Winners signal was weaker than usual** — consider waiting for confirmation before acting on momentum plays.",
      report.losersAccuracy <= 0.4
        ? "• **Mean-reversion in losers was strong** — treat the 'oversold' list as a bounce watch-list, not a sell signal."
        : "• **Losers continued falling** — exercise more caution with deeply oversold names when bearish sentiment is dominant.",
      report.macro.spyCorrect || report.macro.bndCorrect
        ? "• **Macro drift signal provided useful context** — factor it into your overall positioning."
        : "• **Macro signal was overridden by trend** — in strong bull/bear markets, rebalancing flows may not be enough to reverse direction.",
    ].join("\n"),
    inline: false,
  });

  return {
    username: "Rebalance Radar",
    avatar_url: "https://financialmodelingprep.com/favicon.ico",
    embeds: [
      {
        title: `📋 ${monthLabel} Rebalancing Retrospective — ${rate(report.overallAccuracy)} Accuracy`,
        description: `Monthly review of ${monthLabel} predictions vs actual outcomes. Use these insights to calibrate your trading decisions.`,
        color,
        fields,
        footer: { text: `${report.month} Review • Rebalance Radar by Gems • gems.vanpower.live/rebalance` },
        timestamp: new Date().toISOString(),
      },
    ],
  };
}

/**
 * Fan out the monthly retrospective report to all enabled webhooks.
 */
export async function fanOutRetrospective(
  report: RetrospectiveReport
): Promise<{ sent: number; failed: number }> {
  const discordPayload = buildRetrospectivePayload(report);
  let sent = 0;
  let failed = 0;

  // System-level webhook
  const systemUrl = process.env.DISCORD_WEBHOOK_URL;
  if (systemUrl && isValidDiscordWebhookUrl(systemUrl)) {
    const ok = await sendToWebhookUrl(systemUrl, discordPayload);
    if (ok) sent++;
    else failed++;
  }

  // Per-user webhooks
  const userWebhooks = await getAllEnabledWebhooks();
  console.log(`[Webhook] Retrospective fan-out: ${userWebhooks.length} user(s).`);

  const BATCH = 10;
  for (let i = 0; i < userWebhooks.length; i += BATCH) {
    const batch = userWebhooks.slice(i, i + BATCH);
    const results = await Promise.allSettled(
      batch.map(({ webhookUrl }) => sendToWebhookUrl(webhookUrl, discordPayload))
    );

    for (const r of results) {
      if (r.status === "fulfilled" && r.value) sent++;
      else failed++;
    }

    if (i + BATCH < userWebhooks.length) {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  console.log(`[Webhook] Retrospective fan-out complete: ${sent} sent, ${failed} failed.`);
  return { sent, failed };
}

// ============================================================
// Screener Alert — New Stock Entry Notifications
// ============================================================

/** Format market cap for compact display */
function fmtCap(val: number): string {
  if (val >= 1e12) return `$${(val / 1e12).toFixed(1)}T`;
  if (val >= 1e9) return `$${(val / 1e9).toFixed(0)}B`;
  if (val >= 1e6) return `$${(val / 1e6).toFixed(0)}M`;
  return `$${val.toLocaleString()}`;
}

/** Format a nullable number with suffix */
function fmtNum(val: number | null, suffix = ""): string {
  if (val === null || val === undefined) return "—";
  return `${val >= 0 ? "+" : ""}${val.toFixed(1)}${suffix}`;
}

/** Strategy icon mapping */
const STRATEGY_ICONS: Record<string, string> = {
  value: "📊",
  large_growth: "📈",
  small_growth: "🚀",
};

/**
 * Build a compact metric summary string for a stock.
 */
function buildMetricLine(stock: SnapshotStockSummary, strategyId: string): string {
  const parts: string[] = [];
  parts.push(`MCap ${fmtCap(stock.marketCap)}`);

  if (strategyId === "value") {
    if (stock.peRatio !== null) parts.push(`P/E ${stock.peRatio.toFixed(1)}x`);
    if (stock.freeCashFlowYield !== null) parts.push(`FCF ${stock.freeCashFlowYield.toFixed(1)}%`);
    if (stock.pbRatio !== null) parts.push(`P/B ${stock.pbRatio.toFixed(1)}x`);
  } else {
    if (stock.revenueGrowthYoY !== null) parts.push(`Rev ${fmtNum(stock.revenueGrowthYoY, "%")}`);
    if (stock.epsGrowthYoY !== null) parts.push(`EPS ${fmtNum(stock.epsGrowthYoY, "%")}`);
    if (stock.grossMargin !== null) parts.push(`GM ${stock.grossMargin.toFixed(0)}%`);
  }

  return parts.join(" | ");
}

/**
 * Build a Discord embed payload for screener alerts.
 */
function buildScreenerAlertPayload(diffs: ScreenerDiff[]): DiscordWebhookPayload {
  const totalAdded = diffs.reduce((sum, d) => sum + d.added.length, 0);
  const totalRemoved = diffs.reduce((sum, d) => sum + d.removed.length, 0);
  const hasChanges = totalAdded > 0 || totalRemoved > 0;

  const color = totalAdded > 0 ? 0x2ecc40 : totalRemoved > 0 ? 0xff4136 : 0x808080;
  const date = new Date().toISOString().split("T")[0];

  const fields: DiscordEmbedField[] = [];

  for (const diff of diffs) {
    const icon = STRATEGY_ICONS[diff.strategyId] ?? "📋";
    const changeLabel = [];
    if (diff.added.length > 0) changeLabel.push(`+${diff.added.length} new`);
    if (diff.removed.length > 0) changeLabel.push(`-${diff.removed.length} out`);
    const changeSuffix = changeLabel.length > 0 ? ` (${changeLabel.join(", ")})` : " (no changes)";

    const lines: string[] = [];

    // New entries (max 8 to avoid embed limits)
    for (const stock of diff.added.slice(0, 8)) {
      const metrics = buildMetricLine(stock, diff.strategyId);
      lines.push(`🟢 **${stock.symbol}** (${stock.companyName}) — ${metrics}`);
    }
    if (diff.added.length > 8) {
      lines.push(`_...and ${diff.added.length - 8} more_`);
    }

    // Removed entries (max 5)
    for (const sym of diff.removed.slice(0, 5)) {
      lines.push(`🔴 ~~${sym}~~`);
    }
    if (diff.removed.length > 5) {
      lines.push(`_...and ${diff.removed.length - 5} more removed_`);
    }

    if (lines.length === 0) {
      lines.push("_No changes — all stocks remain the same._");
    }

    fields.push({
      name: `${icon} ${diff.strategyName} / ${diff.strategyNameZh}${changeSuffix}`,
      value: lines.join("\n"),
      inline: false,
    });

    // Strategy pool size
    fields.push({
      name: " ",
      value: `Pool: ${diff.previousCount} → ${diff.currentCount} stocks`,
      inline: false,
    });
  }

  return {
    username: "Gems Screener",
    avatar_url: "https://financialmodelingprep.com/favicon.ico",
    embeds: [
      {
        title: hasChanges
          ? `🔍 Screener Alert — ${totalAdded} New Stock${totalAdded !== 1 ? "s" : ""} Qualify`
          : "🔍 Screener Alert — No Changes Today",
        description: hasChanges
          ? `Daily screener detected ${totalAdded} new entries and ${totalRemoved} exits across ${diffs.length} strategies. Fresh data from today's market close.`
          : "All strategies returned the same stocks as yesterday. No action needed.",
        color,
        fields,
        footer: { text: `${date} • Gems Screener • gems.vanpower.live/screener/value` },
        timestamp: new Date().toISOString(),
      },
    ],
  };
}

/**
 * Fan out screener alerts to system webhook + all per-user webhooks + email.
 */
export async function fanOutScreenerAlerts(
  diffs: ScreenerDiff[]
): Promise<{ sent: number; failed: number }> {
  const discordPayload = buildScreenerAlertPayload(diffs);
  let sent = 0;
  let failed = 0;

  // System-level webhook
  const systemUrl = process.env.DISCORD_WEBHOOK_URL;
  if (systemUrl && isValidDiscordWebhookUrl(systemUrl)) {
    const ok = await sendToWebhookUrl(systemUrl, discordPayload);
    if (ok) sent++;
    else failed++;
  }

  // Per-user webhooks
  const userWebhooks = await getAllEnabledWebhooks();
  console.log(`[Webhook] Screener alert fan-out: ${userWebhooks.length} user(s).`);

  const BATCH = 10;
  for (let i = 0; i < userWebhooks.length; i += BATCH) {
    const batch = userWebhooks.slice(i, i + BATCH);
    const results = await Promise.allSettled(
      batch.map(({ webhookUrl }) => sendToWebhookUrl(webhookUrl, discordPayload))
    );

    for (const r of results) {
      if (r.status === "fulfilled" && r.value) sent++;
      else failed++;
    }

    if (i + BATCH < userWebhooks.length) {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  // Email fan-out (parallel with Discord)
  const emailRecipients = await getAllEnabledEmails();
  if (emailRecipients.length > 0) {
    const emailPayload = buildScreenerAlertEmail(diffs);
    const emailResult = await fanOutEmails(emailRecipients, emailPayload);
    sent += emailResult.sent;
    failed += emailResult.failed;
    console.log(`[Webhook] Email fan-out: ${emailResult.sent} sent, ${emailResult.failed} failed.`);
  }

  console.log(`[Webhook] Screener alert fan-out complete: ${sent} sent, ${failed} failed.`);
  return { sent, failed };
}
