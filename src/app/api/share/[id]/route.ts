// ============================================================
// GET /api/share/[id] — Product landing page for shared links
// Shows Gems product intro with 4 screening strategies,
// daily FMP data, and a registration CTA — no individual stock analysis.
// ============================================================

import { NextRequest, NextResponse } from "next/server";

function escapeHtml(unsafe: string) {
  if (!unsafe) return "";
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await params;
  const shareId = resolvedParams.id;

  if (!shareId || !/^[0-9a-f]{16}$/i.test(shareId)) {
    return new NextResponse(_renderErrorPage("Invalid share link."), {
      status: 400,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  // Optionally look up the share doc for OG metadata
  let symbol = "";
  let strategyName = "";
  try {
    const { getDb } = await import("@/lib/firebase");
    const db = getDb();
    const doc = await db.collection("gems_share_cards").doc(shareId).get();
    if (doc.exists) {
      const data = doc.data()!;
      symbol = escapeHtml(data.symbol || "");
      strategyName = escapeHtml(data.strategyName || "");
    }
  } catch { /* ignore — page works without it */ }

  const frontendUrl = "https://gems.vanpower.live";
  const currentYear = new Date().getFullYear();
  const ogTitle = symbol
    ? `${symbol} AI Analysis — Vanpower Gems`
    : "Vanpower Gems — AI Stock Screener";
  const ogDesc = "AI-powered stock screening with 4 strategies. Daily FMP data. Value, Large-cap Growth, Small-cap Growth & Seeking Alpha picks.";

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>${ogTitle}</title>
    <meta property="og:title" content="${ogTitle}" />
    <meta property="og:description" content="${ogDesc}" />
    <meta property="og:type" content="website" />
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <style>
        :root {
            --navy-950: #071120;
            --navy-900: #0A192F;
            --navy-800: #112240;
            --teal-400: #64FFDA;
            --teal-500: #00d2b6;
            --slate-200: #e2e8f0;
            --slate-300: #cbd5e1;
            --slate-400: #94a3b8;
            --slate-600: #475569;
            --slate-800: #1e293b;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background: var(--navy-900);
            color: var(--slate-200);
            -webkit-font-smoothing: antialiased;
            min-height: 100dvh;
            display: flex;
            flex-direction: column;
        }
        ::selection { background-color: rgba(0,210,182,0.3); color: #fff; }

        /* Header */
        header {
            width: 100%; padding: 0.875rem 1.25rem;
            background: rgba(17,34,64,0.85);
            backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
            border-bottom: 1px solid var(--slate-800);
            position: sticky; top: 0; z-index: 50;
            display: flex; align-items: center; justify-content: space-between;
        }
        .logo { display: flex; align-items: center; gap: 0.5rem; }
        .logo-dot { width: 10px; height: 10px; border-radius: 50%; background: var(--teal-500); box-shadow: 0 0 10px rgba(0,210,182,0.5); animation: pulse 2s ease-in-out infinite; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.5} }
        .logo-text { font-size: 1.05rem; font-weight: 800; letter-spacing: 0.05em; color: #fff; }
        .logo-text span { color: var(--teal-500); }
        .badge-top { font-size: 0.7rem; font-weight: 600; padding: 0.2rem 0.5rem; border-radius: 0.25rem; border: 1px solid rgba(100,255,218,0.2); background: rgba(100,255,218,0.1); color: var(--teal-400); }

        /* Main */
        main { width: 100%; max-width: 520px; margin: 0 auto; padding: 1.25rem 1rem; flex: 1; display: flex; flex-direction: column; gap: 1.25rem; }

        /* Hero */
        .hero { text-align: center; }
        .hero h1 { font-size: 1.75rem; font-weight: 800; color: #fff; line-height: 1.2; margin-bottom: 0.375rem; }
        .hero h1 span { color: var(--teal-500); }
        .hero p { color: var(--slate-400); font-size: 0.82rem; line-height: 1.5; }
        .hero-badge { display: inline-flex; align-items: center; gap: 0.35rem; margin-top: 0.75rem; padding: 0.3rem 0.75rem; border-radius: 2rem; background: rgba(0,210,182,0.1); border: 1px solid rgba(0,210,182,0.2); color: var(--teal-500); font-size: 0.75rem; font-weight: 600; }
        .hero-badge .dot { width: 6px; height: 6px; border-radius: 50%; background: var(--teal-500); animation: pulse 2s ease-in-out infinite; }

        /* Strategy Cards */
        .section-label { font-size: 0.8rem; font-weight: 700; color: var(--teal-500); letter-spacing: 0.05em; text-transform: uppercase; margin-bottom: 0.75rem; display: flex; align-items: center; gap: 0.4rem; }
        .strategies { display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; }
        .strategy-card {
            padding: 1rem 0.875rem; border-radius: 0.875rem;
            background: rgba(17,34,64,0.6); border: 1px solid rgba(51,65,85,0.25);
            transition: border-color 0.2s;
        }
        .strategy-card:hover { border-color: rgba(0,210,182,0.25); }
        .strategy-icon { font-size: 1.5rem; margin-bottom: 0.5rem; }
        .strategy-name { font-size: 0.85rem; font-weight: 700; color: #fff; margin-bottom: 0.25rem; line-height: 1.25; }
        .strategy-desc { font-size: 0.72rem; color: var(--slate-400); line-height: 1.45; }

        /* Features */
        .features { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.5rem; }
        .feature {
            padding: 0.875rem 0.625rem; border-radius: 0.75rem; text-align: center;
            background: rgba(17,34,64,0.5); border: 1px solid rgba(0,210,182,0.06);
        }
        .feature-icon { font-size: 1.4rem; margin-bottom: 0.375rem; }
        .feature-label { font-size: 0.72rem; font-weight: 700; color: #fff; line-height: 1.3; }

        /* Data source */
        .data-card {
            padding: 1rem; border-radius: 0.875rem;
            background: rgba(17,34,64,0.5); border: 1px solid rgba(51,65,85,0.2);
            display: flex; align-items: flex-start; gap: 0.75rem;
        }
        .data-icon { font-size: 1.75rem; flex-shrink: 0; }
        .data-title { font-size: 0.85rem; font-weight: 700; color: #fff; margin-bottom: 0.15rem; }
        .data-desc { font-size: 0.72rem; color: var(--slate-400); line-height: 1.5; }

        /* CTA */
        .cta-section { text-align: center; padding: 0.25rem 0; }
        .cta-btn {
            display: block; width: 100%; padding: 0.875rem 1rem; border-radius: 0.75rem;
            background: linear-gradient(135deg, var(--teal-500), #00b89c); color: var(--navy-950);
            font-weight: 700; font-size: 1rem; text-decoration: none; letter-spacing: 0.025em;
            box-shadow: 0 4px 20px rgba(0,210,182,0.25); transition: transform 0.15s;
        }
        .cta-btn:active { transform: scale(0.97); }
        .cta-sub { color: var(--slate-400); font-size: 0.75rem; margin-top: 0.625rem; line-height: 1.5; }

        /* Footer */
        footer { width: 100%; padding: 1rem; text-align: center; color: var(--slate-600); font-size: 0.68rem; border-top: 1px solid var(--slate-800); }
    </style>
</head>
<body>
    <header>
        <div class="logo">
            <div class="logo-dot"></div>
            <span class="logo-text">VANPOWER <span>AI</span></span>
        </div>
        <span class="badge-top">Gems</span>
    </header>

    <main>
        <!-- Hero -->
        <div class="hero">
            <h1>AI 智能<span>选股工具</span></h1>
            <p>基于 Financial Modeling Prep 官方数据，每日更新 500+ 美股财务指标，AI 深度分析寻找最具潜力标的</p>
            <div class="hero-badge"><span class="dot"></span> 数据每日自动更新</div>
        </div>

        <!-- 4 Strategies -->
        <div>
            <div class="section-label">🎯 四大选股策略</div>
            <div class="strategies">
                <div class="strategy-card">
                    <div class="strategy-icon">💎</div>
                    <div class="strategy-name">价值股 Value</div>
                    <div class="strategy-desc">低估值、高分红、强现金流，寻找被市场低估的优质蓝筹</div>
                </div>
                <div class="strategy-card">
                    <div class="strategy-icon">🚀</div>
                    <div class="strategy-name">大盘成长 Large Growth</div>
                    <div class="strategy-desc">高营收增长、高 ROE 的大市值龙头，把握确定性成长机会</div>
                </div>
                <div class="strategy-card">
                    <div class="strategy-icon">⚡</div>
                    <div class="strategy-name">中小盘成长 SMID Growth</div>
                    <div class="strategy-desc">高成长性中小盘股，PEG 合理，发掘下一个十倍股</div>
                </div>
                <div class="strategy-card">
                    <div class="strategy-icon">📡</div>
                    <div class="strategy-name">Seeking Alpha</div>
                    <div class="strategy-desc">整合 Seeking Alpha 评级与 Quant 信号，AI 二次筛选验证</div>
                </div>
            </div>
        </div>

        <!-- Core Features -->
        <div>
            <div class="section-label">✨ 核心功能</div>
            <div class="features">
                <div class="feature">
                    <div class="feature-icon">📊</div>
                    <div class="feature-label">AI 深度研报</div>
                </div>
                <div class="feature">
                    <div class="feature-icon">🔬</div>
                    <div class="feature-label">多维度筛选</div>
                </div>
                <div class="feature">
                    <div class="feature-icon">📋</div>
                    <div class="feature-label">自选股追踪</div>
                </div>
            </div>
        </div>

        <!-- Data Source -->
        <div class="data-card">
            <div class="data-icon">🏦</div>
            <div>
                <div class="data-title">FMP 官方数据源</div>
                <div class="data-desc">每日自动拉取 Financial Modeling Prep API，覆盖 P/E、P/B、ROE、FCF、营收增长等 20+ 核心指标，确保数据的准确性与时效性</div>
            </div>
        </div>

        <!-- CTA -->
        <div class="cta-section">
            <a href="${frontendUrl}" class="cta-btn">🚀 立即注册 / 登录</a>
            <p class="cta-sub">解锁完整 AI 选股工具、深度研报、自选股管理与多策略回测</p>
        </div>
    </main>

    <footer>
        <p>Disclaimer: AI-generated analysis for reference only. Not investment advice.</p>
        <p style="margin-top:0.25rem; font-weight:500; color: var(--slate-400);">© ${currentYear} Vanpower Market Intelligence</p>
    </footer>
</body>
</html>`;

  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=86400",
    },
  });
}

function _renderErrorPage(errorMsg: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Error | Vanpower AI</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
    <style>
        body { font-family:'Inter',sans-serif; background:#0A192F; color:#e2e8f0; min-height:100vh; display:flex; align-items:center; justify-content:center; padding:1.5rem; margin:0; }
        .card { width:100%; max-width:28rem; background:#112240; border-radius:1rem; padding:2rem; border:1px solid rgba(239,68,68,0.2); text-align:center; }
        h1 { font-size:1.25rem; font-weight:700; color:#fff; margin:1rem 0 0.5rem; }
        p { color:#94a3b8; font-size:0.875rem; line-height:1.625; margin-bottom:1.5rem; }
        a { display:inline-block; padding:0.625rem 1.5rem; border-radius:0.75rem; background:#64FFDA; color:#071120; font-weight:700; font-size:0.875rem; text-decoration:none; }
    </style>
</head>
<body>
    <div class="card">
        <h1>Error</h1>
        <p>${escapeHtml(errorMsg)}</p>
        <a href="https://gems.vanpower.live">Go to Home</a>
    </div>
</body>
</html>`;
}
