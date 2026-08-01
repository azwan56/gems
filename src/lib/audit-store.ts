// ============================================================
// AI Strategy Audit & Autonomous Self-Healing Store
// Provides win-rate metrics, self-healing audit logs, and performance retrospectives.
// ============================================================

export interface StrategyWinRate {
  id: string;
  name: string;
  nameZh: string;
  t5WinRate: number;       // 0 - 100
  t20WinRate: number;      // 0 - 100
  avgReturn: number;       // e.g. 5.4 for +5.4%
  status: "OPTIMAL" | "WARNING" | "CRITICAL";
  totalRecommendations: number;
  iconName: string;
}

export interface SelfHealingLog {
  id: string;
  date: string;
  strategyId: string;
  strategyNameZh: string;
  triggerEvent: string;
  triggerEventZh: string;
  actionTaken: string;
  actionTakenZh: string;
  impactScore: string;
  impactScoreZh: string;
}

export interface PerformanceShowcaseStock {
  symbol: string;
  companyName: string;
  strategyId: string;
  entryDate: string;
  entryPrice: number;
  currentPrice: number;
  returnPct: number;
  status: "WINNER" | "LOSER";
  keyRationaleZh: string;
  keyRationaleEn: string;
}

export function getStrategyWinRates(): StrategyWinRate[] {
  return [
    {
      id: "garp",
      name: "GARP Growth",
      nameZh: "合理价格成长 (GARP)",
      t5WinRate: 68.5,
      t20WinRate: 75.0,
      avgReturn: 6.4,
      status: "OPTIMAL",
      totalRecommendations: 16,
      iconName: "TrendingUp"
    },
    {
      id: "large_growth",
      name: "Large-Cap Growth",
      nameZh: "大型成长股",
      t5WinRate: 62.5,
      t20WinRate: 70.0,
      avgReturn: 4.8,
      status: "OPTIMAL",
      totalRecommendations: 12,
      iconName: "TrendingUp"
    },
    {
      id: "value",
      name: "Value Investing",
      nameZh: "价值投资",
      t5WinRate: 60.0,
      t20WinRate: 66.7,
      avgReturn: 3.2,
      status: "OPTIMAL",
      totalRecommendations: 15,
      iconName: "ShieldCheck"
    },
    {
      id: "small_growth",
      name: "Small/Mid Growth",
      nameZh: "中小盘成长股",
      t5WinRate: 48.0,
      t20WinRate: 52.0,
      avgReturn: 1.5,
      status: "WARNING",
      totalRecommendations: 20,
      iconName: "Rocket"
    }
  ];
}

export function getSelfHealingLogs(): SelfHealingLog[] {
  return [
    {
      id: "sh-1",
      date: "2026-07-28",
      strategyId: "small_growth",
      strategyNameZh: "中小盘成长策略",
      triggerEvent: "Market volatility surge; 5-day win rate dipped below 50%",
      triggerEventZh: "检测到市场波动加剧，中小盘 5 日胜率回落至 48% (触及 WARNING)",
      actionTaken: "Raised minimum ROE threshold from 15% to 20%; tightened Debt/Equity limit to < 0.8",
      actionTakenZh: "系统自动调紧安全阀门：将最低 ROE 门槛从 15% 提升至 20%，资产负债比限制在 0.8 以下",
      impactScore: "3-day subsequent signals win-rate restored to 62.5%",
      impactScoreZh: "干预后近 3 天新选标的胜率自动修复至 62.5%"
    },
    {
      id: "sh-2",
      date: "2026-07-20",
      strategyId: "garp",
      strategyNameZh: "GARP 成长策略",
      triggerEvent: "High valuation expansion in tech sector",
      triggerEventZh: "科技板块估值整体抬升，传统 PEG 筛选结果过少",
      actionTaken: "Dynamically adjusted upper PEG limit from 0.65 to 0.75 for non-bubble large caps",
      actionTakenZh: "AI 自适应调整：将兼具强现金流大盘股的 PEG 上限微调至 0.75",
      impactScore: "Successfully captured NVDA & TSM post-earnings rally",
      impactScoreZh: "成功捕捉台积电 (TSM) 财报超预期行情 (+8.5%)"
    },
    {
      id: "sh-3",
      date: "2026-07-12",
      strategyId: "value",
      strategyNameZh: "价值投资策略",
      triggerEvent: "Macro 10Y-2Y yield curve inversion narrowing",
      triggerEventZh: "美债收益率曲线倒挂收窄，防守板块资金轮动",
      actionTaken: "Increased FCF Yield weight in score engine from 15% to 20%",
      actionTakenZh: "提升评分引擎中自由现金流收益率 (FCF Yield) 的权重比例至 20%",
      impactScore: "Defensive portfolio drawdown reduced by 1.8%",
      impactScoreZh: "防守组合在回调周期的最大回撤降低 1.8%"
    }
  ];
}

export function getPerformanceShowcase(): PerformanceShowcaseStock[] {
  return [
    {
      symbol: "NVDA",
      companyName: "NVIDIA Corporation",
      strategyId: "large_growth",
      entryDate: "2026-07-15",
      entryPrice: 122.50,
      currentPrice: 139.80,
      returnPct: 14.12,
      status: "WINNER",
      keyRationaleZh: "黑盒推理匹配：毛利率 75% + 50SMA 支撑 + 财报预估超预期 15%",
      keyRationaleEn: "Gross margin 75% + 50SMA support + Earnings surprise >15%"
    },
    {
      symbol: "TSM",
      companyName: "Taiwan Semiconductor",
      strategyId: "garp",
      entryDate: "2026-07-18",
      entryPrice: 172.00,
      currentPrice: 188.50,
      returnPct: 9.59,
      status: "WINNER",
      keyRationaleZh: "Neo4j 图谱验证：先进制程独家产能垄断，PEG 仅 0.62",
      keyRationaleEn: "Neo4j Graph Verified: Monopolistic foundry capacity, PEG 0.62"
    },
    {
      symbol: "AAPL",
      companyName: "Apple Inc.",
      strategyId: "value",
      entryDate: "2026-07-10",
      entryPrice: 224.00,
      currentPrice: 241.50,
      returnPct: 7.81,
      status: "WINNER",
      keyRationaleZh: "自由现金流收益率达标 + 苹果 AI 换机周期催化",
      keyRationaleEn: "FCF Yield qualified + Apple Intelligence upgrade cycle catalyst"
    },
    {
      symbol: "MSFT",
      companyName: "Microsoft Corporation",
      strategyId: "large_growth",
      entryDate: "2026-07-12",
      entryPrice: 440.00,
      currentPrice: 468.20,
      returnPct: 6.41,
      status: "WINNER",
      keyRationaleZh: "Azure 云计算增长超预期 + OpenAI 独家生态图谱加持",
      keyRationaleEn: "Azure growth beat expectations + OpenAI ecosystem integration"
    },
    {
      symbol: "SMCI",
      companyName: "Super Micro Computer",
      strategyId: "small_growth",
      entryDate: "2026-07-22",
      entryPrice: 51.20,
      currentPrice: 48.10,
      returnPct: -6.05,
      status: "LOSER",
      keyRationaleZh: "受行业供应链审计噪音拉低；系统随后触发自愈逻辑止损出局",
      keyRationaleEn: "Impacted by supply chain audit news; auto self-healing triggered stop-loss"
    },
    {
      symbol: "ARM",
      companyName: "Arm Holdings plc",
      strategyId: "small_growth",
      entryDate: "2026-07-24",
      entryPrice: 152.00,
      currentPrice: 145.50,
      returnPct: -4.28,
      status: "LOSER",
      keyRationaleZh: "短期估值扩张过快引发高位获利盘回吐，已触发过热预警",
      keyRationaleEn: "Short-term valuation overstretch triggered profit taking alert"
    }
  ];
}

