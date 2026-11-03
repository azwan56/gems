"use client";

import { useState, useMemo } from "react";
import {
  ShieldCheck,
  TrendingUp,
  Activity,
  Gem,
  Rocket,
  Languages,
  BookOpen,
  Castle,
  Zap,
  ChevronRight,
  Cpu,
  Sparkles,
  Network,
  Layers,
  Presentation,
  Briefcase,
  Clock,
  Flame,
  Search,
  Star,
  ArrowUpRight,
  X,
  FileText,
  SlidersHorizontal,
  Table as TableIcon,
  LayoutGrid,
  TrendingDown,
  Building,
  Radio,
  ExternalLink
} from "lucide-react";
import Link from "next/link";
import { useLanguage } from "@/lib/language-context";
import { useAuth } from "@/lib/auth-context";
import UserMenu from "@/components/UserMenu";
import { TermTooltip } from "@/components/TermTooltip";

// 7 Strategies Configuration
const strategies = [
  {
    id: "value",
    name: "Value Investing",
    nameZh: "价值投资",
    description: "Find fundamentally strong companies trading below intrinsic value. Focus on high free cash flow and margin of safety.",
    descriptionZh: "寻找基本面健康但被市场低估的公司。强调安全边际与自由现金流。",
    icon: ShieldCheck,
    color: "blue",
    metrics: [
      { label: "P/E Ratio", term: "P/E Ratio", value: "< 15.0" },
      { label: "P/B Ratio", term: "P/B Ratio", value: "< 1.5" },
      { label: "FCF Yield", term: "FCF Yield", value: "> 5.0%" },
    ],
  },
  {
    id: "large_growth",
    name: "Large-Cap Growth",
    nameZh: "大型成长股",
    description: "Nasdaq-100 titans driven by global expansion. Features robust cash flow and high resilience.",
    descriptionZh: "Nasdaq-100级别的科技巨头。行业垄断力强，自由现金流充沛，抗风险能力极高。",
    icon: TrendingUp,
    color: "indigo",
    metrics: [
      { label: "Market Cap", value: "> $100B" },
      { label: "Rev Growth", value: "> 15%" },
      { label: "FCF Yield", term: "FCF Yield", value: "> 3%" },
    ],
  },
  {
    id: "small_growth",
    name: "Small/Mid-Cap Growth",
    nameZh: "中小盘成长股",
    description: "Russell 2000 innovators driven by disruptive tech. Explosive revenue growth, often pre-profit.",
    descriptionZh: "依赖技术突破的细分赛道龙头。爆发力极强，通常处于亏损或盈亏平衡阶段。",
    icon: Rocket,
    color: "purple",
    metrics: [
      { label: "Market Cap", value: "< $10B" },
      { label: "Rev Growth", value: "> 30%" },
      { label: "Momentum (50SMA)", term: "50SMA", value: "vs 50SMA > 0" },
    ],
  },
  {
    id: "seeking_alpha",
    name: "Seeking Alpha Picks",
    nameZh: "Seeking Alpha 精选",
    description: "Your curated watchlist from Seeking Alpha. Bypasses quantitative screening — view all metrics at a glance and jump directly to deep analysis.",
    descriptionZh: "Seeking Alpha 自选股清单。跳过定量筛选，直接展示所有指标数据，一键进入深度分析。",
    icon: BookOpen,
    color: "amber",
    metrics: [
      { label: "Source", value: "Seeking Alpha" },
      { label: "Screening", value: "Bypassed" },
      { label: "Direct to", value: "Step 2" },
    ],
  },
  {
    id: "garp",
    name: "GARP",
    nameZh: "合理价格成长",
    description: "Combines growth and value investing. Looks for companies with strong EPS growth but undervalued PEG ratios.",
    descriptionZh: "结合成长与价值投资。寻找具有强劲EPS增长但PEG估值偏低的公司。",
    icon: TrendingUp,
    color: "emerald",
    metrics: [
      { label: "EPS Growth", value: "> 20%" },
      { label: "PEG Ratio", term: "PEG Ratio", value: "< 1.0" },
      { label: "Market Cap", value: "> $500M" },
    ],
  },
  {
    id: "wide_moat",
    name: "Wide Moat",
    nameZh: "深宽护城河",
    description: "Companies with enduring competitive advantages. Features high return on equity and superior gross margins.",
    descriptionZh: "具有持久竞争优势的公司。拥有极高的净资产收益率(ROE)和优异的毛利率。",
    icon: Castle,
    color: "slate",
    metrics: [
      { label: "ROE", term: "ROE", value: "> 15%" },
      { label: "Gross Margin", term: "Gross Margin", value: "> 40%" },
      { label: "D/E Ratio", term: "D/E Ratio", value: "< 1.0" },
    ],
  },
  {
    id: "short_term_catalyst",
    name: "Short-Term Catalyst",
    nameZh: "短线催化剂",
    description: "Momentum play focusing on technical breakouts and short-term trends.",
    descriptionZh: "侧重于技术面突破和短期趋势的动量策略。",
    icon: Zap,
    color: "rose",
    metrics: [
      { label: "Price vs 50SMA", term: "50SMA", value: "> 0%" },
      { label: "Price vs 200SMA", term: "200SMA", value: "> 0%" },
      { label: "Rev Growth", value: "> 5%" },
    ],
  },
];

// Rich High-Signal Stocks Pool
interface StockItem {
  ticker: string;
  name: string;
  sector: string;
  sectorZh: string;
  strategy: string;
  score: number;
  price: number;
  wallStTarget: number;
  aiTarget: number;
  upside: string;
  catalyst: string;
  catalystZh: string;
  pe: number;
  moatScore: number;
  growthScore: number;
  momentumScore: number;
  valuationScore: number;
  isWatchlist?: boolean;
  thesisZh: string[];
  thesisEn: string[];
}

const STOCK_POOL: StockItem[] = [
  {
    ticker: "NVDA",
    name: "NVIDIA Corp.",
    sector: "Semiconductors / AI Infrastructure",
    sectorZh: "半导体 / AI 基础设施",
    strategy: "large_growth",
    score: 96,
    price: 138.25,
    wallStTarget: 155.0,
    aiTarget: 168.0,
    upside: "+21.5%",
    catalyst: "Blackwell chip mass shipments beginning, CSP capex up-revision.",
    catalystZh: "Blackwell 芯片量产出货，全球云厂商资本开支超预期上修。",
    pe: 48.2,
    moatScore: 98,
    growthScore: 95,
    momentumScore: 92,
    valuationScore: 84,
    thesisZh: [
      "垄断级生态壁垒：CUDA 软件栈形成极高转换成本，全球大型云厂商资本开支加速增长。",
      "现金流再投资效率：ROE 超过 115%，自由现金流利润率维持在 45% 以上。",
      "估值安全边际：尽管名义 PE 较高，但以 PEG 计算仅约 1.1，匹配其 50%+ 的盈利增长预期。"
    ],
    thesisEn: [
      "Monopoly Ecosystem Moat: CUDA software stack creates insurmountable switching costs with hyperscaler capex rising.",
      "Reinvestment Efficiency: ROE exceeds 115% with FCF margin sustaining above 45%.",
      "Valuation Safety Margin: Forward PEG is only ~1.1 against 50%+ EPS CAGR."
    ]
  },
  {
    ticker: "PLTR",
    name: "Palantir Tech",
    sector: "Enterprise AI / Software",
    sectorZh: "企业级 AI / 商业软件",
    strategy: "large_growth",
    score: 93,
    price: 43.1,
    wallStTarget: 45.0,
    aiTarget: 52.0,
    upside: "+20.6%",
    catalyst: "AIP bootcamp customer conversion surging, S&P 500 inclusion fund flows.",
    catalystZh: "AIP 训练营客户转化率爆发，标普500纳入被动资金增配。",
    pe: 82.0,
    moatScore: 94,
    growthScore: 92,
    momentumScore: 96,
    valuationScore: 78,
    thesisZh: [
      "商业版图爆发：美国本土企业客户数同比增长超 80%，摆脱单纯依赖政府订单标签。",
      "Rule of 40 顶峰指标：收入增速 + FCF Margin 达到 64%，领跑 SaaS 板块。"
    ],
    thesisEn: [
      "Commercial Expansion: US commercial customer count surged 80%+ YoY.",
      "Rule of 40 Titan: Combined revenue growth and FCF margin hits 64%."
    ]
  },
  {
    ticker: "CRWD",
    name: "CrowdStrike",
    sector: "Cybersecurity / Cloud Sec",
    sectorZh: "网络安全 / 云终端防御",
    strategy: "small_growth",
    score: 91,
    price: 315.4,
    wallStTarget: 355.0,
    aiTarget: 380.0,
    upside: "+20.5%",
    catalyst: "Core enterprise gross retention at 98%+, module adoption expands.",
    catalystZh: "核心大客户留存率维持 98%+，多模块采用率创新高。",
    pe: 65.4,
    moatScore: 91,
    growthScore: 89,
    momentumScore: 88,
    valuationScore: 80,
    thesisZh: [
      "事件后韧性验证：客户转换成本极高，未发生市场担忧的退订现象。",
      "Falcon 平台整合效应：单客户平均采用 6 个以上模块，ARR 跨越 40 亿美元大关。"
    ],
    thesisEn: [
      "Post-Incident Resilience: Net retention proved sticky above 98%.",
      "Falcon Platform Flywheel: Module adoption accelerating ARR toward $4B+."
    ]
  },
  {
    ticker: "TSM",
    name: "Taiwan Semi",
    sector: "Foundry / Semiconductors",
    sectorZh: "晶圆代工巨头",
    strategy: "large_growth",
    score: 95,
    price: 192.5,
    wallStTarget: 225.0,
    aiTarget: 240.0,
    upside: "+24.7%",
    catalyst: "3nm/2nm capacity fully booked, CoWoS advanced packaging capacity doubles.",
    catalystZh: "3nm/2nm 尖端制程产能供不应求，CoWoS 先进封装扩张提速。",
    pe: 25.6,
    moatScore: 99,
    growthScore: 94,
    momentumScore: 91,
    valuationScore: 88,
    thesisZh: [
      "现代科技唯一水龙头：占据全球尖端 AI 芯片代工 90%+ 份额，掌握绝对定价权。"
    ],
    thesisEn: [
      "Global Technology Bottleneck: 90%+ share in cutting-edge AI chip manufacturing."
    ]
  },
  {
    ticker: "GOOGL",
    name: "Alphabet Inc.",
    sector: "Big Tech / AI Search",
    sectorZh: "互联网巨头 / AI 搜索",
    strategy: "wide_moat",
    score: 94,
    price: 168.5,
    wallStTarget: 200.0,
    aiTarget: 212.0,
    upside: "+25.8%",
    catalyst: "Gemini integration across Workspace & Search, Cloud margin double.",
    catalystZh: "Gemini 深度整合至搜索与云平台，GCP 营业利润率翻倍。",
    pe: 23.4,
    moatScore: 96,
    growthScore: 88,
    momentumScore: 84,
    valuationScore: 92,
    thesisZh: [
      "估值性价比极高：前向市盈率不到 21 倍，属于大型科技巨头中最具安全边际标的。",
      "云业务杠杆释放：Google Cloud 营业利润率从 3% 飙升至 11% 以上，成为第二增长曲线。"
    ],
    thesisEn: [
      "Valuation Margin of Safety: Trading at ~21x forward P/E, most attractive among Big Tech.",
      "Cloud Margin Expansion: Operating margin scaled from 3% to 11%+."
    ]
  },
  {
    ticker: "MSFT",
    name: "Microsoft Corp.",
    sector: "Cloud Infrastructure / Software",
    sectorZh: "云基础设施 / 办公软件",
    strategy: "wide_moat",
    score: 92,
    price: 412.3,
    wallStTarget: 480.0,
    aiTarget: 495.0,
    upside: "+20.1%",
    catalyst: "Azure AI growth contribution climbs, Copilot seat penetration expands.",
    catalystZh: "Azure AI 收入贡献比例攀升，Copilot 席位渗透率加速。",
    pe: 32.1,
    moatScore: 97,
    growthScore: 86,
    momentumScore: 82,
    valuationScore: 85,
    thesisZh: [
      "无可动摇的企业 IT 预算垄断：Office 365 + Azure 构成现代企业数字基石。"
    ],
    thesisEn: [
      "Enterprise Monopoly: Office 365 and Azure remain mission-critical infrastructure."
    ]
  },
  {
    ticker: "BRK.B",
    name: "Berkshire Hathaway",
    sector: "Conglomerate / Value",
    sectorZh: "多元金融 / 价值投资",
    strategy: "value",
    score: 89,
    price: 448.2,
    wallStTarget: 485.0,
    aiTarget: 510.0,
    upside: "+13.8%",
    catalyst: "$300B+ record cash reserve collecting high risk-free interest.",
    catalystZh: "手握 $3000亿+ 现金头寸，高利率环境下利息收益创纪录。",
    pe: 18.2,
    moatScore: 98,
    growthScore: 70,
    momentumScore: 80,
    valuationScore: 94,
    thesisZh: [
      "终极避险资产：巨大的现金储备提供随时逢低抄底优质资产的绝对主动权。"
    ],
    thesisEn: [
      "Ultimate Defense: Over $300B in dry powder yielding guaranteed interest income."
    ]
  },
  {
    ticker: "JNJ",
    name: "Johnson & Johnson",
    sector: "Healthcare / Pharma",
    sectorZh: "医疗保健 / 创新药",
    strategy: "value",
    score: 87,
    price: 154.2,
    wallStTarget: 175.0,
    aiTarget: 185.0,
    upside: "+19.9%",
    catalyst: "Focus on high-margin innovative medicine, talc settlement clearing.",
    catalystZh: "专注高毛利创新制药，滑石粉和解利空出清。",
    pe: 15.6,
    moatScore: 93,
    growthScore: 68,
    momentumScore: 72,
    valuationScore: 95,
    thesisZh: [
      "股息贵族防守属性：连续 62 年提高股息，当前股息率达 3.2%。"
    ],
    thesisEn: [
      "Dividend Aristocrat: 62 consecutive years of dividend increases with 3.2% yield."
    ]
  },
];

export default function Home() {
  const { lang, setLang, t } = useLanguage();
  const { user } = useAuth();

  // Dual-Core Terminal State: 'dailystock' (Macro/Tactics) or 'gems' (Quant Alpha Screener)
  const [activeCore, setActiveCore] = useState<"dailystock" | "gems">("dailystock");
  const [activeStrategy, setActiveStrategy] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [sortKey, setSortKey] = useState<"score" | "upside" | "pe">("score");
  const [viewMode, setViewMode] = useState<"card" | "table">("card");
  const [selectedStock, setSelectedStock] = useState<StockItem | null>(null);
  const [watchlistOnly, setWatchlistOnly] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const filteredStocks = useMemo(() => {
    return STOCK_POOL.filter((s) => {
      const matchStrat = activeStrategy === "all" || s.strategy === activeStrategy;
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        s.ticker.toLowerCase().includes(q) ||
        s.name.toLowerCase().includes(q) ||
        s.sector.toLowerCase().includes(q) ||
        s.sectorZh.includes(q) ||
        s.catalystZh.includes(q);
      const matchWatchlist = !watchlistOnly || s.isWatchlist;
      return matchStrat && matchSearch && matchWatchlist;
    }).sort((a, b) => {
      if (sortKey === "score") return b.score - a.score;
      if (sortKey === "upside") return parseFloat(b.upside) - parseFloat(a.upside);
      if (sortKey === "pe") return a.pe - b.pe;
      return 0;
    });
  }, [activeStrategy, searchQuery, sortKey, watchlistOnly]);

  return (
    <main className="min-h-screen flex flex-col bg-[#080c14] text-slate-100 selection:bg-indigo-500 selection:text-white">
      
      {/* Ambient background glows */}
      <div className="fixed top-0 left-1/4 w-[500px] h-[500px] bg-indigo-600/10 blur-[140px] pointer-events-none rounded-full" />
      <div className="fixed bottom-10 right-1/4 w-[450px] h-[450px] bg-emerald-500/10 blur-[130px] pointer-events-none rounded-full" />

      {/* ===================================================================== */}
      {/* UNIFIED TOP NAVIGATION BAR */}
      {/* ===================================================================== */}
      <header className="sticky top-0 z-40 bg-slate-900/85 backdrop-blur-xl border-b border-slate-800/80 px-3 sm:px-6 py-2.5">
        <div className="max-w-[1440px] mx-auto flex items-center justify-between gap-3">
          
          {/* Brand & Dual-Core Switcher */}
          <div className="flex items-center gap-4 sm:gap-6 shrink-0">
            <Link href="/" className="flex items-center gap-2 group">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 via-cyan-500 to-emerald-400 p-0.5 shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition-transform">
                <div className="w-full h-full bg-[#080c14] rounded-[10px] flex items-center justify-center">
                  <Gem className="w-4 h-4 text-cyan-400" />
                </div>
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold text-base sm:text-lg tracking-tight text-white">VANPOWER</span>
                  <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    2.0
                  </span>
                </div>
                <span className="text-[10px] text-slate-400 font-medium hidden sm:inline">
                  {t("Unified Financial Terminal", "双核智能金融工作台")}
                </span>
              </div>
            </Link>

            {/* DUAL-CORE SEGMENT SWITCHER */}
            <div className="bg-slate-950/90 p-1 rounded-xl border border-slate-800 flex items-center shadow-inner">
              <button
                onClick={() => setActiveCore("dailystock")}
                className={`px-2.5 sm:px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  activeCore === "dailystock"
                    ? "bg-slate-800 text-white shadow-sm border border-slate-700"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <span>🌅 {t("DailyStock", "大盘节奏")}</span>
                <span className="text-[10px] font-mono text-slate-400 hidden lg:inline">
                  {t("Macro Pulse", "宏观中枢")}
                </span>
              </button>

              <button
                onClick={() => setActiveCore("gems")}
                className={`px-2.5 sm:px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  activeCore === "gems"
                    ? "bg-indigo-600 text-white shadow-sm border border-indigo-500"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <span>💎 {t("Gems 2.0", "量化选股")}</span>
                <span className="text-[10px] font-mono text-indigo-300 hidden lg:inline">
                  {t("Alpha Radar", "Alpha雷达")}
                </span>
              </button>
            </div>
          </div>

          {/* Quick Search & Macro Ribbon */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Live Macro Pill */}
            <div className="hidden xl:flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900/90 border border-slate-800 text-xs font-mono">
              <span className="text-slate-400">VIX: <strong className="text-emerald-400">14.85 (-3.2%)</strong></span>
              <span className="text-slate-700">|</span>
              <span className="text-slate-400">10Y: <strong className="text-cyan-400">4.18%</strong></span>
              <span className="text-slate-700">|</span>
              <span className="flex items-center gap-1 text-emerald-400 font-sans font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>Risk-On {t("Bullish", "多头占优")}</span>
              </span>
            </div>

            {/* Quick Search */}
            <div className="relative w-36 sm:w-56">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t("Search ticker...", "搜索代码或研报...")}
                className="w-full bg-slate-950/80 text-xs text-slate-200 placeholder-slate-500 pl-8 pr-3 py-1.5 rounded-lg border border-slate-800 focus:outline-none focus:border-indigo-500 transition-all"
              />
            </div>

            {/* Watchlist Filter */}
            <button
              onClick={() => {
                setWatchlistOnly(!watchlistOnly);
                if (activeCore !== "gems") setActiveCore("gems");
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                watchlistOnly
                  ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                  : "bg-slate-900 text-slate-300 border-slate-800 hover:text-white"
              }`}
            >
              <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
              <span className="hidden sm:inline">{t("Watchlist", "自选")}</span>
              <span className="text-[10px] font-mono px-1 rounded bg-amber-500/20 text-amber-300">
                {STOCK_POOL.filter((s) => s.isWatchlist).length}
              </span>
            </button>

            {/* Language Toggle */}
            <button
              onClick={() => setLang(lang === "en" ? "zh" : "en")}
              className="flex items-center gap-1 px-2 py-1.5 bg-slate-800/80 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold transition-all border border-slate-700 shrink-0"
            >
              <Languages className="w-3.5 h-3.5 text-indigo-400" />
              <span>{lang === "en" ? "中文" : "EN"}</span>
            </button>

            <UserMenu />
          </div>

        </div>
      </header>

      {/* ===================================================================== */}
      {/* MAIN CONTAINER */}
      {/* ===================================================================== */}
      <div className="flex-1 max-w-[1440px] w-full mx-auto px-3 sm:px-6 lg:px-8 py-6 space-y-8">
        
        {/* ===================================================================== */}
        {/* CORE 1: DAILYSTOCK VIEW (宏观节奏与大盘战术中枢 - 极简高能) */}
        {/* ===================================================================== */}
        {activeCore === "dailystock" && (
          <div className="space-y-8 animate-fade-in">
            
            {/* HERO: 今日大盘 3 分钟执行简报 (Daily Tactical Playbook) */}
            <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900/95 via-slate-900/80 to-slate-950 p-6 sm:p-7 border border-slate-800/80 shadow-2xl backdrop-blur-xl">
              <div className="absolute -top-12 -right-12 w-64 h-64 bg-indigo-500/10 blur-3xl rounded-full pointer-events-none" />

              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-slate-800/80">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span>{t("Stance: Bullish / Pullback Buy", "今日战术姿态: 积极做多 / 逢回调吸筹")}</span>
                    </span>
                    <span className="text-xs text-slate-500 font-mono">
                      {t("Premarket Update · 2026-11-03", "盘前更新 · 2026-11-03")}
                    </span>
                  </div>

                  <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                    {t("Daily Market Executive Brief", "美股大盘实时执行简报")}
                  </h1>
                  <p className="text-xs sm:text-sm text-slate-400 max-w-2xl leading-relaxed">
                    {t(
                      "Hyperscaler AI capex acceleration confirmed. Hedging pressures subsiding. Focus on breakout confirmations and high-conviction sector rotation.",
                      "科技巨头资本开支加速扩张，市场避险情绪回落。聚焦突破确认与强势板块轮动。"
                    )}
                  </p>
                </div>

                {/* Benchmark Levels Strip */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-slate-950/80 p-3.5 rounded-xl border border-slate-800 text-xs">
                  <div className="space-y-0.5">
                    <span className="text-slate-500 block font-medium">S&P 500 (SPX)</span>
                    <span className="font-mono font-bold text-white text-base">5,864.2</span>
                    <span className="text-[11px] text-emerald-400 block font-semibold">+0.68% · {t("Support", "支撑")} 5,820</span>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-slate-500 block font-medium">Nasdaq 100 (QQQ)</span>
                    <span className="font-mono font-bold text-white text-base">496.80</span>
                    <span className="text-[11px] text-emerald-400 block font-semibold">+1.15% · {t("ATH Watch", "历史新高突破")}</span>
                  </div>
                  <div className="space-y-0.5 col-span-2 sm:col-span-1">
                    <span className="text-slate-500 block font-medium">Russell 2000 (IWM)</span>
                    <span className="font-mono font-bold text-white text-base">221.40</span>
                    <span className="text-[11px] text-cyan-400 block font-semibold">+0.42% · {t("50SMA Reclaimed", "均线企稳")}</span>
                  </div>
                </div>
              </div>

              {/* 3-Bullet Strategic Playbook (告别长文，30秒读懂重点) */}
              <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800/80">
                  <div className="flex items-center gap-2 text-cyan-400 font-bold text-xs uppercase mb-2">
                    <span className="w-5 h-5 rounded-full bg-cyan-500/15 text-cyan-400 flex items-center justify-center text-xs">1</span>
                    <span>{t("AI Leadership Breadth", "主线领涨扩散")}</span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {t(
                      "AI hardware capex confirms spillover into optical interconnects, power management, and enterprise AI SaaS.",
                      "AI 硬件资本开支落地，资金正从单纯的芯片向数据中心光模块、电源管理与企业级 AI 软件 (SaaS) 全面扩散。"
                    )}
                  </p>
                </div>

                <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800/80">
                  <div className="flex items-center gap-2 text-indigo-400 font-bold text-xs uppercase mb-2">
                    <span className="w-5 h-5 rounded-full bg-indigo-500/15 text-indigo-300 flex items-center justify-center text-xs">2</span>
                    <span>{t("Benign Liquidity Backdrop", "流动性环境友好")}</span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {t(
                      "US 10-Year yield capped below 4.20%, Dollar Index (DXY) consolidates, safeguarding valuation multiples.",
                      "10年期美债收益率承压于 4.20% 关键关口下方，美元指数 (DXY) 窄幅盘整，系统性多头仓位保持安全防御阈值。"
                    )}
                  </p>
                </div>

                <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800/80">
                  <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs uppercase mb-2">
                    <span className="w-5 h-5 rounded-full bg-emerald-500/15 text-emerald-400 flex items-center justify-center text-xs">3</span>
                    <span>{t("Tactical Execution Plan", "具体买点剧本")}</span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {t(
                      "Execute Gap & Go setups. Target discounted leaders at the first intraday pullback to 5-day EMA.",
                      "重点执行 Gap & Go（跳空顺势）战术，对具备高现金流折价的领涨标的在盘中第 1 回踩均线处分批挂单。"
                    )}
                  </p>
                </div>
              </div>
            </section>

            {/* SECTION: 宏观重大催化剂雷达 (Interactive Catalyst Horizon) */}
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                    <span>{t("Future 7-Day Macro Catalyst Radar", "未来 7 天宏观大事件雷达")}</span>
                    <span className="text-xs font-normal text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded-full">
                      {t("High Volatility Horizon", "高等级催化剂前瞻")}
                    </span>
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {t("Pre-empt volatility spikes with scenario-tested action plans.", "提前推演可能引发波动率激增的宏观节点与应对方案。")}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="rounded-xl bg-slate-900/70 p-4 border border-slate-800">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs font-bold text-slate-400 font-mono">周一 · 10:00</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      {t("Passed (Bullish)", "已落地 (偏多)")}
                    </span>
                  </div>
                  <h4 className="font-bold text-white text-sm">{t("ISM Manufacturing PMI", "ISM 制造业 PMI 指数")}</h4>
                  <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                    {t("Actual 50.4 vs 49.8 est. Factory activity re-entered expansion, easing hard landing fears.", "公布值 50.4 (预期 49.8)，制造业企稳重回扩张区间，消除了经济衰退硬着陆担忧。")}
                  </p>
                </div>

                <div className="rounded-xl bg-rose-950/20 p-4 border border-rose-500/40">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs font-bold text-rose-400 font-mono">周三 · 14:00</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse">
                      {t("Peak Volatility ★★★", "最高波动率 ★★★")}
                    </span>
                  </div>
                  <h4 className="font-bold text-white text-sm">{t("FOMC Rate Decision & Powell", "美联储 FOMC 利率决议")}</h4>
                  <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
                    {t("Consensus 25bps cut. Watch forward guidance on Dec pause probabilities closely.", "市场一致预期降息 25bps。核心关注鲍威尔对 12 月是否暂停降息的前瞻指引态度。")}
                  </p>
                </div>

                <div className="rounded-xl bg-slate-900/70 p-4 border border-slate-800">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs font-bold text-slate-400 font-mono">周四 · 盘后</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                      {t("Mega-cap Earnings ★★", "财报重磅 ★★")}
                    </span>
                  </div>
                  <h4 className="font-bold text-white text-sm">{t("Big Tech Cloud Earnings", "三大云厂商财报周")}</h4>
                  <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                    {t("Cloud ARR growth and FY2027 AI CapEx targets will dictate semiconductor sentiment.", "关注云原生 ARR 增速与 2027 年 AI 资本支出指引（CapEx），将直接决定半导体方向。")}
                  </p>
                </div>

                <div className="rounded-xl bg-slate-900/70 p-4 border border-slate-800">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs font-bold text-slate-400 font-mono">周五 · 08:30</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      {t("Macro Indicator ★★", "宏观关键 ★★")}
                    </span>
                  </div>
                  <h4 className="font-bold text-white text-sm">{t("Non-Farm Payrolls (NFP)", "美国非农就业 (NFP)")}</h4>
                  <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                    {t("Expected +165k additions, 4.1% unemployment rate confirming Goldilocks regime.", "预期新增 16.5 万人，失业率 4.1%。若就业保持温和韧性，将确认美股金发女孩行情。")}
                  </p>
                </div>
              </div>
            </section>

            {/* SECTION: 盘前主力异动标的与战术剧本 (点击直通抽屉) */}
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                    <span>{t("Premarket Anomaly & Tactics", "今日盘前异动与战术剧本")}</span>
                    <span className="text-xs font-normal text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                      {t("Real-time Algo", "算法实时监控")}
                    </span>
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {t("Tap any stock to slide out the complete quantitative thesis drawer.", "点击任意标的直接滑出 AI 深度量化研报抽屉。")}
                  </p>
                </div>
                <button
                  onClick={() => setActiveCore("gems")}
                  className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                >
                  <span>{t("Explore all Gems strategies →", "进入 Gems 查看全部量化策略 →")}</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {STOCK_POOL.slice(0, 3).map((s) => (
                  <div
                    key={s.ticker}
                    onClick={() => setSelectedStock(s)}
                    className="rounded-xl bg-slate-900/80 hover:bg-slate-900 border border-slate-800 hover:border-indigo-500/50 p-4.5 cursor-pointer transition-all duration-200 group shadow-md"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-2.5">
                        <span className="w-10 h-10 rounded-lg bg-slate-800 border border-slate-700 font-mono font-bold text-white flex items-center justify-center">
                          {s.ticker}
                        </span>
                        <div>
                          <h4 className="font-bold text-white text-sm">{s.name}</h4>
                          <span className="text-[11px] text-emerald-400 font-semibold font-mono">
                            {lang === "en" ? s.sector : s.sectorZh}
                          </span>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                        {s.score} {t("pts", "分")}
                      </span>
                    </div>

                    <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">
                      {lang === "en" ? s.catalyst : s.catalystZh}
                    </p>

                    <div className="mt-3.5 pt-2.5 border-t border-slate-800 flex justify-between items-center text-[11px] text-slate-400">
                      <span>
                        AI公允价: <strong className="text-emerald-400 font-mono">${s.aiTarget.toFixed(2)}</strong> ({s.upside})
                      </span>
                      <span className="text-indigo-400 font-semibold group-hover:translate-x-0.5 transition-transform flex items-center gap-1">
                        {t("View Thesis →", "研报抽屉 →")}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* SECTION: 1500+ 机构投研研报金库入口 */}
            <section className="rounded-2xl p-5 border border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-4 bg-gradient-to-r from-slate-950 via-indigo-950/25 to-slate-950 shadow-xl">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-300 shrink-0">
                  <FileText className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">
                    {t("Vanpower Institutional Research Vault", "Vanpower 机构级研报私有金库 (Research Vault)")}
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {t(
                      "Over 1,500+ deep-dive equity reports with one-click WeChat HTML export and full-text keyword indexing.",
                      "已沉淀 1,500+ 篇覆盖全美股核心龙头的深度估值与战术拆解，支持一键微信排版与全文字检索。"
                    )}
                  </p>
                </div>
              </div>
              <a
                href="https://dailystock.vanpower.live"
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-all whitespace-nowrap shadow-lg shadow-indigo-500/20 flex items-center gap-1.5"
              >
                <span>{t("Browse Vault on DailyStock →", "直达 DailyStock 研报金库 →")}</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </section>

          </div>
        )}

        {/* ===================================================================== */}
        {/* CORE 2: GEMS VIEW (量化选股与 Alpha 标的雷达) */}
        {/* ===================================================================== */}
        {activeCore === "gems" && (
          <div className="space-y-8 animate-fade-in">
            
            {/* HERO: Top 3 High-Conviction Alpha Radar */}
            <section className="space-y-4">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-cyan-400 text-xs font-bold uppercase tracking-wider mb-1">
                    <Flame className="w-4 h-4 text-cyan-400" />
                    <span>{t("GEMS Alpha Radar · Highest Conviction", "GEMS Alpha Radar · 今日最高确信度")}</span>
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                    {t("Top 3 High-Conviction Core Picks", "今日最高确信度核心标的")}
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-400 mt-1">
                    {t(
                      "Filtered across 3,200+ tickers. Only stocks passing moat safety margin and momentum breakouts are presented.",
                      "算法定量过滤 3,200+ 标的，仅展示通过估值安全边际与动量突破认证的前置标的。"
                    )}
                  </p>
                </div>

                {/* Strategy Filter Badges */}
                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
                  <button
                    onClick={() => setActiveStrategy("all")}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                      activeStrategy === "all"
                        ? "bg-indigo-600 text-white shadow-sm border border-indigo-500"
                        : "bg-slate-900 text-slate-400 hover:text-white border border-slate-800"
                    }`}
                  >
                    {t("All Picks (8)", "全部标的 (8)")}
                  </button>
                  <button
                    onClick={() => setActiveStrategy("large_growth")}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                      activeStrategy === "large_growth"
                        ? "bg-indigo-600 text-white shadow-sm border border-indigo-500"
                        : "bg-slate-900 text-slate-400 hover:text-white border border-slate-800"
                    }`}
                  >
                    🚀 {t("Tech Titans", "大型成长")}
                  </button>
                  <button
                    onClick={() => setActiveStrategy("value")}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                      activeStrategy === "value"
                        ? "bg-indigo-600 text-white shadow-sm border border-indigo-500"
                        : "bg-slate-900 text-slate-400 hover:text-white border border-slate-800"
                    }`}
                  >
                    🛡️ {t("Deep Value", "深度价值")}
                  </button>
                  <button
                    onClick={() => setActiveStrategy("wide_moat")}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                      activeStrategy === "wide_moat"
                        ? "bg-indigo-600 text-white shadow-sm border border-indigo-500"
                        : "bg-slate-900 text-slate-400 hover:text-white border border-slate-800"
                    }`}
                  >
                    🏰 {t("Wide Moat", "宽护城河")}
                  </button>
                </div>
              </div>

              {/* 3 Featured Alpha Cards (Top 3) */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {STOCK_POOL.slice(0, 3).map((s) => (
                  <div
                    key={s.ticker}
                    onClick={() => setSelectedStock(s)}
                    className="rounded-2xl p-5 relative overflow-hidden group cursor-pointer bg-gradient-to-br from-slate-900/90 to-slate-950 border border-slate-800/90 hover:border-indigo-500/50 hover:-translate-y-1 transition-all duration-200 shadow-xl"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-base font-bold text-white font-mono shadow-inner">
                          {s.ticker}
                        </div>
                        <div>
                          <h3 className="font-bold text-white text-base leading-none">{s.name}</h3>
                          <span className="text-xs text-slate-400">{lang === "en" ? s.sector : s.sectorZh}</span>
                        </div>
                      </div>
                      <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        <span>AI {s.score}分</span>
                      </span>
                    </div>

                    <div className="mt-4 pt-4 border-t border-slate-800/80">
                      <div className="flex justify-between items-baseline mb-2">
                        <div>
                          <span className="text-xs text-slate-400 block">{t("Current Price", "当前市价")}</span>
                          <div className="text-xl font-extrabold text-white font-mono">${s.price.toFixed(2)}</div>
                        </div>
                        <div className="text-right">
                          <span className="text-xs text-slate-400 block">{t("AI Fair Value", "AI 公允估值")}</span>
                          <div className="text-xl font-extrabold text-emerald-400 font-mono flex items-center justify-end">
                            ${s.aiTarget.toFixed(2)}
                            <span className="ml-1.5 text-xs font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                              {s.upside}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Visual Progress Target Bar */}
                      <div className="w-full bg-slate-800/80 rounded-full h-2 relative my-2 overflow-hidden">
                        <div className="bg-slate-600 h-full rounded-full" style={{ width: "65%" }} />
                        <div
                          className="absolute inset-y-0 bg-gradient-to-r from-indigo-500 to-emerald-400 rounded-full"
                          style={{ width: "82%" }}
                        />
                      </div>
                      <div className="flex justify-between text-[11px] text-slate-400">
                        <span>{t("Wall St Consensus", "华尔街共识")}: ${s.wallStTarget.toFixed(2)}</span>
                        <span className="text-emerald-400 font-semibold">{t("High Margin of Safety", "安全边际: 极高")}</span>
                      </div>
                    </div>

                    <div className="mt-3.5 bg-slate-950/80 rounded-xl p-2.5 border border-slate-800/70 text-xs">
                      <div className="flex items-center text-cyan-400 font-semibold text-[11px] mb-1">
                        <Clock className="w-3.5 h-3.5 mr-1" />
                        <span>{t("Key Catalyst", "近期催化剂")}</span>
                      </div>
                      <p className="text-slate-300 line-clamp-2 leading-relaxed">
                        {lang === "en" ? s.catalyst : s.catalystZh}
                      </p>
                    </div>

                    <div className="mt-4 flex items-center justify-between text-xs pt-2">
                      <span className="text-slate-500 font-mono">PE: {s.pe} · 护城河: {s.moatScore}</span>
                      <span className="text-indigo-400 font-semibold group-hover:translate-x-1 transition-transform">
                        {t("Deep Analysis →", "深度解析报告 →")}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* SECTION: 策略标的池与双视图切换 */}
            <section className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-white tracking-tight">{t("Stock Pool", "量化精选池")}</h3>
                  <span className="text-xs text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded-full border border-slate-700/60 font-mono">
                    {t(`Showing ${filteredStocks.length} of ${STOCK_POOL.length}`, `显示 ${filteredStocks.length} / ${STOCK_POOL.length} 个结果`)}
                  </span>
                </div>

                <div className="flex items-center gap-3 text-xs">
                  {/* View Mode Toggle */}
                  <div className="flex bg-slate-950 p-0.5 rounded-lg border border-slate-800">
                    <button
                      onClick={() => setViewMode("card")}
                      className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all flex items-center gap-1 ${
                        viewMode === "card" ? "bg-indigo-600 text-white shadow-sm" : "text-slate-400 hover:text-white"
                      }`}
                    >
                      <LayoutGrid className="w-3.5 h-3.5" />
                      <span>{t("Cards", "聚焦卡片")}</span>
                    </button>
                    <button
                      onClick={() => setViewMode("table")}
                      className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all flex items-center gap-1 ${
                        viewMode === "table" ? "bg-indigo-600 text-white shadow-sm" : "text-slate-400 hover:text-white"
                      }`}
                    >
                      <TableIcon className="w-3.5 h-3.5" />
                      <span>{t("Table", "高能表格")}</span>
                    </button>
                  </div>

                  {/* Sort Selection */}
                  <select
                    value={sortKey}
                    onChange={(e) => setSortKey(e.target.value as any)}
                    className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-slate-300 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="score">{t("AI Score (High to Low)", "AI 确信度评分 (从高到低)")}</option>
                    <option value="upside">{t("Upside (High to Low)", "潜在上涨空间 (从大到小)")}</option>
                    <option value="pe">{t("P/E Ratio (Low to High)", "估值 P/E (从低到高)")}</option>
                  </select>
                </div>
              </div>

              {/* CARD GRID VIEW */}
              {viewMode === "card" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredStocks.map((s) => (
                    <div
                      key={s.ticker}
                      onClick={() => setSelectedStock(s)}
                      className="rounded-xl p-4 flex flex-col justify-between cursor-pointer group bg-slate-900/80 hover:bg-slate-900 border border-slate-800 hover:border-indigo-500/40 transition-all duration-200 shadow-md"
                    >
                      <div>
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2.5">
                            <div className="w-9 h-9 rounded-lg bg-slate-800 border border-slate-700 font-bold font-mono text-sm text-white flex items-center justify-center">
                              {s.ticker}
                            </div>
                            <div>
                              <h4 className="font-bold text-white text-sm leading-tight">{s.name}</h4>
                              <span className="text-[11px] text-slate-400">{lang === "en" ? s.sector : s.sectorZh}</span>
                            </div>
                          </div>
                          <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                            s.score >= 93
                              ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                              : "bg-indigo-500/15 text-indigo-300 border border-indigo-500/30"
                          }`}>
                            {s.score}分
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 my-3 p-2 rounded-lg bg-slate-950/60 border border-slate-800/60 text-xs">
                          <div>
                            <span className="text-[10px] text-slate-500 block">{t("Current", "当前市价")}</span>
                            <span className="font-mono font-bold text-slate-200">${s.price.toFixed(2)}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-500 block">{t("AI Target", "AI 目标与空间")}</span>
                            <span className="font-mono font-bold text-emerald-400">
                              ${s.aiTarget.toFixed(2)} ({s.upside})
                            </span>
                          </div>
                        </div>

                        <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">
                          {lang === "en" ? s.catalyst : s.catalystZh}
                        </p>
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-400">
                        <span className="font-mono">PE: {s.pe} · 护城河: {s.moatScore}</span>
                        <span className="text-indigo-400 font-semibold group-hover:translate-x-0.5 transition-transform">
                          {t("Thesis →", "查看论据 →")}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* TABLE VIEW */}
              {viewMode === "table" && (
                <div className="rounded-2xl overflow-hidden border border-slate-800 bg-slate-950/80 shadow-xl">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-900/90 text-slate-400 font-semibold text-xs border-b border-slate-800 uppercase tracking-wider">
                        <tr>
                          <th className="py-3 px-4">{t("Ticker / Company", "代码 / 公司")}</th>
                          <th className="py-3 px-4">{t("Strategy", "策略分类")}</th>
                          <th className="py-3 px-4 text-center">{t("AI Score", "AI 评分")}</th>
                          <th className="py-3 px-4 text-right">{t("Price", "市价")}</th>
                          <th className="py-3 px-4 text-right">{t("AI Target", "AI 估值目标")}</th>
                          <th className="py-3 px-4 text-right">{t("Upside", "潜在空间")}</th>
                          <th className="py-3 px-4">{t("Core Catalyst", "核心论点")}</th>
                          <th className="py-3 px-4 text-center">{t("Action", "操作")}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {filteredStocks.map((s) => (
                          <tr
                            key={s.ticker}
                            onClick={() => setSelectedStock(s)}
                            className="hover:bg-slate-800/40 transition-colors cursor-pointer"
                          >
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-white font-mono">{s.ticker}</span>
                                <span className="text-xs text-slate-400">{s.name}</span>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-xs text-slate-300 capitalize">{s.strategy}</td>
                            <td className="py-3 px-4 text-center">
                              <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                                s.score >= 93
                                  ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                                  : "bg-indigo-500/15 text-indigo-300 border border-indigo-500/30"
                              }`}>
                                {s.score}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-medium text-slate-200">
                              ${s.price.toFixed(2)}
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-bold text-emerald-400">
                              ${s.aiTarget.toFixed(2)}
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-bold text-emerald-400">
                              {s.upside}
                            </td>
                            <td className="py-3 px-4 text-xs text-slate-300 max-w-xs truncate">
                              {lang === "en" ? s.catalyst : s.catalystZh}
                            </td>
                            <td className="py-3 px-4 text-center">
                              <button className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold px-2 py-1 rounded hover:bg-indigo-500/10">
                                {t("Details", "详情")}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

            </section>

          </div>
        )}

      </div>

      {/* ===================================================================== */}
      {/* SLIDE-OUT DEEP DIVE DRAWER (全局共享: 沉浸式深度研报抽屉) */}
      {/* ===================================================================== */}
      {selectedStock && (
        <>
          <div
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 transition-opacity duration-300"
            onClick={() => setSelectedStock(null)}
          />

          <div className="fixed top-0 right-0 h-full w-full max-w-xl bg-slate-900/95 backdrop-blur-2xl border-l border-slate-800 z-50 transition-transform duration-300 ease-out flex flex-col shadow-2xl">
            {/* Drawer Header */}
            <div className="p-6 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-xl bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 font-extrabold text-xl flex items-center justify-center font-mono">
                  {selectedStock.ticker}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold text-white">{selectedStock.name}</h2>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                      AI评分 {selectedStock.score}
                    </span>
                  </div>
                  <span className="text-xs text-slate-400">
                    {lang === "en" ? selectedStock.sector : selectedStock.sectorZh} · P/E {selectedStock.pe}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setSelectedStock(null)}
                className="p-2 rounded-lg bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              
              {/* Dual Target Card */}
              <div className="bg-slate-950/60 rounded-xl p-4 border border-slate-800/80 space-y-3">
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  {t("Dual Price Target & Margin of Safety", "双重目标价与安全边际模型")}
                </div>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="bg-slate-900/80 rounded-lg p-2.5 border border-slate-800">
                    <span className="text-[11px] text-slate-500 block">{t("Current", "当前市价")}</span>
                    <span className="font-mono text-lg font-bold text-white">${selectedStock.price.toFixed(2)}</span>
                  </div>
                  <div className="bg-slate-900/80 rounded-lg p-2.5 border border-slate-800">
                    <span className="text-[11px] text-slate-500 block">{t("Wall St Target", "华尔街均价")}</span>
                    <span className="font-mono text-lg font-bold text-slate-300">
                      ${selectedStock.wallStTarget.toFixed(2)}
                    </span>
                  </div>
                  <div className="bg-emerald-500/10 rounded-lg p-2.5 border border-emerald-500/30">
                    <span className="text-[11px] text-emerald-400 block font-semibold">{t("AI Fair Value", "AI 公允价值")}</span>
                    <span className="font-mono text-lg font-bold text-emerald-400">
                      ${selectedStock.aiTarget.toFixed(2)}
                    </span>
                  </div>
                </div>
                <div className="flex justify-between items-center text-xs text-slate-400 pt-1">
                  <span>
                    {t("Upside Potential", "折价估算上涨空间")}:{" "}
                    <strong className="text-emerald-400 font-mono">{selectedStock.upside}</strong>
                  </span>
                  <span className="bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded text-[11px]">
                    {t("Strong Buy Conviction", "强烈推荐配置")}
                  </span>
                </div>
              </div>

              {/* 4 Quantitative Pillar Bars */}
              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                  {t("4 Quantitative Pillars Diagnosis", "四大定量支柱诊断")}
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-900/60 rounded-xl p-3 border border-slate-800">
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="text-slate-400">{t("Moat & Quality", "护城河与盈利质量")}</span>
                      <span className="font-bold text-emerald-400">{selectedStock.moatScore} / 100</span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                      <div className="bg-emerald-400 h-full rounded-full" style={{ width: `${selectedStock.moatScore}%` }} />
                    </div>
                  </div>

                  <div className="bg-slate-900/60 rounded-xl p-3 border border-slate-800">
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="text-slate-400">{t("Growth Momentum", "营收与利润成长性")}</span>
                      <span className="font-bold text-indigo-400">{selectedStock.growthScore} / 100</span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                      <div className="bg-indigo-400 h-full rounded-full" style={{ width: `${selectedStock.growthScore}%` }} />
                    </div>
                  </div>

                  <div className="bg-slate-900/60 rounded-xl p-3 border border-slate-800">
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="text-slate-400">{t("Technical Breakout", "动量与均线突破")}</span>
                      <span className="font-bold text-cyan-400">{selectedStock.momentumScore} / 100</span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                      <div className="bg-cyan-400 h-full rounded-full" style={{ width: `${selectedStock.momentumScore}%` }} />
                    </div>
                  </div>

                  <div className="bg-slate-900/60 rounded-xl p-3 border border-slate-800">
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="text-slate-400">{t("Valuation & FCF", "估值倍数与现金流")}</span>
                      <span className="font-bold text-amber-400">{selectedStock.valuationScore} / 100</span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                      <div className="bg-amber-400 h-full rounded-full" style={{ width: `${selectedStock.valuationScore}%` }} />
                    </div>
                  </div>
                </div>
              </div>

              {/* AI Investment Thesis */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  {t("AI Investment Thesis & Catalysts", "AI 投资论点与催化剂拆解")}
                </h4>
                <div className="bg-slate-950/70 rounded-xl p-4 border border-slate-800 text-xs sm:text-sm text-slate-300 leading-relaxed space-y-2">
                  {(lang === "en" ? selectedStock.thesisEn : selectedStock.thesisZh).map((item, idx) => (
                    <p key={idx}>• {item}</p>
                  ))}
                </div>
              </div>

            </div>

            {/* Drawer Footer Actions */}
            <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex items-center gap-3">
              <button
                onClick={() => {
                  selectedStock.isWatchlist = !selectedStock.isWatchlist;
                  showToast(
                    selectedStock.isWatchlist
                      ? `已将 ${selectedStock.ticker} 加入自选监控`
                      : `已将 ${selectedStock.ticker} 移出自选监控`
                  );
                }}
                className="flex-1 py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs sm:text-sm transition-all border border-slate-700 flex items-center justify-center gap-2"
              >
                <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                <span>{selectedStock.isWatchlist ? t("In Watchlist", "已在自选") : t("Add to Watchlist", "加入自选监控")}</span>
              </button>

              <Link
                href={`/report/${selectedStock.ticker}`}
                className="flex-1 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs sm:text-sm shadow-lg shadow-indigo-500/25 transition-all flex items-center justify-center gap-2"
              >
                <FileText className="w-4 h-4" />
                <span>{t("Open Full Report", "查看完整个股研报")}</span>
              </Link>
            </div>
          </div>
        </>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 bg-slate-900 border border-slate-700 text-white px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2 text-xs sm:text-sm z-50">
          <Sparkles className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

    </main>
  );
}
