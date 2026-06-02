import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { sendDiscordAlert, RebalanceAlertPayload } from "../webhook-notifier";

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const VALID_WEBHOOK = "https://discord.com/api/webhooks/1234567890/abcdefghijk_token_here";

const basePayload: RebalanceAlertPayload = {
  period: "MTD",
  date: "2026-03-25",
  macro: {
    spyReturn: 5.0,
    bndReturn: 1.0,
    spread: 4.0,
    isEquityOutperforming: true,
    thresholdExceeded: true,
    signal: "SELL_EQUITY",
  },
};

describe("webhook-notifier", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  // ============================================================
  // Configuration guard tests
  // ============================================================
  describe("configuration guards", () => {
    it("should return false if DISCORD_WEBHOOK_URL is not set", async () => {
      vi.stubEnv("DISCORD_WEBHOOK_URL", "");
      const result = await sendDiscordAlert(basePayload);
      expect(result).toBe(false);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should return false if DISCORD_WEBHOOK_URL is undefined", async () => {
      // Ensure it's truly undefined
      delete process.env.DISCORD_WEBHOOK_URL;
      const result = await sendDiscordAlert(basePayload);
      expect(result).toBe(false);
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  // ============================================================
  // Security: URL validation tests (SSRF prevention)
  // ============================================================
  describe("URL validation (security)", () => {
    it("should reject an arbitrary HTTP URL", async () => {
      vi.stubEnv("DISCORD_WEBHOOK_URL", "https://evil.com/steal-data");
      const result = await sendDiscordAlert(basePayload);
      expect(result).toBe(false);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should reject a non-HTTPS Discord URL", async () => {
      vi.stubEnv("DISCORD_WEBHOOK_URL", "http://discord.com/api/webhooks/123/token");
      const result = await sendDiscordAlert(basePayload);
      expect(result).toBe(false);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should reject a URL with a subdomain-spoof (e.g., discord.com.evil.com)", async () => {
      vi.stubEnv("DISCORD_WEBHOOK_URL", "https://discord.com.evil.com/api/webhooks/123/token");
      const result = await sendDiscordAlert(basePayload);
      expect(result).toBe(false);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should reject a URL missing the webhook path", async () => {
      vi.stubEnv("DISCORD_WEBHOOK_URL", "https://discord.com/api/channels/123");
      const result = await sendDiscordAlert(basePayload);
      expect(result).toBe(false);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should reject a URL with missing webhook ID", async () => {
      vi.stubEnv("DISCORD_WEBHOOK_URL", "https://discord.com/api/webhooks//token");
      const result = await sendDiscordAlert(basePayload);
      expect(result).toBe(false);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should accept a valid Discord webhook URL", async () => {
      vi.stubEnv("DISCORD_WEBHOOK_URL", VALID_WEBHOOK);
      mockFetch.mockResolvedValueOnce({ ok: true });
      
      const result = await sendDiscordAlert(basePayload);
      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(1);
      
      // Verify it called the correct URL
      const calledUrl = mockFetch.mock.calls[0][0];
      expect(calledUrl).toBe(VALID_WEBHOOK);
    });
  });

  // ============================================================
  // Payload formatting tests
  // ============================================================
  describe("payload formatting", () => {
    it("should send correct embed for SELL_EQUITY signal", async () => {
      vi.stubEnv("DISCORD_WEBHOOK_URL", VALID_WEBHOOK);
      mockFetch.mockResolvedValueOnce({ ok: true });
      
      await sendDiscordAlert(basePayload);
      
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      const embed = body.embeds[0];
      
      expect(embed.title).toContain("📉");
      expect(embed.title).toContain("MTD");
      expect(embed.color).toBe(0xff4136); // Red
      expect(embed.fields[0].value).toContain("5.00%");
      expect(embed.fields[0].value).toContain("1.00%");
      expect(embed.fields[0].value).toContain("4.00%");
      expect(embed.fields[1].name).toContain("Equities Overheated");
    });

    it("should send correct embed for BUY_EQUITY signal", async () => {
      vi.stubEnv("DISCORD_WEBHOOK_URL", VALID_WEBHOOK);
      mockFetch.mockResolvedValueOnce({ ok: true });
      
      const buyPayload: RebalanceAlertPayload = {
        ...basePayload,
        macro: {
          spyReturn: -5.0,
          bndReturn: 1.0,
          spread: -6.0,
          isEquityOutperforming: false,
          thresholdExceeded: true,
          signal: "BUY_EQUITY",
        },
      };
      
      await sendDiscordAlert(buyPayload);
      
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      const embed = body.embeds[0];
      
      expect(embed.title).toContain("📈");
      expect(embed.color).toBe(0x2ecc40); // Green
      expect(embed.fields[1].name).toContain("Equities Oversold");
    });

    it("should include Window Dressing data when provided", async () => {
      vi.stubEnv("DISCORD_WEBHOOK_URL", VALID_WEBHOOK);
      mockFetch.mockResolvedValueOnce({ ok: true });
      
      const payload: RebalanceAlertPayload = {
        ...basePayload,
        micro: {
          winners: [
            { symbol: "NVDA", return: 25.3 },
            { symbol: "AAPL", return: 18.1 },
          ],
          losers: [
            { symbol: "INTC", return: -15.2 },
            { symbol: "MRNA", return: -10.5 },
          ],
        },
      };
      
      await sendDiscordAlert(payload);
      
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      const embed = body.embeds[0];
      
      // Should have 4 fields: Macro Drift, Signal, Winners, Losers
      expect(embed.fields.length).toBe(4);
      expect(embed.fields[2].value).toContain("NVDA");
      expect(embed.fields[2].value).toContain("25.3%");
      expect(embed.fields[3].value).toContain("INTC");
      expect(embed.fields[3].value).toContain("-15.2%");
    });

    it("should NOT include Window Dressing fields when micro is undefined", async () => {
      vi.stubEnv("DISCORD_WEBHOOK_URL", VALID_WEBHOOK);
      mockFetch.mockResolvedValueOnce({ ok: true });
      
      await sendDiscordAlert(basePayload);
      
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      const embed = body.embeds[0];
      
      // Should only have 2 fields: Macro Drift and Signal
      expect(embed.fields.length).toBe(2);
    });
  });

  // ============================================================
  // Error handling tests
  // ============================================================
  describe("error handling", () => {
    it("should return false on Discord API error (non-2xx)", async () => {
      vi.stubEnv("DISCORD_WEBHOOK_URL", VALID_WEBHOOK);
      mockFetch.mockResolvedValueOnce({ ok: false, status: 429, statusText: "Too Many Requests" });
      
      const result = await sendDiscordAlert(basePayload);
      expect(result).toBe(false);
    });

    it("should return false on network error", async () => {
      vi.stubEnv("DISCORD_WEBHOOK_URL", VALID_WEBHOOK);
      mockFetch.mockRejectedValueOnce(new Error("Network failure"));
      
      const result = await sendDiscordAlert(basePayload);
      expect(result).toBe(false);
    });
  });
});
