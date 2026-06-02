"use client";

import { useEffect, useState, useCallback } from "react";
import { Scale, TrendingUp, TrendingDown, RefreshCw, Save, Trash2, CheckCircle2, ShieldAlert, Trophy, Skull } from "lucide-react";
import { useLanguage } from "@/lib/language-context";
import { useAuth } from "@/lib/auth-context";
import PremiumGate from "@/components/PremiumGate";

// Client-side type matching the server's AlertSnapshot shape.
// Defined inline to avoid importing server-only rebalance-store.ts.
interface AlertSnapshot {
  date: string;
  period: "MTD" | "QTD";
  macro: {
    spyReturn: number;
    bndReturn: number;
    spread: number;
    isEquityOutperforming: boolean;
    thresholdExceeded: boolean;
    signal: "SELL_EQUITY" | "BUY_EQUITY" | "NEUTRAL";
  };
  micro: {
    winners: { symbol: string; return: number }[];
    losers: { symbol: string; return: number }[];
  } | null;
  alertsSent: number;
  createdAt: string;
}

export default function RebalanceDashboard() {
  const { t } = useLanguage();
  const { user, getIdToken } = useAuth();
  const [loading, setLoading] = useState(true);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [email, setEmail] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [snapshots, setSnapshots] = useState<AlertSnapshot[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Helper to build auth headers
  const authHeaders = useCallback(async (): Promise<Record<string, string>> => {
    const token = await getIdToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, [getIdToken]);

  // Fetch initial data
  useEffect(() => {
    async function fetchData() {
      try {
        const headers = await authHeaders();
        const [webhookRes, dataRes] = await Promise.all([
          fetch("/api/rebalance-webhook", { headers }),
          fetch("/api/rebalance-data?limit=5", { headers })
        ]);

        if (webhookRes.ok) {
          const config = await webhookRes.json();
          setConfigured(config.configured);
          setEnabled(config.enabled);
          if (config.webhookUrl) {
            setWebhookUrl(config.webhookUrl);
          }
          if (config.email) {
            setEmail(config.email);
          }
        }

        if (dataRes.ok) {
          const data = await dataRes.json();
          setSnapshots(data.snapshots || []);
        }
      } catch (err) {
        console.error("Failed to load dashboard data:", err);
      } finally {
        setLoading(false);
      }
    }
    if (user?.isPremium) fetchData();
    else setLoading(false);
  }, [user?.uid, user?.isPremium, authHeaders]);

  const handleSaveWebhook = async () => {
    if (!webhookUrl && !email && !configured) return;
    
    setSaving(true);
    setMessage(null);
    try {
      const headers = await authHeaders();
      const res = await fetch("/api/rebalance-webhook", {
        method: "PUT",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ webhookUrl, email, enabled }),
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to save webhook");
      
      setConfigured(true);
      if (data.webhookUrl) setWebhookUrl(data.webhookUrl); // Show masked URL
      if (data.email) setEmail(data.email);
      setEnabled(data.enabled);
      setMessage({ text: t("Settings saved successfully.", "设置保存成功。"), type: "success" });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setMessage({ text: msg, type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteWebhook = async () => {
    if (!confirm(t("Are you sure you want to remove your webhook?", "确定要删除你的 Webhook 吗？"))) return;
    
    setSaving(true);
    try {
      const headers = await authHeaders();
      const res = await fetch("/api/rebalance-webhook", { method: "DELETE", headers });
      if (!res.ok) throw new Error("Failed to delete webhook");
      
      setConfigured(false);
      setWebhookUrl("");
      setEmail("");
      setEnabled(false);
      setMessage({ text: t("Settings removed.", "设置已移除。"), type: "success" });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setMessage({ text: msg, type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const latest = snapshots[0];

  return (
    <main className="min-h-screen flex flex-col py-8 px-4 sm:px-6 max-w-[1200px] mx-auto w-full">
      <PremiumGate featureName={t("Rebalancing Dashboard", "再平衡监控仪表盘")}>
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight mb-2 flex items-center gap-3">
              <Scale className="w-8 h-8 text-blue-400" />
              {t("Rebalancing Radar", "再平衡监控雷达")}
            </h1>
            <p className="text-slate-400">
              {t("Monitor 60/40 macro drift and window dressing anomalies for institutional flows.", "监控 60/40 宏观漂移和季末橱窗粉饰效应，捕捉机构资金流向。")}
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 text-slate-500">
            <RefreshCw className="w-6 h-6 animate-spin mr-3" />
            Loading dashboard data...
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Left Column: Data Panels */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* Macro Drift Panel */}
              <div className="glass-panel p-6">
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-indigo-400" />
                  {t("Macro Drift (SPY vs BND)", "宏观漂移 (SPY vs BND)")}
                </h2>
                
                {!latest ? (
                  <p className="text-slate-500 py-4">{t("No data available yet.", "暂无可用数据。")}</p>
                ) : (
                  <div>
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-4">
                        <div className="text-sm">
                          <p className="text-slate-400 mb-1">{t("Period", "周期")}</p>
                          <p className="font-bold text-lg">{latest.period}</p>
                        </div>
                        <div className="text-sm">
                          <p className="text-slate-400 mb-1">{t("Last Updated", "最后更新")}</p>
                          <p className="font-mono text-slate-300">{latest.date}</p>
                        </div>
                      </div>
                      
                      {/* Signal Badge */}
                      <div className={`px-4 py-2 rounded-full font-bold flex items-center gap-2 ${
                        latest.macro.signal === "SELL_EQUITY" ? "bg-red-500/20 text-red-400 border border-red-500/30" :
                        latest.macro.signal === "BUY_EQUITY" ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" :
                        "bg-slate-700/50 text-slate-300 border border-slate-600"
                      }`}>
                        {latest.macro.signal === "SELL_EQUITY" && <TrendingDown className="w-4 h-4" />}
                        {latest.macro.signal === "BUY_EQUITY" && <TrendingUp className="w-4 h-4" />}
                        {latest.macro.signal === "NEUTRAL" && <Scale className="w-4 h-4" />}
                        
                        {latest.macro.signal === "SELL_EQUITY" ? t("Equities Overheated (Sell Risk)", "股市过热 (面临抛售风险)") :
                         latest.macro.signal === "BUY_EQUITY" ? t("Equities Oversold (Buy Flow)", "股市超跌 (面临买入资金)") :
                         t("Neutral (No Action)", "中性 (无需操作)")}
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4 mb-2">
                      <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700/50">
                        <p className="text-slate-400 text-xs mb-1">SPY Return</p>
                        <p className={`text-2xl font-mono ${latest.macro.spyReturn >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                          {latest.macro.spyReturn >= 0 ? "+" : ""}{latest.macro.spyReturn.toFixed(2)}%
                        </p>
                      </div>
                      <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700/50">
                        <p className="text-slate-400 text-xs mb-1">BND Return</p>
                        <p className={`text-2xl font-mono ${latest.macro.bndReturn >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                          {latest.macro.bndReturn >= 0 ? "+" : ""}{latest.macro.bndReturn.toFixed(2)}%
                        </p>
                      </div>
                      <div className="bg-slate-900/50 p-4 rounded-xl border border-indigo-500/30 relative overflow-hidden">
                        <div className="absolute inset-0 bg-indigo-500/5" />
                        <p className="text-indigo-300 text-xs mb-1 relative z-10">Spread (Drift)</p>
                        <p className={`text-2xl font-mono font-bold relative z-10 ${Math.abs(latest.macro.spread) >= 3.0 ? "text-amber-400" : "text-slate-200"}`}>
                          {latest.macro.spread >= 0 ? "+" : ""}{latest.macro.spread.toFixed(2)}%
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Micro Anomalies Panel */}
              <div className="glass-panel p-6">
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-amber-400" />
                  {t("Window Dressing Anomalies (Top 100)", "橱窗粉饰效应异常 (纳斯达克100)")}
                </h2>
                
                {!latest?.micro ? (
                  <p className="text-slate-500 py-4 text-sm">
                    {t("Micro data is only fetched when macro drift exceeds the 3% threshold to conserve API usage.", "为节省API额度，仅在宏观漂移超过 3% 阈值时才会获取微观成分股数据。")}
                  </p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Winners */}
                    <div>
                      <h3 className="text-sm font-bold text-emerald-400 flex items-center gap-2 mb-3">
                        <Trophy className="w-4 h-4" />
                        {t("Top Performers (Buy Momentum)", "最强表现 (面临追涨资金)")}
                      </h3>
                      <div className="space-y-2">
                        {latest.micro.winners.slice(0, 5).map((stock, i) => (
                          <div key={stock.symbol} className="flex items-center justify-between p-2 rounded bg-slate-900/50 border border-slate-700/50">
                            <div className="flex items-center gap-3">
                              <span className="text-slate-500 text-xs font-mono w-4">{i + 1}</span>
                              <span className="font-bold">{stock.symbol}</span>
                            </div>
                            <span className="text-emerald-400 font-mono text-sm">+{stock.return.toFixed(2)}%</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Losers */}
                    <div>
                      <h3 className="text-sm font-bold text-red-400 flex items-center gap-2 mb-3">
                        <Skull className="w-4 h-4" />
                        {t("Worst Performers (Sell Risk)", "最差表现 (面临抛售剔除风险)")}
                      </h3>
                      <div className="space-y-2">
                        {latest.micro.losers.slice(0, 5).map((stock, i) => (
                          <div key={stock.symbol} className="flex items-center justify-between p-2 rounded bg-slate-900/50 border border-slate-700/50">
                            <div className="flex items-center gap-3">
                              <span className="text-slate-500 text-xs font-mono w-4">{i + 1}</span>
                              <span className="font-bold">{stock.symbol}</span>
                            </div>
                            <span className="text-red-400 font-mono text-sm">{stock.return.toFixed(2)}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Webhook Settings */}
            <div className="space-y-6">
              <div className="glass-panel p-6 border-blue-500/30 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-3 opacity-10">
                  <CheckCircle2 className="w-24 h-24" />
                </div>
                
                <h2 className="text-lg font-bold mb-2">{t("Alerts Settings", "预警推送设置")}</h2>
                <p className="text-sm text-slate-400 mb-6 leading-relaxed relative z-10">
                  {t("Receive automated alerts directly in your Discord server or via Email when the warning window opens.", "当月末/季末预警窗口开启时，自动将结果推送到你的 Discord 频道或邮箱。")}
                </p>

                {message && (
                  <div className={`p-3 rounded-lg mb-4 text-sm font-medium ${
                    message.type === "success" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-red-500/10 text-red-400 border border-red-500/20"
                  }`}>
                    {message.text}
                  </div>
                )}

                <div className="space-y-4 relative z-10">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wider">
                      {t("Discord Webhook URL", "Discord Webhook 地址")}
                    </label>
                    <input
                      type="text"
                      value={webhookUrl}
                      onChange={(e) => setWebhookUrl(e.target.value)}
                      placeholder="https://discord.com/api/webhooks/..."
                      className="w-full bg-slate-900/80 border border-slate-700 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wider">
                      {t("Email Address", "电子邮箱地址")}
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="alerts@example.com"
                      className="w-full bg-slate-900/80 border border-slate-700 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                    />
                  </div>

                  <label className="flex items-center gap-3 cursor-pointer group p-2 -ml-2 rounded-lg hover:bg-slate-800/50 transition-colors">
                    <input
                      type="checkbox"
                      checked={enabled}
                      onChange={(e) => setEnabled(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-600 bg-slate-900 text-blue-500 focus:ring-blue-500 focus:ring-offset-slate-800"
                    />
                    <span className="text-sm font-medium group-hover:text-blue-300 transition-colors">
                      {t("Enable Alerts", "开启推送")}
                    </span>
                  </label>

                  <div className="flex items-center gap-3 pt-2">
                    <button
                      onClick={handleSaveWebhook}
                      disabled={saving || (!webhookUrl && !email)}
                      className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors"
                    >
                      {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      {t("Save Settings", "保存设置")}
                    </button>
                    
                    {configured && (
                      <button
                        onClick={handleDeleteWebhook}
                        disabled={saving}
                        className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors border border-transparent hover:border-red-500/20"
                        title={t("Remove Settings", "移除设置")}
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Snapshot History */}
              <div className="glass-panel p-6">
                <h2 className="text-lg font-bold mb-4">{t("Recent Scans", "近期扫描记录")}</h2>
                {snapshots.length === 0 ? (
                  <p className="text-sm text-slate-500">{t("No history yet.", "暂无记录。")}</p>
                ) : (
                  <div className="space-y-3">
                    {snapshots.slice(0, 5).map((snap, i) => (
                      <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-slate-900/40 border border-slate-700/50">
                        <div>
                          <p className="text-xs font-mono text-slate-400">{snap.date}</p>
                          <p className={`text-sm font-bold ${
                            snap.macro.signal === "SELL_EQUITY" ? "text-red-400" :
                            snap.macro.signal === "BUY_EQUITY" ? "text-emerald-400" : "text-slate-300"
                          }`}>
                            {snap.macro.signal.replace("_", " ")}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-slate-500">Spread</p>
                          <p className="text-sm font-mono font-bold">{snap.macro.spread > 0 ? "+" : ""}{snap.macro.spread.toFixed(1)}%</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

          </div>
        )}
      </PremiumGate>
    </main>
  );
}
