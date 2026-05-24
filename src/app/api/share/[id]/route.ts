// ============================================================
// GET /api/share/[id] — View a shared analysis report
// Returns a mobile-optimized H5 landing page with partial content
// and a registration wall CTA.
// ============================================================

import { NextRequest, NextResponse } from "next/server";

// We need to escape HTML to prevent XSS
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

  try {
    const { getDb } = await import("@/lib/firebase");
    const db = getDb();
    
    const doc = await db.collection("gems_share_cards").doc(shareId).get();
    if (!doc.exists) {
      return new NextResponse(_renderErrorPage("The report you are looking for does not exist or has been removed."), {
        status: 404,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    const data = doc.data()!;
    const symbol = escapeHtml(data.symbol);
    const strategyName = escapeHtml(data.strategyName || "Stock Deep Dive");
    const report = data.report || {};
    const dateStr = new Date(data.createdAt).toISOString().slice(0, 10);
    
    // Parse rationale
    const rationale: string[] = Array.isArray(report.rationale) ? report.rationale : [];
    const visibleBullets = rationale.slice(0, 2);
    const lockedBullets = rationale.slice(2);
    if (lockedBullets.length === 0) {
      // Always show something as locked to encourage signups
      lockedBullets.push("Placeholder for locked content");
    }

    const title = `${symbol} AI Investment Analysis`;
    const ogDesc = visibleBullets.length > 0 ? escapeHtml(visibleBullets[0]).substring(0, 190) + "..." : title;

    // Visible content HTML
    let visibleHtml = "";
    if (visibleBullets.length > 0) {
      const bulletsLi = visibleBullets.map(b => `<li class="bullet-item"><span class="bullet-dot">•</span><span>${escapeHtml(b)}</span></li>`).join("");
      visibleHtml = `
        <div class="glass-card slide-card">
            <div class="slide-header">
                <h3>AI Core Views</h3>
            </div>
            <ul class="bullet-list">
                ${bulletsLi}
            </ul>
        </div>
      `;
    } else if (report.overview) {
       visibleHtml = `
        <div class="glass-card slide-card">
            <div class="slide-header">
                <h3>Overview</h3>
            </div>
            <p style="font-size: 0.875rem; color: var(--slate-300); line-height: 1.625;">${escapeHtml(report.overview)}</p>
        </div>
      `;
    }

    // Locked content HTML
    const lockedLi = lockedBullets.map(() => `<li class="bullet-item locked-text"><span class="bullet-dot-muted">•</span><span class="blur-text">Placeholder text for blur</span></li>`).join("");
    const lockedHtml = `
        <div class="glass-card slide-card locked-card">
            <div class="slide-header locked-header">
                <h3>🔒 More Deep Insights Locked</h3>
            </div>
            <ul class="bullet-list">
                ${lockedLi}
                <li class="bullet-item locked-text"><span class="bullet-dot-muted">•</span><span class="blur-text">Another line of locked analysis text</span></li>
            </ul>
        </div>
    `;

    // Price indicator
    let indicatorHtml = "";
    const targetPrice = report.analyst?.targetPrice;
    const upside = report.analyst?.upside;
    const consensus = report.analyst?.consensus;
    
    if (targetPrice && upside) {
        const isUp = upside.includes("+");
        const badgeClass = isUp ? "badge-emerald" : "badge-rose";
        indicatorHtml = `
        <div class="flex-row items-baseline gap-3" style="margin-bottom: 10px;">
            <div style="display:flex; flex-direction:column; gap:2px;">
              <span style="font-size:0.75rem; color:var(--slate-400);">Target Price</span>
              <span class="price-text">${escapeHtml(targetPrice)}</span>
            </div>
            <span class="badge ${badgeClass}">
                ${escapeHtml(upside)}
            </span>
            <span class="badge badge-teal" style="margin-left:auto;">
                ${escapeHtml(consensus || "")}
            </span>
        </div>
        `;
    }

    const frontendUrl = "https://gems.vanpower.live";
    const currentYear = new Date().getFullYear();

    const h5Template = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>${title} | Vanpower AI</title>
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${ogDesc}" />
    <meta property="og:type" content="article" />
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <style>
        :root {
            --navy-950: #071120;
            --navy-900: #0A192F;
            --navy-800: #112240;
            --navy-700: #233554;
            --teal-400: #64FFDA;
            --teal-500: #14b8a6;
            --slate-200: #e2e8f0;
            --slate-300: #cbd5e1;
            --slate-400: #94a3b8;
            --slate-500: #64748b;
            --slate-600: #475569;
            --slate-700: #334155;
            --slate-800: #1e293b;
            --emerald-400: #34d399;
            --rose-400: #fb7185;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background-color: var(--navy-900);
            color: var(--slate-200);
            -webkit-font-smoothing: antialiased;
            display: flex;
            flex-direction: column;
            min-height: 100vh;
        }
        ::selection { background-color: rgba(20, 184, 166, 0.3); color: #fff; }
        
        /* Layout */
        .flex-row { display: flex; align-items: center; }
        .justify-between { justify-content: space-between; }
        .items-baseline { align-items: baseline; }
        .gap-3 { gap: 0.75rem; }
        
        /* Header */
        header {
            width: 100%;
            background: rgba(17, 34, 64, 0.8);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            border-bottom: 1px solid var(--slate-800);
            padding: 1rem 1.5rem;
            position: sticky;
            top: 0;
            z-index: 50;
        }
        .logo-dot { width: 10px; height: 10px; border-radius: 50%; background-color: var(--teal-400); margin-right: 0.5rem; animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: .5; } }
        .logo-text { font-size: 1rem; font-weight: 800; letter-spacing: 0.05em; color: #fff; }
        .logo-text span { color: var(--teal-400); }
        .badge-top { font-size: 0.75rem; font-weight: 600; padding: 0.125rem 0.5rem; border-radius: 0.25rem; border: 1px solid rgba(100,255,218,0.2); background: rgba(100,255,218,0.1); color: var(--teal-400); }
        
        /* Main content */
        main { width: 100%; max-width: 32rem; margin: 0 auto; padding: 1.5rem 1rem; flex: 1; display: flex; flex-direction: column; gap: 1.5rem; }
        .meta-row { font-size: 0.75rem; color: var(--slate-400); display: flex; justify-content: space-between; margin-bottom: 0.75rem; }
        .main-title { font-size: 2.5rem; font-weight: 800; color: #fff; letter-spacing: -0.025em; line-height: 1.1; margin-bottom: 0.5rem; }
        
        /* Indicators */
        .badge { display: inline-flex; align-items: center; padding: 0.25rem 0.75rem; border-radius: 0.5rem; font-size: 0.875rem; font-weight: 700; border: 1px solid; }
        .badge-teal { background: rgba(100,255,218,0.1); border-color: rgba(100,255,218,0.2); color: var(--teal-400); }
        .badge-emerald { background: rgba(52,211,153,0.1); border-color: rgba(52,211,153,0.2); color: var(--emerald-400); }
        .badge-rose { background: rgba(251,113,133,0.1); border-color: rgba(251,113,133,0.2); color: var(--rose-400); }
        .price-text { font-size: 2rem; font-weight: 800; color: #fff; line-height:1;}
        
        /* Section Title */
        .section-title { font-size: 0.875rem; font-weight: 700; color: var(--slate-400); letter-spacing: 0.05em; text-transform: uppercase; display: flex; align-items: center; margin-bottom: 1.25rem; }
        .section-title::before { content: ''; display: inline-block; width: 6px; height: 16px; background-color: var(--teal-400); border-radius: 9999px; margin-right: 0.5rem; }
        
        /* Cards */
        .glass-card { background: rgba(17, 34, 64, 0.7); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); border: 1px solid rgba(51,65,85,0.3); border-radius: 1rem; padding: 1.25rem; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04); margin-bottom: 1rem; }
        .slide-header { border-left: 4px solid var(--teal-500); padding-left: 0.75rem; margin-bottom: 1rem; }
        .slide-header h3 { font-size: 1rem; font-weight: 700; color: #fff; }
        
        .bullet-list { list-style: none; display: flex; flex-direction: column; gap: 0.625rem; }
        .bullet-item { display: flex; align-items: flex-start; font-size: 0.875rem; color: var(--slate-300); line-height: 1.625; }
        .bullet-dot { color: var(--teal-400); font-weight: 700; margin-right: 0.5rem; }
        
        /* Locked Content */
        .teaser-section { position: relative; overflow: hidden; padding-top: 1rem; padding-bottom: 8rem; }
        .locked-card { opacity: 0.4; user-select: none; border-color: rgba(30,41,59,0.3); }
        .locked-header { border-color: var(--slate-700); }
        .locked-header h3 { color: var(--slate-400); filter: blur(2px); }
        .locked-text { color: var(--slate-400); }
        .bullet-dot-muted { color: var(--slate-600); margin-right: 0.5rem; }
        .blur-text { background: var(--slate-800); color: transparent; border-radius: 0.25rem; filter: blur(4px); padding: 0 2rem; }
        
        /* CTA Overlay */
        .cta-overlay { position: absolute; bottom: 0; left: 0; width: 100%; height: 320px; background: linear-gradient(to top, var(--navy-900) 0%, rgba(10,25,47,0.95) 40%, transparent 100%); display: flex; flex-direction: column; justify-content: flex-end; align-items: center; padding: 0 1rem 1rem 1rem; pointer-events: none; }
        .cta-card { pointer-events: auto; width: 100%; max-width: 24rem; border-color: rgba(20,184,166,0.25); box-shadow: 0 0 30px rgba(100, 255, 218, 0.15); text-align: center; display: flex; flex-direction: column; gap: 1rem; z-index: 10; margin-bottom: 0; }
        .cta-icon { width: 3rem; height: 3rem; border-radius: 50%; background: rgba(100,255,218,0.1); color: var(--teal-400); display: flex; align-items: center; justify-content: center; margin: 0 auto; }
        .cta-icon svg { width: 1.5rem; height: 1.5rem; }
        .cta-title { font-size: 1.125rem; font-weight: 700; color: #fff; margin-bottom: 0.25rem; }
        .cta-desc { font-size: 0.75rem; color: var(--slate-400); line-height: 1.625; }
        .cta-btn { display: block; width: 100%; padding: 0.75rem 1rem; border-radius: 0.75rem; background-color: var(--teal-400); color: var(--navy-950); font-weight: 700; font-size: 0.875rem; text-decoration: none; letter-spacing: 0.025em; transition: all 0.3s ease; box-shadow: 0 0 15px rgba(100,255,218,0.2); cursor: pointer; }
        .cta-btn:active { transform: scale(0.95); }
        
        /* Footer */
        footer { width: 100%; padding: 1.5rem; text-align: center; color: var(--slate-600); font-size: 0.75rem; border-top: 1px solid var(--slate-800); background: rgba(10,25,47,0.4); }
        footer p { line-height: 1.625; }
        .copyright { margin-top: 0.5rem; color: var(--slate-500); font-weight: 500; }
    </style>
</head>
<body>
    <header class="flex-row justify-between">
        <div class="flex-row items-baseline">
            <div class="logo-dot"></div>
            <span class="logo-text">VANPOWER <span>AI</span></span>
        </div>
        <span class="badge-top">${strategyName}</span>
    </header>

    <main>
        <div>
            <div class="meta-row">
                <span>Date: ${dateStr}</span>
                <span>Source: Vanpower Gems</span>
            </div>
            <h1 class="main-title">${symbol}</h1>
            <div style="margin-top: 0.5rem;">
                ${indicatorHtml}
            </div>
        </div>

        <div>
            <h2 class="section-title">Analysis Highlights</h2>
            ${visibleHtml}
        </div>

        <div class="teaser-section">
            <div style="display: flex; flex-direction: column; gap: 1.25rem;">
                ${lockedHtml}
            </div>

            <div class="cta-overlay">
                <div class="glass-card cta-card">
                    <div class="cta-icon">
                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
                        </svg>
                    </div>
                    <div>
                        <h3 class="cta-title">Sign in to unlock full report</h3>
                        <p class="cta-desc">Unlock full AI rationale, risk analysis, fundamental metrics, and the complete stock screening tools.</p>
                    </div>
                    <a href="${frontendUrl}" class="cta-btn">Sign In / Register</a>
                </div>
            </div>
        </div>
    </main>

    <footer>
        <p>Disclaimer: This report is generated by Vanpower AI engine based on public data. It is for reference only and does not constitute any investment advice.</p>
        <p class="copyright">© ${currentYear} Vanpower Market Intelligence</p>
    </footer>
</body>
</html>`;

    return new NextResponse(h5Template, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=86400",
      },
    });

  } catch (e) {
    console.error("Error serving share landing page:", e);
    return new NextResponse(_renderErrorPage("Internal server error. Please try again later."), {
      status: 500,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }
}

function _renderErrorPage(errorMsg: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Report Error | Vanpower AI</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
        body {
            font-family: 'Inter', sans-serif;
            background-color: #0A192F;
            color: #e2e8f0;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 1.5rem;
            margin: 0;
        }
        .error-card {
            width: 100%;
            max-width: 28rem;
            background-color: #112240;
            border-radius: 1rem;
            padding: 2rem;
            border: 1px solid rgba(239, 68, 68, 0.2);
            text-align: center;
        }
        .error-title { font-size: 1.25rem; font-weight: 700; color: #fff; margin: 1rem 0 0.5rem; }
        .error-desc { color: #94a3b8; font-size: 0.875rem; line-height: 1.625; margin-bottom: 1.5rem; }
        .back-btn {
            display: inline-block;
            padding: 0.625rem 1.5rem;
            border-radius: 0.75rem;
            background-color: #64FFDA;
            color: #071120;
            font-weight: 700;
            font-size: 0.875rem;
            text-decoration: none;
        }
    </style>
</head>
<body>
    <div class="error-card">
        <h1 class="error-title">Report Error</h1>
        <p class="error-desc">${escapeHtml(errorMsg)}</p>
        <a href="https://gems.vanpower.live" class="back-btn">Go to Home</a>
    </div>
</body>
</html>`;
}
