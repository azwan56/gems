"use client";

import React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Cpu,
  Database,
  Network,
  ShieldCheck,
  Zap,
  BookOpen,
  Lock,
  Layers,
  Presentation,
  Activity,
  CheckCircle2,
} from "lucide-react";
import { useLanguage } from "@/lib/language-context";
import UserMenu from "@/components/UserMenu";
import PremiumGate from "@/components/PremiumGate";
import { TermTooltip } from "@/components/TermTooltip";

export default function AlgorithmWhitepaperPage() {
  const { t } = useLanguage();

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 py-5 sm:py-8 px-3 sm:px-6 max-w-[1280px] mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 sm:mb-8 pb-4 border-b border-slate-800/80">
        <div className="flex items-start sm:items-center gap-3 sm:gap-4">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-slate-400 hover:text-white transition-colors bg-slate-900/60 px-3 py-2 rounded-xl border border-slate-800 shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-xs sm:text-sm font-medium">{t("Back", "返回首页")}</span>
          </Link>
          <div className="flex items-start sm:items-center gap-2.5">
            <div className="p-2 bg-gradient-to-br from-cyan-500/20 to-indigo-500/20 rounded-xl border border-cyan-500/30 shrink-0">
              <Layers className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg sm:text-2xl font-bold tracking-tight text-white">
                  {t(
                    "v3.0 Financial Domain Ontology & Quant Architecture Whitepaper",
                    "v3.0 金融领域本体与多模态量化架构白皮书"
                  )}
                </h1>
                <span className="px-2 py-0.5 text-[10px] sm:text-xs font-semibold rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                  v3.0 Release
                </span>
                <span className="px-2 py-0.5 text-[10px] sm:text-xs font-semibold rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center gap-1">
                  <Lock className="w-3 h-3" /> Super VIP
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                {t(
                  "3-Layer Financial Domain Ontology, 5-Tier Storage + 1,500+ Aliyun Research Vault, 27-Sector RRG & Walk-Forward Self-Healing Engine.",
                  "三层金融领域本体 (Ontology)、五层异构存储与 1,500+ 阿里云研报金库、27 板块 RRG 轮动与 Walk-Forward 自愈进化体系"
                )}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <a
            href="/gems_architecture_presentation.html"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/40 text-cyan-300 text-xs font-semibold transition-colors"
          >
            <Presentation className="w-3.5 h-3.5" />
            <span>{t("13-Slide Presentation", "13页交互演播厅")}</span>
          </a>
          <a
            href="/value-proposition.html"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-xs font-medium transition-colors"
          >
            <BookOpen className="w-3.5 h-3.5 text-amber-400" />
            <span>{t("Value Guide", "价值白皮书")}</span>
          </a>
          <UserMenu />
        </div>
      </div>

      {/* Premium Gate Enforcement */}
      <PremiumGate
        featureName={t(
          "v3.0 Financial Ontology & Architecture Whitepaper",
          "v3.0 金融领域本体与数据架构白皮书"
        )}
      >
        <div className="space-y-6 sm:space-y-8">
          {/* Section 1: Three-Layer Financial Domain Ontology */}
          <div className="p-4 sm:p-6 rounded-2xl bg-slate-900/70 border border-cyan-500/30 backdrop-blur-md shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <h2 className="text-lg sm:text-xl font-bold text-cyan-400 flex items-center gap-2">
                <Layers className="w-5 h-5 text-cyan-400 shrink-0" />
                1. {t("Three-Layer Financial Domain Ontology Architecture", "三层金融领域本体架构 (Financial Domain Ontology)")}
              </h2>
              <TermTooltip term="Ontology" className="text-xs text-cyan-300 font-semibold">
                {t("Inspect Ontology Definition", "查看金融本体定义")}
              </TermTooltip>
            </div>
            <p className="text-xs text-slate-400 mb-5 leading-relaxed">
              {t(
                "Inspired by enterprise decision-intelligence ontologies (e.g., Palantir Foundry), our architecture unifies raw market feeds, graph topology, and quantitative execution into three coupled ontological layers—eliminating LLM hallucinations.",
                "借鉴企业级决策智能本体（如 Palantir Foundry）范式，本系统并非将原始数据直接丢给大模型，而是构建了严密的“语义层 — 契约与词汇层 — 动力算子层”三层金融领域本体，从根源上消除 AI 幻觉并实现跨周期自愈。"
              )}
            </p>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Layer 1 */}
              <div className="p-4 rounded-xl bg-slate-950/90 border border-cyan-500/30 flex flex-col">
                <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-cyan-400 mb-1">
                  Layer 1 · Semantic & Knowledge Ontology
                </div>
                <h3 className="text-sm sm:text-base font-bold text-white mb-2">
                  {t("第一层：语义与知识本体 (5-Node Graph)", "第一层：语义与知识本体 (五维实体图谱)")}
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed mb-3 flex-1">
                  {t(
                    "Models the financial world in Neo4j as 5 canonical entity nodes: Stock, Sector (27 ETFs), Strategy (7 Personas), AIReflection (Mistake Book), and Audit (T+5 Verification), connected by SUPPLIES_TO, COMPETES_WITH, PARTNER_WITH, and BELONGS_TO edges.",
                    "在 Neo4j 中将金融世界抽象为 5 类核心实体节点：Stock(标的)、Sector(27板块)、Strategy(7大策略)、AIReflection(错题反思节点) 与 Audit(T+5实盘审计节点)，通过供应链、竞品、生态与研报逻辑边紧密连接。"
                  )}
                </p>
                <div className="text-[11px] font-mono text-cyan-300/90 bg-cyan-950/30 border border-cyan-500/20 rounded-lg px-2.5 py-1.5">
                  (:Stock)-[:SUPPLIES_TO | :COMPETES_WITH]-&gt;(:Stock)
                </div>
              </div>

              {/* Layer 2 */}
              <div className="p-4 rounded-xl bg-slate-950/90 border border-indigo-500/30 flex flex-col">
                <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-indigo-400 mb-1">
                  Layer 2 · Data Contract & Bilingual Lexicon
                </div>
                <h3 className="text-sm sm:text-base font-bold text-white mb-2">
                  {t("第二层：数据契约与双语概念词典本体", "第二层：数据契约与双语概念词典本体")}
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed mb-3 flex-1">
                  {t(
                    "Enforces 50+ Pydantic strongly-typed data contracts across APIs and embeds a Bilingual Financial Ontology Lexicon directly into the UI, providing instant definitions and mathematical formulas on click/hover.",
                    "通过 50+ 个 Pydantic 强类型数据契约约束全链路 JSON 结构，并在前端内嵌双语金融本体词典（点击任意带“?”指标即可弹出高对比度公式与定义卡片）。"
                  )}
                </p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <TermTooltip term="P/E Ratio" className="text-[11px] px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-200" />
                  <TermTooltip term="FCF Yield" className="text-[11px] px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-200" />
                  <TermTooltip term="PEG Ratio" className="text-[11px] px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-200" />
                  <TermTooltip term="ROE" className="text-[11px] px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-200" />
                </div>
              </div>

              {/* Layer 3 */}
              <div className="p-4 rounded-xl bg-slate-950/90 border border-purple-500/30 flex flex-col">
                <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-purple-400 mb-1">
                  Layer 3 · Kinetic & Decision Operators
                </div>
                <h3 className="text-sm sm:text-base font-bold text-white mb-2">
                  {t("第三层：动力与决策算子本体 (Kinetic Layer)", "第三层：动力与决策算子本体 (Kinetic Layer)")}
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed mb-3 flex-1">
                  {t(
                    "Executes deterministic quant operators over the ontology: 27-Sector RRG Rotation Operator, Walk-Forward Out-of-Sample Backtest Operator, and Sunday Autonomous Threshold Self-Healing.",
                    "在静态图谱与契约之上运行三大动力算子：27 板块 RRG 轮动象限算子、Walk-Forward 无前视偏差回测算子，以及周日 AI 策略阈值闭环自愈算子。"
                  )}
                </p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <TermTooltip term="RRG" className="text-[11px] px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-200" />
                  <TermTooltip term="Walk-Forward" className="text-[11px] px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-200" />
                  <TermTooltip term="T+5" className="text-[11px] px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-200" />
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: 5-Tier DB Synergy + Aliyun Vault */}
          <div className="p-4 sm:p-6 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur-md">
            <h2 className="text-lg sm:text-xl font-bold text-indigo-400 mb-2 flex items-center gap-2">
              <Database className="w-5 h-5 text-indigo-400 shrink-0" />
              2. {t("5-Tier Heterogeneous Storage & 1,500+ Aliyun Research Vault", "五层异构存储体系与 1,500+ 阿里云机构研报金库")}
            </h2>
            <p className="text-xs text-slate-400 mb-5">
              {t(
                "Combining NoSQL document stores, Neo4j graph RAG, Aliyun institutional research archives, object storage, and in-memory circuit breakers.",
                "采用 NoSQL 实时文档库 + Neo4j 图数据库 + 阿里云 1,500+ 深度研报与 82 年宏观历史库 + 对象存储 + 内存熔断缓存的五层异构架构。"
              )}
            </p>

            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-slate-900 text-cyan-400 font-bold border-b border-slate-800">
                  <tr>
                    <th className="p-3 whitespace-nowrap">{t("Tier & Component", "存储层级与组件")}</th>
                    <th className="p-3 whitespace-nowrap">{t("Engine Type", "引擎类型")}</th>
                    <th className="p-3">{t("Ontological Role & Persisted Assets", "本体职责与核心数据资产")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-300">
                  <tr>
                    <td className="p-3 font-semibold text-white whitespace-nowrap">1. Google Cloud Firestore</td>
                    <td className="p-3 text-slate-400 whitespace-nowrap">NoSQL Document DB</td>
                    <td className="p-3">
                      用户权限 (`users/`)、每日盘前简报 (`reports/`)、每周胜率审计 (`weekly_cache/`)、宏观分析 (`macro_cache/`)、选股调仓快照 (`gems_rebalance_snapshots/`) 与动态策略配置 (`system_config/screener_config`)。
                    </td>
                  </tr>
                  <tr>
                    <td className="p-3 font-semibold text-white whitespace-nowrap">2. Neo4j (AuraDB)</td>
                    <td className="p-3 text-slate-400 whitespace-nowrap">Graph DB (Graph RAG)</td>
                    <td className="p-3">
                      产业链上下游拓扑 (`SUPPLIES_TO`)、同赛道竞品 (`COMPETES_WITH`)、战略生态联盟 (`PARTNER_WITH`)、研报看多看空质性节点与 AI 错题本 (`AIReflection`)。
                    </td>
                  </tr>
                  <tr className="bg-cyan-950/15">
                    <td className="p-3 font-semibold text-cyan-300 whitespace-nowrap">3. Aliyun Research Vault</td>
                    <td className="p-3 text-cyan-400/80 whitespace-nowrap">Cloud Archive + SQLite</td>
                    <td className="p-3">
                      沉淀 <strong>1,500+ 篇华尔街与顶级机构深度研报</strong> 结构化切片，以及 <strong>1944–2026 (82年) 宏观经济与市场危机全量历史序列</strong>，支撑跨周期相似行情匹配。
                    </td>
                  </tr>
                  <tr>
                    <td className="p-3 font-semibold text-white whitespace-nowrap">4. Firebase Cloud Storage</td>
                    <td className="p-3 text-slate-400 whitespace-nowrap">Object Storage</td>
                    <td className="p-3">
                      微信公众号日报预览 HTML、动态渲染的 PNG K线图表、板块轮动热力图与 A4 机构研报分享长图。
                    </td>
                  </tr>
                  <tr>
                    <td className="p-3 font-semibold text-white whitespace-nowrap">5. In-Memory L1/L2 Cache</td>
                    <td className="p-3 text-slate-400 whitespace-nowrap">Memory + Circuit Breaker</td>
                    <td className="p-3">
                      FMP / FRED / Finnhub 高频行情与技术指标毫秒级缓存，具备智能限流与多源自动降级熔断保护。
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 3: 6 Core Quantitative Dimensions & 27-Sector RRG */}
          <div className="p-4 sm:p-6 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur-md">
            <h2 className="text-lg sm:text-xl font-bold text-emerald-400 mb-2 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
              3. {t("6 Core Quantitative Dimensions & 27-Sector RRG Engine", "六大维度量化选股防火墙与 27 板块 RRG 轮动引擎")}
            </h2>
            <p className="text-xs text-slate-400 mb-5">
              {t(
                "Constructing a 6-layer screening firewall across macro liquidity, fundamentals, technical momentum, 27-sector RRG tailwinds, earnings surprises, and portfolio risk.",
                "基于宏观周期、定量基本面、技术动量、27 板块 RRG 顺逆风象限、财报预期差及组合风险平价构筑 6 重筛选防火墙。"
              )}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800">
                <div className="text-sm font-bold text-amber-400 mb-1.5">① 宏观经济与 82 年历史周期对标</div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  FRED API 实时监控 FFR 利率、CPI/PCE 通胀、NFP 非农及美债 10Y-2Y 利差，并与 1944–2026 历史周期做余弦相似度匹配，自动切换进攻/防御姿态。
                </p>
              </div>
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800">
                <div className="text-sm font-bold text-blue-400 mb-1.5">② 定量基本面评分 (Fundamental Score)</div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  基于盈利能力 (30%) + 成长性 (40%) + 现金流安全边际 (30%) 计算 0-100 评分，核心检验{" "}
                  <TermTooltip term="ROE" showIcon={false} className="text-cyan-300">ROE</TermTooltip>、{" "}
                  <TermTooltip term="PEG Ratio" showIcon={false} className="text-cyan-300">PEG</TermTooltip>、{" "}
                  <TermTooltip term="FCF Yield" showIcon={false} className="text-cyan-300">FCF Yield</TermTooltip> 与{" "}
                  <TermTooltip term="D/E Ratio" showIcon={false} className="text-cyan-300">D/E Ratio</TermTooltip>。
                </p>
              </div>
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800">
                <div className="text-sm font-bold text-purple-400 mb-1.5">③ 技术面与趋势动量 (Technical Score)</div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  结合 <TermTooltip term="50SMA" showIcon={false} className="text-cyan-300">50SMA</TermTooltip> /{" "}
                  <TermTooltip term="200SMA" showIcon={false} className="text-cyan-300">200SMA</TermTooltip>{" "}
                  黄金交叉、52周高点偏离度、RSI(14) 与成交量异动，过滤左侧下跌飞刀。
                </p>
              </div>
              <div className="p-4 rounded-xl bg-slate-950/80 border border-cyan-500/30">
                <div className="text-sm font-bold text-cyan-400 mb-1.5">④ 27 板块 RRG 相对轮动顺逆风校准</div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  全天候追踪 11 大 GICS 一级行业 + 16 大核心主题 ETF（AI、半导体、核电、网络安全等）的{" "}
                  <TermTooltip term="RS-Ratio" showIcon={false} className="text-cyan-300">RS-Ratio</TermTooltip> 与{" "}
                  <TermTooltip term="RS-Momentum" showIcon={false} className="text-cyan-300">RS-Momentum</TermTooltip>，领涨/改善象限赋予顺风加权。
                </p>
              </div>
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800">
                <div className="text-sm font-bold text-indigo-400 mb-1.5">⑤ 财报预期差与 DCF 估值锚点</div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  监控财报 EPS Surprise % 与华尔街目标价上修幅度，并结合{" "}
                  <TermTooltip term="DCF" showIcon={false} className="text-cyan-300">DCF</TermTooltip>{" "}
                  内在价值与 <TermTooltip term="TAM" showIcon={false} className="text-cyan-300">TAM</TermTooltip> 终局空间双重校验。
                </p>
              </div>
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800">
                <div className="text-sm font-bold text-emerald-400 mb-1.5">⑥ 组合风险控制与战术再平衡</div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  基于个股 <TermTooltip term="Beta" showIcon={false} className="text-cyan-300">Beta</TermTooltip>、波动率及行业集中度，动态生成买入/增持/减持调仓指令。
                </p>
              </div>
            </div>
          </div>

          {/* Section 4: Walk-Forward Backtest & Closed-Loop Self-Healing */}
          <div className="p-4 sm:p-6 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur-md">
            <h2 className="text-lg sm:text-xl font-bold text-purple-400 mb-2 flex items-center gap-2">
              <Zap className="w-5 h-5 text-purple-400 shrink-0" />
              4. {t("Walk-Forward Backtest Lab & T+5 Autonomous Self-Healing", "Walk-Forward 无前视偏差回测与 T+5 闭环自愈引擎")}
            </h2>
            <p className="text-xs text-slate-400 mb-4">
              {t(
                "Rigorous out-of-sample validation paired with Lo (2002) autocorrelation-adjusted Sharpe ratio and automated Sunday parameter optimization.",
                "杜绝未来函数的滚动前推回测验证，结合 Lo (2002) 自相关修正夏普比率与周日全自动参数自愈。"
              )}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div className="p-4 rounded-xl bg-slate-950/90 border border-purple-500/30 text-xs space-y-2">
                <div className="font-bold text-purple-300 flex items-center gap-1.5">
                  <Activity className="w-4 h-4" />
                  {t("T+5 / T+20 Real-Trading Audit Formulas", "T+5 / T+20 实盘胜率与期望收益公式")}
                </div>
                <div className="font-mono text-slate-200 space-y-1.5 pt-1">
                  <div>&bull; 胜率 (Win Rate) = (跑赢 SPY 标的数 / 总锁定标的数) &times; 100%</div>
                  <div>&bull; 超额 Alpha = Return(Stock, T+5) - Return(SPY, T+5)</div>
                  <div>&bull; 期望收益 E[R] = (Win% &times; AvgWin) - (Loss% &times; |AvgLoss|)</div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-950/90 border border-emerald-500/30 text-xs space-y-2">
                <div className="font-bold text-emerald-300 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  {t("Walk-Forward & Lo (2002) Statistical Rigor", "Walk-Forward 与 Lo (2002) 统计显著性校验")}
                </div>
                <div className="text-slate-300 leading-relaxed pt-1">
                  采用严格历史时点切片（Out-of-Sample Walk-Forward），扣除双边滑点与冲击成本，并应用 Andrew Lo (2002) 序列自相关修正公式计算年化 Sharpe Ratio 与 t-stat 显著性，拒绝过拟合伪 Alpha。
                </div>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-300 leading-relaxed">
              <span className="font-bold text-purple-300">7 大全自动 SRE 闭环自愈守护进程：</span>{" "}
              每周日 02:00 EST 自动触发策略审计：当某策略 T+5 胜率回落至 50% 以下（WARNING 状态）时，AI 反思引擎自动提取亏损案例共性写入 Neo4j{" "}
              <code className="text-cyan-300">:AIReflection</code> 节点，并动态调紧 Firestore 中的定量筛选阈值（例如将 ROE 下限由 15% 提升至 20%，或收紧最大 D/E 负债率），实现真正的自动驾驶级模型进化。
            </div>
          </div>
        </div>
      </PremiumGate>
    </main>
  );
}
