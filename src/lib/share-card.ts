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

function formatNum(val: number | null | undefined, suffix = ""): string {
  if (val === null || val === undefined) return "--";
  return `${val.toFixed(2)}${suffix}`;
}

// ── Main Generator ───────────────────────────────────────────────
export async function generateShareCardDataURL(
  stock: StockMetrics,
  report: StockAnalysisReport,
  lang: "en" | "zh" = "zh",
  strategyName: string = "Value Investing",
  shareId?: string
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

  // Top right Date & Strategy Tag
  const dateStr = new Date().toISOString().slice(0, 10);
  txt(g, dateStr, W - 50, 55, 18, "#8b949e", "right");
  bold(g, strategyName.toUpperCase(), W - 50, 75, 16, "#00d2b6", "right");

  // ── Symbol Info ──
  let curY = 160;
  bold(g, stock.symbol, 45, curY, 72, "#ffffff");
  txt(g, isEn ? "Daily Stock Deep Dive" : "每日个股深度研报", 50, curY + 30, 20, "#8b949e");

  // Analyst Target & Upside Pill
  const targetPrice = report.analyst?.targetPrice || (stock.price > 0 ? `$${stock.price.toFixed(2)}` : "");
  const upside = report.analyst?.upside || "";
  const consensus = report.analyst?.consensus || "";
  
  const rightEdge = W - 50;

  if (targetPrice) {
    const isUp = upside.includes("+");
    const changeColor = isUp ? "#00d2b6" : "#f87171";
    const changeBg = isUp ? "rgba(0, 210, 182, 0.15)" : "rgba(248, 113, 113, 0.15)";
    
    g.font = "bold 22px Inter,sans-serif";
    const changeW = upside ? g.measureText(upside).width + 30 : 0;
    
    // Draw upside pill if available
    if (upside) {
      rr(g, rightEdge - changeW, curY - 45, changeW, 40, 8, changeBg, "rgba(255,255,255,0.05)");
      bold(g, upside, rightEdge - changeW / 2, curY - 18, 22, changeColor, "center");
    }

    // Draw target price label & value
    const priceX = rightEdge - changeW - (upside ? 20 : 0);
    txt(g, isEn ? "Target Price" : "目标价", priceX, curY - 35, 16, "#8b949e", "right");
    bold(g, targetPrice, priceX, curY - 5, 40, "#ffffff", "right");

    // Consensus badge (e.g. "Buy")
    if (consensus) {
      g.font = "bold 16px Inter,sans-serif";
      const consW = g.measureText(consensus).width + 30;
      rr(g, rightEdge - consW, curY + 10, consW, 30, 15, "rgba(56, 189, 248, 0.15)", "rgba(56, 189, 248, 0.3)");
      bold(g, consensus, rightEdge - consW / 2, curY + 32, 16, "#38bdf8", "center");
    }

    // ── Current Closing Price (below target price for comparison) ──
    if (stock.price > 0) {
      const closeY = curY + (consensus ? 55 : 45);
      // Separator line
      g.strokeStyle = "rgba(100,116,139,0.3)";
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(rightEdge - 250, closeY);
      g.lineTo(rightEdge, closeY);
      g.stroke();
      // Label & price
      txt(g, isEn ? "Current Close" : "当日收盘", rightEdge, closeY + 20, 16, "#8b949e", "right");
      bold(g, `$${stock.price.toFixed(2)}`, rightEdge, closeY + 50, 32, "#ffffff", "right");
    }
  }

  curY += 100;

  // ── Metrics Grid (Section 1) ──
  glassPanel(g, 45, curY, W - 90, 150, 16, "rgba(255,255,255,0.08)");
  
  const gridItems = [
    { label: isEn ? "P/E Ratio" : "市盈率 P/E", val: formatNum(stock.peRatio) },
    { label: isEn ? "P/B Ratio" : "市净率 P/B", val: formatNum(stock.pbRatio) },
    { label: isEn ? "ROE" : "净资产收益率", val: formatNum(stock.roe, "%") },
    { label: isEn ? "FCF Yield" : "自由现金流收益率", val: formatNum(stock.freeCashFlowYield, "%") },
    { label: isEn ? "Rev Growth (YoY)" : "营收同比增长", val: formatNum(stock.revenueGrowthYoY, "%") },
    { label: isEn ? "Gross Margin" : "毛利率", val: formatNum(stock.grossMargin, "%") },
  ];

  const cols = 3;
  const colW = (W - 90) / cols;
  const rowH = 70;
  
  for (let i = 0; i < gridItems.length; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = 45 + col * colW + 20;
    const y = curY + 20 + row * rowH;
    
    txt(g, gridItems[i].label, x, y + 15, 16, "#8b949e");
    bold(g, gridItems[i].val, x, y + 45, 24, "#ffffff");
    
    // Grid dividers
    if (col < cols - 1) {
      rr(g, 45 + (col + 1) * colW, y, 1, rowH - 20, 0, "rgba(255,255,255,0.1)", null);
    }
  }

  curY += 180;

  // ── AI Core Views (Section 2) ──
  glassPanel(g, 45, curY, W - 90, 480, 16, "rgba(255,255,255,0.08)");
  
  // Title with Teal Pipe
  rr(g, 75, curY + 40, 6, 24, 3, "#00d2b6", null);
  bold(g, isEn ? "AI Analysis & Rationale" : "AI 核心观点与逻辑", 95, curY + 60, 24, "#ffffff");

  let bulletY = curY + 110;
  const rationaleBullets = report.rationale.length > 0 ? report.rationale : [report.overview];
  const maxBullets = Math.min(rationaleBullets.length, 3);

  for (let i = 0; i < maxBullets; i++) {
    // Chevron bullet "»"
    bold(g, "»", 75, bulletY + 2, 22, "#00d2b6");
    const bulletFont = "400 18px Inter,-apple-system,sans-serif";
    const lines = wrapText(g, rationaleBullets[i], W - 160, bulletFont, 4);
    lines.forEach((line) => {
      txt(g, line, 105, bulletY, 18, "#c9d1d9");
      bulletY += 30;
    });
    bulletY += 15;
  }
  
  // Risks if space allows
  if (report.risks && report.risks.length > 0 && bulletY < curY + 400) {
      bulletY += 10;
      rr(g, 75, bulletY, 6, 24, 3, "#f87171", null);
      bold(g, isEn ? "Key Risks" : "主要风险提示", 95, bulletY + 20, 20, "#ffffff");
      bulletY += 50;
      
      bold(g, "!»", 70, bulletY + 2, 22, "#f87171");
      const bulletFont = "400 18px Inter,-apple-system,sans-serif";
      const lines = wrapText(g, report.risks[0], W - 160, bulletFont, 3);
      lines.forEach((line) => {
        txt(g, line, 105, bulletY, 18, "#c9d1d9");
        bulletY += 30;
      });
  }

  curY += 510;

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
  const qrUrl = shareId ? `https://${SITE}/api/share/${shareId}` : `https://${SITE}/screener/value`;
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

export function downloadShareCard(dataUrl: string, symbol: string) {
  const link = document.createElement("a");
  const dateStr = new Date().toISOString().slice(0, 10);
  link.download = `${symbol}_${dateStr}_gems.png`;
  link.href = dataUrl;
  link.click();
}
