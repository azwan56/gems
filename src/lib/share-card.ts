/**
 * Canvas-based share card generator for Gems stock analysis.
 * Produces a 900×1200 PNG image matching the VANPOWER AI ASTS style.
 */
import QRCode from "qrcode";
import type { StockAnalysisReport } from "./analysis-engine";
import type { StockMetrics } from "./types";

const W = 900;
const H = 1200;
const SITE = "gems.vanpower.live";

// ── Helpers ──────────────────────────────────────────────────────
function rr(
  g: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
  fill?: string | CanvasGradient | null,
  stroke?: string | null
) {
  g.beginPath();
  g.moveTo(x + r, y); g.lineTo(x + w - r, y);
  g.quadraticCurveTo(x + w, y, x + w, y + r); g.lineTo(x + w, y + h - r);
  g.quadraticCurveTo(x + w, y + h, x + w - r, y + h); g.lineTo(x + r, y + h);
  g.quadraticCurveTo(x, y + h, x, y + h - r); g.lineTo(x, y + r);
  g.quadraticCurveTo(x, y, x + r, y); g.closePath();
  if (fill) { g.fillStyle = fill; g.fill(); }
  if (stroke) { g.strokeStyle = stroke; g.lineWidth = 1; g.stroke(); }
}

function txt(
  g: CanvasRenderingContext2D,
  s: string, x: number, y: number, sz: number,
  col: string, al: CanvasTextAlign = "left", bold = false
) {
  g.font = `${bold ? "700" : "400"} ${sz}px Inter,-apple-system,sans-serif`;
  g.fillStyle = col;
  g.textAlign = al;
  g.fillText(String(s), x, y);
}

function bold(
  g: CanvasRenderingContext2D,
  s: string, x: number, y: number, sz: number,
  col: string, al: CanvasTextAlign = "left"
) {
  txt(g, s, x, y, sz, col, al, true);
}

function glassPanel(
  g: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
  borderColor: string
) {
  rr(g, x, y, w, h, r, "rgba(255,255,255,0.03)", borderColor);
  g.save();
  g.beginPath();
  g.moveTo(x + r, y); g.lineTo(x + w - r, y);
  g.quadraticCurveTo(x + w, y, x + w, y + r);
  g.lineTo(x + w, y + Math.min(h * 0.35, 40));
  g.lineTo(x, y + Math.min(h * 0.25, 30));
  g.lineTo(x, y + r);
  g.quadraticCurveTo(x, y, x + r, y);
  g.closePath();
  g.clip();
  const hlGr = g.createLinearGradient(x, y, x, y + h * 0.4);
  hlGr.addColorStop(0, "rgba(255,255,255,0.07)");
  hlGr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = hlGr;
  g.fillRect(x, y, w, h);
  g.restore();
}

function truncText(
  g: CanvasRenderingContext2D, text: string, maxW: number, font?: string
): string {
  if (!text) return "";
  g.save();
  if (font) g.font = font;
  let s = text;
  if (g.measureText(s).width <= maxW) { g.restore(); return s; }
  while (s.length > 0 && g.measureText(s + "...").width > maxW) s = s.slice(0, -1);
  g.restore();
  return s + "...";
}

function wrapText(
  g: CanvasRenderingContext2D,
  text: string,
  maxW: number,
  font: string,
  maxLines = 4
): string[] {
  g.save();
  g.font = font;
  const words = text.split(""); // break by char for CJK mixed with eng
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const test = line + word;
    if (g.measureText(test).width > maxW && line) {
      lines.push(line);
      if (lines.length >= maxLines) break;
      line = word;
    } else {
      line = test;
    }
  }
  if (line && lines.length < maxLines) lines.push(line);
  if (lines.length >= maxLines) {
    const last = lines[lines.length - 1];
    if (g.measureText(last + "...").width > maxW) {
      lines[lines.length - 1] = truncText(g, last, maxW, font);
    }
  }
  g.restore();
  return lines;
}

const drawImageUrl = async (g: CanvasRenderingContext2D, url: string, x: number, y: number, width: number, height: number, r: number) => {
  return new Promise<void>((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      g.save();
      g.beginPath();
      g.moveTo(x + r, y); g.lineTo(x + width - r, y);
      g.quadraticCurveTo(x + width, y, x + width, y + r); g.lineTo(x + width, y + height - r);
      g.quadraticCurveTo(x + width, y + height, x + width - r, y + height); g.lineTo(x + r, y + height);
      g.quadraticCurveTo(x, y + height, x, y + height - r); g.lineTo(x, y + r);
      g.quadraticCurveTo(x, y, x + r, y); g.closePath();
      g.clip();
      g.drawImage(img, x, y, width, height);
      g.restore();
      resolve();
    };
    img.onerror = () => resolve();
    img.src = url;
  });
};

// Seeded pseudo-random number generator for deterministic charts per symbol
function createSeededRng(seed: string): () => number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) & 0xffffffff;
  }
  return () => {
    h = (h * 1103515245 + 12345) & 0x7fffffff;
    return h / 0x7fffffff;
  };
}

// Placeholder chart drawer — uses seeded PRNG so same symbol always looks the same
function drawMockChart(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, symbol: string) {
  const rand = createSeededRng(symbol);

  // Chart background
  g.fillStyle = "#0c1322";
  g.fillRect(x, y, w, h);

  // Grid
  g.strokeStyle = "rgba(255,255,255,0.05)";
  g.lineWidth = 1;
  for (let i = 1; i < 10; i++) {
    g.beginPath(); g.moveTo(x, y + (h / 10) * i); g.lineTo(x + w, y + (h / 10) * i); g.stroke();
    g.beginPath(); g.moveTo(x + (w / 10) * i, y); g.lineTo(x + (w / 10) * i, y + h); g.stroke();
  }

  // Chart Title
  bold(g, `${symbol} Technical Analysis (120 Days)`, x + w / 2, y + 30, 14, "#00d2b6", "center");

  // Draw candlesticks
  g.save();
  g.translate(x, y + 20); // give space for title
  const chartW = w - 40;
  const chartH = h - 60;
  const candles = 60;
  const cW = chartW / candles * 0.7;
  const gap = chartW / candles * 0.3;
  let px = 20;
  let val = chartH * 0.5;

  for (let i = 0; i < candles; i++) {
    const isUp = rand() > 0.45;
    const size = rand() * (chartH * 0.15) + 5;
    const startY = val;
    val = isUp ? val - rand() * size * 0.8 : val + rand() * size * 0.8;
    val = Math.max(20, Math.min(chartH - 20, val));
    
    const high = Math.min(startY, val) - rand() * 20;
    const low = Math.max(startY, val) + rand() * 20;

    const col = isUp ? "#00d2b6" : "#f87171";
    g.strokeStyle = col;
    g.fillStyle = col;
    g.lineWidth = 1;
    
    // Wick
    g.beginPath();
    g.moveTo(px + cW / 2, high);
    g.lineTo(px + cW / 2, low);
    g.stroke();

    // Body
    const top = Math.min(startY, val);
    const bottom = Math.max(startY, val);
    const bodyH = Math.max(bottom - top, 2);
    g.fillRect(px, top, cW, bodyH);

    // Volume bar
    const volH = rand() * (chartH * 0.25) + 5;
    g.fillRect(px, chartH - volH + 20, cW, volH);

    px += cW + gap;
  }
  g.restore();

  // Draw moving average line
  const rand2 = createSeededRng(symbol + "_ma");
  g.strokeStyle = "#38bdf8";
  g.lineWidth = 2;
  g.beginPath();
  px = 20 + cW / 2;
  val = chartH * 0.6;
  g.moveTo(x + px, y + 20 + val);
  for (let i = 1; i < candles; i++) {
    px += cW + gap;
    val += (rand2() - 0.5) * 20;
    val = Math.max(20, Math.min(chartH - 20, val));
    g.lineTo(x + px, y + 20 + val);
  }
  g.stroke();
}


// ── Main Generator ───────────────────────────────────────────────
export async function generateShareCardDataURL(
  stock: StockMetrics,
  report: StockAnalysisReport,
  lang: "en" | "zh" = "zh",
  strategy: string = "value"
): Promise<string> {
  const cv = document.createElement("canvas");
  cv.width = W * 2;
  cv.height = H * 2;
  const g = cv.getContext("2d")!;
  g.scale(2, 2);
  const isEn = lang === "en";

  // ── Background ──
  g.fillStyle = "#0c1322"; // Deep dark blue background
  g.fillRect(0, 0, W, H);

  // ── Header ──
  // VANPOWER AI with teal dot
  g.beginPath();
  g.arc(50, 60, 6, 0, Math.PI * 2);
  g.fillStyle = "#00d2b6";
  g.fill();
  bold(g, "VANPOWER ", 65, 66, 22, "#ffffff");
  bold(g, "AI", 65 + g.measureText("VANPOWER ").width, 66, 22, "#00d2b6");

  // Top right Date & Title
  const dateStr = new Date().toISOString().slice(0, 10);
  txt(g, dateStr, W - 50, 55, 18, "#8b949e", "right");
  bold(g, "STOCK DEEP DIVE", W - 50, 75, 16, "#00d2b6", "right");

  // ── Symbol Info ──
  let curY = 160;
  bold(g, stock.symbol, 45, curY, 72, "#ffffff");
  txt(g, isEn ? "Daily Stock Deep Dive" : "每日个股深度研报", 50, curY + 30, 20, "#8b949e");

  // Price & Change Pill
  // Use mock change logic (or real if available)
  const isUp = (stock.priceVs50SMA || 0) >= 0;
  const changeColor = isUp ? "#00d2b6" : "#f87171";
  const changeBg = isUp ? "rgba(0, 210, 182, 0.15)" : "rgba(248, 113, 113, 0.15)";
  const changeStr = (isUp ? "+" : "") + formatNum(stock.priceVs50SMA || 0, "%");
  
  g.font = "bold 22px Inter,sans-serif";
  const changeW = g.measureText(changeStr).width + 30;

  const rightEdge = W - 50;
  // Draw pill
  rr(g, rightEdge - changeW, curY - 45, changeW, 40, 8, changeBg, "rgba(255,255,255,0.05)");
  bold(g, changeStr, rightEdge - changeW / 2, curY - 18, 22, changeColor, "center");

  // Draw Price
  bold(g, `$${stock.price.toFixed(2)}`, rightEdge - changeW - 20, curY - 10, 48, "#ffffff", "right");

  curY += 80;

  // ── AI Core Views (Section 1) ──
  glassPanel(g, 45, curY, W - 90, 200, 16, "rgba(255,255,255,0.08)");
  
  // Title with Teal Pipe
  rr(g, 75, curY + 40, 6, 24, 3, "#00d2b6", null);
  bold(g, isEn ? "AI Core Views & Anomaly Analysis" : "AI 核心观点与异动分析", 95, curY + 60, 24, "#ffffff");

  let bulletY = curY + 110;
  const rationaleBullets = report.rationale.length > 0 ? report.rationale : [report.overview];
  const maxBullets = Math.min(rationaleBullets.length, 2);

  for (let i = 0; i < maxBullets; i++) {
    // Chevron bullet "»"
    bold(g, "»", 75, bulletY + 2, 22, "#00d2b6");
    const bulletFont = "400 18px Inter,-apple-system,sans-serif";
    const lines = wrapText(g, rationaleBullets[i], W - 160, bulletFont, 2);
    lines.forEach((line) => {
      txt(g, line, 105, bulletY, 18, "#c9d1d9");
      bulletY += 30;
    });
    bulletY += 15;
  }

  curY += 230;

  // ── Chart Section ──
  glassPanel(g, 45, curY, W - 90, 420, 16, "rgba(255,255,255,0.08)");
  drawMockChart(g, 65, curY + 20, W - 130, 380, stock.symbol);

  curY += 450;

  // ── Footer / QR Code Section ──
  glassPanel(g, 45, curY, W - 90, 200, 16, "rgba(255,255,255,0.08)");
  
  bold(g, isEn ? "View Full AI Deep Dive Report" : "查看完整 AI 深度分析报告", 75, curY + 60, 26, "#ffffff");
  
  const desc = isEn 
    ? "Long press or scan the QR code to unlock trend signals, financial anomaly breakdown, cash flow monitoring, and valuation space calculation."
    : "长按或扫描右侧二维码，解锁趋势信号、财务异动拆解、资金流监测与估值空间测算。";
  
  const descLines = wrapText(g, desc, W - 380, "400 16px Inter,-apple-system,sans-serif", 3);
  let dY = curY + 100;
  descLines.forEach((line) => {
    txt(g, line, 75, dY, 16, "#8b949e");
    dY += 26;
  });

  bold(g, "VANPOWER MARKET INTELLIGENCE", 75, curY + 175, 16, "#00d2b6");

  // QR Code Generation
  const qrUrl = `https://${SITE}/screener/${strategy}`;
  try {
    const qrDataUrl = await QRCode.toDataURL(qrUrl, {
      margin: 1,
      width: 140,
      color: { dark: "#000000", light: "#ffffff" }
    });
    
    // Draw QR code with white rounded background
    const qrSize = 140;
    const qrX = W - 45 - qrSize - 30;
    const qrY = curY + 30;
    rr(g, qrX, qrY, qrSize, qrSize, 12, "#ffffff", null);
    await drawImageUrl(g, qrDataUrl, qrX + 5, qrY + 5, qrSize - 10, qrSize - 10, 0);
  } catch (err) {
    console.error("QR Code generation failed:", err);
  }

  return cv.toDataURL("image/png");
}

function formatNum(val: number | null, suffix = ""): string {
  return val === null || val === undefined ? "0.0" : `${val.toFixed(2)}${suffix}`;
}

export function downloadShareCard(dataUrl: string, symbol: string) {
  const link = document.createElement("a");
  const dateStr = new Date().toISOString().slice(0, 10);
  link.download = `${symbol}_${dateStr}_gems.png`;
  link.href = dataUrl;
  link.click();
}
