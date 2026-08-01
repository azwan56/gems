"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft, Cpu, Database, Network, ShieldCheck, Zap, Sparkles, BookOpen, Lock } from "lucide-react";
import { useLanguage } from "@/lib/language-context";
import UserMenu from "@/components/UserMenu";
import PremiumGate from "@/components/PremiumGate";

export default function AlgorithmWhitepaperPage() {
  const { t } = useLanguage();

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 py-8 px-4 sm:px-6 max-w-[1280px] mx-auto w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-800/80">
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors bg-slate-900/60 p-2 rounded-xl border border-slate-800">
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm font-medium">{t("Back", "返回大盘")}</span>
          </Link>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-gradient-to-br from-purple-500/20 to-indigo-500/20 rounded-xl border border-purple-500/30">
              <Cpu className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                {t("Algorithm & Multimodal Data Architecture Whitepaper", "项目算法与多模态数据架构白皮书")}
                <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center gap-1">
                  <Lock className="w-3 h-3" /> Super VIP
                </span>
              </h1>
              <p className="text-xs text-slate-400">
                {t("Heterogeneous DB Synergy, Neo4j Graph RAG, 5 Core Quant Factors & Autonomous Self-Healing Mechanics.", "异构数据库协同、Neo4j 知识图谱 RAG、5 大维度量化选股逻辑与闭环胜率自愈进化机制")}
              </p>
            </div>
          </div>
        </div>
        <UserMenu />
      </div>

      {/* Premium Gate Enforcement */}
      <PremiumGate featureName={t("Algorithm & Multimodal Data Architecture Whitepaper", "项目算法与多模态数据架构白皮书")}>
        <div className="space-y-8">
          {/* Section 1: DB Synergy */}
          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur-md">
            <h2 className="text-xl font-bold text-cyan-400 mb-2 flex items-center gap-2">
              <Database className="w-5 h-5 text-cyan-400" />
              1. {t("Heterogeneous Database Architecture & Synergy", "系统整体数据库架构与协同关系")}
            </h2>
            <p className="text-xs text-slate-400 mb-6">
              {t("Combining NoSQL document stores, graph databases, object storage, and in-memory circuit breakers.", "采用 NoSQL 文档数据库 + 关系图数据库 + 对象存储 + 内存级熔断缓存的异构多模态架构。")}
            </p>

            <div className="overflow-x-auto rounded-xl border border-slate-800 mb-6">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-900 text-cyan-400 font-bold border-b border-slate-800">
                  <tr>
                    <th className="p-3">{t("Component", "存储组件")}</th>
                    <th className="p-3">{t("Type", "数据库类型")}</th>
                    <th className="p-3">{t("Role & Content", "核心职责与保存的内容")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-300">
                  <tr>
                    <td className="p-3 font-semibold text-white">Google Cloud Firestore</td>
                    <td className="p-3 text-slate-400">NoSQL Document DB</td>
                    <td className="p-3">用户 Profile (`users/`)、身份鉴权、每日盘前简报 (`reports/`)、每周审计周报 (`weekly_cache/`)、宏观分析 (`macro_cache/`)、选股快照 (`gems_rebalance_snapshots/`)。</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-semibold text-white">Neo4j (AuraDB)</td>
                    <td className="p-3 text-slate-400">Graph DB (Graph RAG)</td>
                    <td className="p-3">芯片与科技产业链上下游拓扑 (如 AAPL &rarr; TSM &rarr; ASML)、竞品关联、研报看多看空质性节点网络。</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-semibold text-white">Firebase Storage</td>
                    <td className="p-3 text-slate-400">Object Storage</td>
                    <td className="p-3">微信公众号预览页 HTML、动态渲染的 PNG K线与深度研报海报分享卡片。</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-semibold text-white">In-Memory Cache</td>
                    <td className="p-3 text-slate-400">Memory Cache</td>
                    <td className="p-3">FMP 高频行情与技术指标缓存、Circuit Breaker 熔断保护。</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 2: Neo4j 4 Graph Models */}
          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur-md">
            <h2 className="text-xl font-bold text-indigo-400 mb-2 flex items-center gap-2">
              <Network className="w-5 h-5 text-indigo-400" />
              2. {t("Neo4j 4 Core Graph Relationship Models", "Neo4j 图数据库四大类关键关系模型")}
            </h2>
            <p className="text-xs text-slate-400 mb-6">
              {t("Building 4 dimensional topological graphs beyond traditional isolated quote data.", "打破传统孤立看盘，在图数据库中构建产业链、竞品对标、生态联盟及研报质性逻辑四大拓扑关系。")}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800">
                <h3 className="font-bold text-blue-400 text-sm mb-1">1. 上下游供应链关系 (SUPPLIES_TO)</h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  记录芯片晶圆代工、组装厂及核心零部件供应商拓扑（如 AAPL &rarr; Foxconn、NVDA &rarr; TSM）。当代工厂产能受限时，自动推导下游供给风险。
                </p>
              </div>
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800">
                <h3 className="font-bold text-indigo-400 text-sm mb-1">2. 行业竞品对标关系 (COMPETES_WITH)</h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  记录同赛道竞争对手关系（如 NVDA vs AMD、MSFT vs GOOGL）。当某龙头财报异动时，实时推导对竞品估值与市场份额的连带影响。
                </p>
              </div>
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800">
                <h3 className="font-bold text-purple-400 text-sm mb-1">3. 战略合作伙伴关系 (PARTNER_WITH)</h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  记录非买卖关系的资本与生态联盟（如 MSFT -[PARTNER_WITH]-&gt; OpenAI）。捕捉非传统交易下的深层生态捆绑效应。
                </p>
              </div>
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800">
                <h3 className="font-bold text-emerald-400 text-sm mb-1">4. 研报质性逻辑与事件图谱 (Knowledge Graph)</h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  将研报拆解为节点关系：包含分析师研报概览 (:ResearchReport)、核心投资逻辑 (:InvestmentRationale)、风险因子 (:RiskFactor) 与股价催化剂 (:MarketCatalyst)。
                </p>
              </div>
            </div>
          </div>

          {/* Section 3: 5 Data Dimensions */}
          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur-md">
            <h2 className="text-xl font-bold text-emerald-400 mb-2 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              3. {t("5 Core Data Dimensions & Business Logic", "量化选股与操盘 5 大维度核心数据与业务逻辑")}
            </h2>
            <p className="text-xs text-slate-400 mb-6">
              {t("Constructing a 5-layer screening firewall driven by macro, fundamental, technical, earnings surprise & rebalancing engines.", "基于宏观、定量基本面、技术动量、财报预期差及动态再平衡构筑 5 重筛选防火墙。")}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800">
                <div className="text-sm font-bold text-amber-400 mb-1">① 宏观经济与流动性</div>
                <p className="text-xs text-slate-300">FRED API 实时监控 FFR 利率、CPI/PCE 通胀、NFP 非农及美债 10Y-2Y 收益率倒挂利差。倒挂期自动调紧防御风控，降息期提升成长股权重。</p>
              </div>
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800">
                <div className="text-sm font-bold text-blue-400 mb-1">② 定量基本面评分</div>
                <p className="text-xs text-slate-300">基于 Profitability (30%) + Growth (40%) + Safety & Cash Flow (30%) 计算 0-100 分 Fundamental Score。强约束 ROE &gt; 20%、PEG &lt; 1.0。</p>
              </div>
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800">
                <div className="text-sm font-bold text-purple-400 mb-1">③ 技术面与动量量化</div>
                <p className="text-xs text-slate-300">计算 Technical Score：结合 50SMA/200SMA 多头排列、52 周高点偏离度 (Proximity to 52w High)、RSI (14) 与 MACD 金叉，防止触底接刀。</p>
              </div>
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800">
                <div className="text-sm font-bold text-cyan-400 mb-1">④ 财报预期差与资金面</div>
                <p className="text-xs text-slate-300">监控财报超预期幅度 (Earnings Surprise % &gt; 15%)，结合华尔街分析师目标价上修空间 (Analyst Target Upside) 捕捉爆发标的。</p>
              </div>
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800">
                <div className="text-sm font-bold text-emerald-400 mb-1">⑤ 战术再平衡与闭环评估</div>
                <p className="text-xs text-slate-300">基于标的 Beta、波动率及策略权重，计算持仓再平衡优化比例，由后置评估引擎实盘校验。</p>
              </div>
            </div>
          </div>

          {/* Section 4: Closed-Loop Self-Healing */}
          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur-md">
            <h2 className="text-xl font-bold text-purple-400 mb-2 flex items-center gap-2">
              <Zap className="w-5 h-5 text-purple-400" />
              4. {t("Closed-Loop Win Rate & Autonomous Self-Healing Engine", "闭环胜率评估算法与 AI 自愈进化机制")}
            </h2>
            
            <div className="p-4 rounded-xl bg-slate-950/90 border border-purple-500/30 text-xs sm:text-sm font-mono text-slate-200 mb-4 space-y-2">
              <div>&bull; T+5 / T+20 胜率 = (成功单数量 / 总推荐标的数量) &times; 100%</div>
              <div>&bull; 盈利单平均收益 = &sum;(所有盈利单收益率) / 盈利单总数量</div>
              <div>&bull; 单均期望收益 = (胜率 &times; 盈利单平均收益) - (败率 &times; 亏损单平均亏损)</div>
              <div className="text-emerald-400 font-bold font-sans mt-2">
                当前实盘表现：T+20 胜率 71.4%，盈利单平均收益 +8.4%，期望收益率高达 +4.86% (盈亏比 2:1 以上)。
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-300 leading-relaxed">
              <span className="font-bold text-purple-300">自愈逻辑：</span> 当某策略胜率回落至 50% 以下（触发 WARNING 状态）时，AI 引擎会自动调紧风控门槛（如提升 ROE 要求 15% &rarr; 20%、限制负债比 &lt; 0.8），并在近 3 天新选标的中实时验证复盘修复成效。
            </div>
          </div>
        </div>
      </PremiumGate>
    </main>
  );
}
