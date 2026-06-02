// ============================================================
// SA List Update Notifier — sends Discord + email notifications
// when the Seeking Alpha custom list is modified.
// ============================================================

import { getAllEnabledWebhooks, getAllEnabledEmails } from "./rebalance-store";
import { isValidDiscordWebhookUrl } from "./webhook-notifier";
import { fanOutEmails, buildSAUpdateEmail } from "./email-notifier";

/** Discord embed field shape */
interface DiscordEmbedField {
  name: string;
  value: string;
  inline: boolean;
}

/**
 * Build a Discord embed payload for SA list updates.
 */
function buildSADiscordPayload(
  action: "added" | "removed" | "replaced",
  symbols: string[],
  totalCount: number
) {
  const date = new Date().toISOString().split("T")[0];

  let color: number;
  let emoji: string;
  let title: string;
  let description: string;

  if (action === "added") {
    color = 0x2ecc40;
    emoji = "📖 🟢";
    title = `${emoji} SA Watchlist — ${symbols.length} Symbol${symbols.length !== 1 ? "s" : ""} Added`;
    description = `New symbols have been added to the Seeking Alpha watchlist.`;
  } else if (action === "removed") {
    color = 0xff4136;
    emoji = "📖 🔴";
    title = `${emoji} SA Watchlist — ${symbols.length} Symbol${symbols.length !== 1 ? "s" : ""} Removed`;
    description = `Symbols have been removed from the Seeking Alpha watchlist.`;
  } else {
    color = 0xf39c12;
    emoji = "📖 🔄";
    title = `${emoji} SA Watchlist — List Replaced (${symbols.length} symbols)`;
    description = `The Seeking Alpha watchlist has been fully replaced.`;
  }

  const fields: DiscordEmbedField[] = [];

  if (action === "added") {
    const lines = symbols.slice(0, 10).map((s) => `🟢 **${s}**`);
    if (symbols.length > 10) lines.push(`_...and ${symbols.length - 10} more_`);
    fields.push({ name: "Added Symbols", value: lines.join("\n"), inline: false });
  } else if (action === "removed") {
    const lines = symbols.map((s) => `🔴 ~~${s}~~`);
    fields.push({ name: "Removed Symbols", value: lines.join("\n"), inline: false });
  } else {
    const lines = symbols.slice(0, 15).map((s) => `• **${s}**`);
    if (symbols.length > 15) lines.push(`_...and ${symbols.length - 15} more_`);
    fields.push({ name: "New List", value: lines.join("\n"), inline: false });
  }

  fields.push({
    name: " ",
    value: `Total in SA Watchlist: **${totalCount}** symbols`,
    inline: false,
  });

  return {
    username: "Gems Screener",
    avatar_url: "https://financialmodelingprep.com/favicon.ico",
    embeds: [
      {
        title,
        description,
        color,
        fields,
        footer: { text: `${date} • Gems Screener • gems.vanpower.live/screener/seeking_alpha` },
        timestamp: new Date().toISOString(),
      },
    ],
  };
}

/**
 * Send SA list update notifications to all channels (Discord + email).
 * This is designed to be called fire-and-forget from the SA API route.
 */
export async function sendSAUpdateNotification(
  action: "added" | "removed" | "replaced",
  symbols: string[],
  totalCount: number
): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;

  const discordPayload = buildSADiscordPayload(action, symbols, totalCount);

  // ---- Discord: system webhook ----
  const systemUrl = process.env.DISCORD_WEBHOOK_URL;
  if (systemUrl && isValidDiscordWebhookUrl(systemUrl)) {
    try {
      const response = await fetch(systemUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(discordPayload),
      });
      if (response.ok) sent++;
      else failed++;
    } catch {
      failed++;
    }
  }

  // ---- Discord: per-user webhooks ----
  const userWebhooks = await getAllEnabledWebhooks();
  for (const { webhookUrl } of userWebhooks) {
    if (!isValidDiscordWebhookUrl(webhookUrl)) continue;
    try {
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(discordPayload),
      });
      if (response.ok) sent++;
      else failed++;
    } catch {
      failed++;
    }
  }

  // ---- Email: all enabled recipients ----
  const emailRecipients = await getAllEnabledEmails();
  if (emailRecipients.length > 0) {
    const emailPayload = buildSAUpdateEmail(action, symbols, totalCount);
    const emailResult = await fanOutEmails(emailRecipients, emailPayload);
    sent += emailResult.sent;
    failed += emailResult.failed;
  }

  console.log(
    `[SA-Notify] ${action} ${symbols.join(",")} → ${sent} sent, ${failed} failed`
  );
  return { sent, failed };
}
