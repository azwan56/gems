// ============================================================
// API: /api/rebalance-webhook — Per-user webhook management
// Premium-only (paid/super). Uses Firebase Auth token.
//
// GET    — return user's current webhook config
// PUT    — save/update webhook URL + enabled flag
// DELETE — remove webhook config
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { withPremium } from "@/lib/api-utils";
import { getUserWebhook, setUserWebhook, deleteUserWebhook } from "@/lib/rebalance-store";

/** Discord webhook URL validation pattern */
const DISCORD_WEBHOOK_PATTERN = /^https:\/\/discord\.com\/api\/webhooks\/\d+\/.+$/;

// ---- GET ----
export const GET = withPremium(async (_request: NextRequest, user) => {
  const config = await getUserWebhook(user.uid);
  return NextResponse.json({
    configured: !!config,
    webhookUrl: config?.webhookUrl ? maskWebhookUrl(config.webhookUrl) : null,
    email: config?.email ?? null,
    enabled: config?.enabled ?? false,
    updatedAt: config?.updatedAt ?? null,
  });
});

// ---- PUT ----
export const PUT = withPremium(async (request: NextRequest, user) => {
  let body: { webhookUrl?: string; enabled?: boolean; email?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "INVALID_BODY", message: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const { webhookUrl, enabled, email } = body;

  // Validate webhook URL if provided
  if (webhookUrl !== undefined) {
    if (typeof webhookUrl !== "string" || !DISCORD_WEBHOOK_PATTERN.test(webhookUrl)) {
      return NextResponse.json(
        { error: "INVALID_URL", message: "Must be a valid Discord webhook URL (https://discord.com/api/webhooks/...)" },
        { status: 400 }
      );
    }
  }

  // Basic email validation if provided
  if (email !== undefined && email !== null && email !== "") {
    if (typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json(
        { error: "INVALID_EMAIL", message: "Must be a valid email address." },
        { status: 400 }
      );
    }
  }

  // Get existing config to merge
  const existing = await getUserWebhook(user.uid);
  const finalUrl = webhookUrl ?? existing?.webhookUrl;

  if (!finalUrl) {
    return NextResponse.json(
      { error: "MISSING_URL", message: "No webhook URL provided and none exists." },
      { status: 400 }
    );
  }

  const config = await setUserWebhook(
    user.uid,
    finalUrl,
    enabled ?? existing?.enabled ?? true,
    email ?? existing?.email
  );

  return NextResponse.json({
    status: "ok",
    webhookUrl: maskWebhookUrl(config.webhookUrl),
    email: config.email ?? null,
    enabled: config.enabled,
    updatedAt: config.updatedAt,
  });
});

// ---- DELETE ----
export const DELETE = withPremium(async (_request: NextRequest, user) => {
  await deleteUserWebhook(user.uid);
  return NextResponse.json({ status: "ok", message: "Webhook removed." });
});

// ---- Helpers ----

/**
 * Mask webhook URL for safe display (hide the token portion).
 * e.g., "https://discord.com/api/webhooks/1234567890/abcdef..." → "...cdef"
 */
function maskWebhookUrl(url: string): string {
  const parts = url.split("/");
  const token = parts[parts.length - 1];
  if (token.length > 8) {
    return `https://discord.com/api/webhooks/*****/...${token.slice(-6)}`;
  }
  return `https://discord.com/api/webhooks/*****/*****`;
}
