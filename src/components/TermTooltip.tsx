'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { BookOpen, X, Sparkles } from 'lucide-react';

export interface OntologyTermEntry {
    term: string;
    category: string;
    zhTitle: string;
    zhDesc: string;
    enDesc: string;
    formula?: string;
}

export const ONTOLOGY_GLOSSARY: Record<string, OntologyTermEntry> = {
    'P/E Ratio': {
        term: 'P/E Ratio',
        category: 'Valuation Ontology · 估值本体',
        zhTitle: '市盈率 (Price-to-Earnings)',
        zhDesc: '股价与每股收益(EPS)的比率，衡量市场愿意为公司每1美元净利润支付多少价格。价值型策略通常偏好低P/E且盈利稳定的标的。',
        enDesc: 'Share price divided by annual Earnings Per Share (EPS). Measures how much investors pay per dollar of net earnings.',
        formula: 'P/E = Share Price / EPS (TTM)',
    },
    'P/B Ratio': {
        term: 'P/B Ratio',
        category: 'Valuation Ontology · 估值本体',
        zhTitle: '市净率 (Price-to-Book)',
        zhDesc: '股价与每股净资产的比率。格雷厄姆深度价值策略核心指标，P/B < 1.5 代表股价具备显著账面资产安全边际。',
        enDesc: 'Share price divided by Book Value per share. Core Benjamin Graham deep-value metric for asset safety margin.',
        formula: 'P/B = Market Cap / Total Shareholders Equity',
    },
    'FCF Yield': {
        term: 'FCF Yield',
        category: 'Cash Flow Ontology · 现金流本体',
        zhTitle: '自由现金流收益率 (Free Cash Flow Yield)',
        zhDesc: '每年自由现金流占总市值的百分比。越高说明公司内生造血能力越强，具备分红、回购与抗周期缓冲实力。',
        enDesc: 'Free Cash Flow per share divided by share price. Higher FCF yield indicates strong cash generation relative to valuation.',
        formula: 'FCF Yield = Free Cash Flow / Market Cap',
    },
    'PEG Ratio': {
        term: 'PEG Ratio',
        category: 'GARP Ontology · 成长估值本体',
        zhTitle: '市盈率相对盈利增长比率 (PEG)',
        zhDesc: '彼得·林奇 (Peter Lynch) 核心指标，用 P/E 除以预期盈利增长率。PEG < 1.0 通常代表高成长性尚未被市场充分定价。',
        enDesc: 'P/E ratio divided by expected annual EPS growth rate. PEG < 1.0 signals undervalued growth (GARP).',
        formula: 'PEG = (P/E Ratio) / (EPS Growth Rate %)',
    },
    'ROE': {
        term: 'ROE',
        category: 'Profitability Ontology · 盈利本体',
        zhTitle: '净资产收益率 (Return on Equity)',
        zhDesc: '巴菲特最看重的资本回报指标，衡量公司运用股东资本创造利润的效率。持续 ROE > 15% 往往伴随深厚护城河。',
        enDesc: 'Net income divided by shareholders equity. Buffett’s premier metric for capital allocation efficiency and moat durability.',
        formula: 'ROE = Net Income / Shareholders Equity',
    },
    'Gross Margin': {
        term: 'Gross Margin',
        category: 'Moat Ontology · 护城河本体',
        zhTitle: '毛利率 (Gross Profit Margin)',
        zhDesc: '扣除直接生产成本后的利润率。高且稳定的毛利率（如 >50%）直接反映企业的品牌溢价、专利壁垒或议价权。',
        enDesc: 'Revenue minus Cost of Goods Sold (COGS) divided by Revenue. High gross margin reflects pricing power and economic moat.',
        formula: 'Gross Margin = (Revenue - COGS) / Revenue',
    },
    'D/E Ratio': {
        term: 'D/E Ratio',
        category: 'Solvency Ontology · 偿债本体',
        zhTitle: '产权比率 / 负债权益比 (Debt-to-Equity)',
        zhDesc: '总负债与股东权益之比，衡量财务杠杆水平。低 D/E (< 0.5) 意味着在高利率周期下利息负担极轻，破产风险极低。',
        enDesc: 'Total debt divided by total shareholders equity. Measures financial leverage and balance-sheet resilience.',
        formula: 'D/E = Total Debt / Total Equity',
    },
    '50SMA': {
        term: '50SMA',
        category: 'Technical Ontology · 趋势本体',
        zhTitle: '50日简单移动平均线 (50-Day SMA)',
        zhDesc: '中期机构持仓成本生命线。股价站稳 50SMA 上方代表中期上升趋势确立，常用于趋势突破与回踩确认。',
        enDesc: '50-Day Simple Moving Average. Key institutional medium-term support and trend momentum benchmark.',
        formula: 'SMA₅₀ = (P₁ + P₂ + ... + P₅₀) / 50',
    },
    '200SMA': {
        term: '200SMA',
        category: 'Technical Ontology · 趋势本体',
        zhTitle: '200日牛熊分界线 (200-Day SMA)',
        zhDesc: '华尔街公认的长期牛熊分水岭。50SMA 上穿 200SMA 形成“黄金交叉 (Golden Cross)”，触发右侧趋势动量信号。',
        enDesc: '200-Day Simple Moving Average. Defines long-term secular bull vs. bear regimes and Golden Cross signals.',
        formula: 'SMA₂₀₀ = (P₁ + P₂ + ... + P₂₀₀) / 200',
    },
    'RRG': {
        term: 'RRG',
        category: 'Sector Rotation Ontology · 轮动本体',
        zhTitle: '相对轮动图 (Relative Rotation Graph)',
        zhDesc: '追踪 27 个核心板块相对于 SPY 基准的相对强度(RS-Ratio)与动量变化(RS-Momentum)，划分为领涨、转弱、落后、改善四大象限。',
        enDesc: 'Maps 27 sectors across Leading, Weakening, Lagging, and Improving quadrants based on relative strength and momentum vs. SPY.',
        formula: 'Quadrants: (RS-Ratio gtrless 100) × (RS-Momentum gtrless 100)',
    },
    'RS-Ratio': {
        term: 'RS-Ratio',
        category: 'Sector Rotation Ontology · 轮动本体',
        zhTitle: '相对强度比率 (JdK RS-Ratio)',
        zhDesc: '衡量板块相对于标普500 (SPY) 的中长期相对趋势强弱。大于 100 表示跑赢大盘基准，小于 100 表示跑输。',
        enDesc: 'Normalized relative trend strength vs. S&P 500 benchmark (centered at 100.0). Values > 100 indicate outperformance.',
        formula: 'RS-Ratio = 100 + Z-Score(EMA_short(S/B) / EMA_long(S/B))',
    },
    'RS-Momentum': {
        term: 'RS-Momentum',
        category: 'Sector Rotation Ontology · 轮动本体',
        zhTitle: '相对强度动量 (JdK RS-Momentum)',
        zhDesc: '衡量 RS-Ratio 的一阶变化率（加速度）。大于 100 代表相对强度正在加速改善（资金流入提速）。',
        enDesc: 'Rate of change of RS-Ratio (centered at 100.0). Values > 100 indicate accelerating relative momentum.',
        formula: 'RS-Momentum = 100 + Z-Score(ROC(RS-Ratio))',
    },
    'Beta': {
        term: 'Beta',
        category: 'Risk Ontology · 风险本体',
        zhTitle: '贝塔系数 (Market Beta)',
        zhDesc: '衡量个股相对于大盘(SPY)的波动敏感度。Beta > 1 代表进攻型高弹性标的；Beta < 1 代表防御型低波动标的。',
        enDesc: 'Measures volatility sensitivity relative to the S&P 500 (Beta = 1.0). Higher Beta amplifies market swings.',
        formula: 'β = Cov(R_stock, R_market) / Var(R_market)',
    },
    'TAM': {
        term: 'TAM',
        category: 'Growth Ontology · 空间本体',
        zhTitle: '潜在总市场规模 (Total Addressable Market)',
        zhDesc: '企业产品或服务在完全渗透理想状态下可触达的最大年化营收天花板，是百倍成长股 (100-Bagger) 的核心前置条件。',
        enDesc: 'Total Addressable Market. The maximum revenue opportunity available for a product or service at 100% penetration.',
    },
    'DCF': {
        term: 'DCF',
        category: 'Valuation Ontology · 估值本体',
        zhTitle: '现金流折现模型 (Discounted Cash Flow)',
        zhDesc: '将企业未来生命周期产生的所有自由现金流，按加权平均资本成本(WACC)折现回今日的内在价值评估体系。',
        enDesc: 'Intrinsic valuation model that discounts projected future Free Cash Flows back to present value using WACC.',
        formula: 'V₀ = ∑ [FCF_t / (1 + WACC)^t] + Terminal Value',
    },
    'T+5': {
        term: 'T+5',
        category: 'Audit Ontology · 闭环验证本体',
        zhTitle: 'T+5 实盘前瞻胜率审计 (Forward 5-Day Audit)',
        zhDesc: '所有 AI 入选标的在锁定 5 个交易日后，自动抓取真实收盘价对比同期 SPY 涨跌幅，计算超额 Alpha 并驱动错题本自愈。',
        enDesc: 'Automated 5-trading-day forward performance verification comparing AI stock picks against S&P 500 benchmark.',
        formula: 'Excess Alpha = Return(Stock, T+5) - Return(SPY, T+5)',
    },
    'Walk-Forward': {
        term: 'Walk-Forward',
        category: 'Backtest Ontology · 回测本体',
        zhTitle: '滚动前推无前视偏差回测 (Walk-Forward Validation)',
        zhDesc: '严格按照历史日历时点切分训练与验证窗口，杜绝未来函数(Look-Ahead Bias)，结合 Lo (2002) 自相关修正夏普比率验证策略显著性。',
        enDesc: 'Out-of-sample rolling validation preventing look-ahead bias, paired with Lo (2002) autocorrelation-adjusted Sharpe ratio.',
    },
    'Ontology': {
        term: 'Ontology',
        category: 'Architecture Ontology · 架构本体',
        zhTitle: '三层金融领域本体 (3-Layer Financial Domain Ontology)',
        zhDesc: '由语义层(Neo4j五维实体关系图谱)、契约与词汇层(Pydantic强类型+双语词典)、动力算子层(RRG/回测/自愈闭环)构成的机构级认知底座。',
        enDesc: 'Palantir-inspired 3-layer architecture combining Neo4j Semantic Graph, Pydantic Data Contracts, and Kinetic Quant Action Operators.',
    },
};

const ALIAS_MAP: Record<string, string> = {
    'p/e ratio': 'P/E Ratio',
    'p/e': 'P/E Ratio',
    '市盈率': 'P/E Ratio',
    'p/b ratio': 'P/B Ratio',
    'p/b': 'P/B Ratio',
    '市净率': 'P/B Ratio',
    'fcf yield': 'FCF Yield',
    'fcf': 'FCF Yield',
    '自由现金流': 'FCF Yield',
    'peg ratio': 'PEG Ratio',
    'peg': 'PEG Ratio',
    'roe': 'ROE',
    '净资产收益率': 'ROE',
    'gross margin': 'Gross Margin',
    '毛利率': 'Gross Margin',
    'd/e ratio': 'D/E Ratio',
    'd/e': 'D/E Ratio',
    '负债权益比': 'D/E Ratio',
    '50sma': '50SMA',
    '200sma': '200SMA',
    'rrg': 'RRG',
    'rs-ratio': 'RS-Ratio',
    'rs-momentum': 'RS-Momentum',
    'beta': 'Beta',
    '贝塔': 'Beta',
    'tam': 'TAM',
    'dcf': 'DCF',
    '现金流折现': 'DCF',
    't+5': 'T+5',
    'walk-forward': 'Walk-Forward',
    'ontology': 'Ontology',
    '金融本体': 'Ontology',
};

export function resolveTermKey(raw: string): OntologyTermEntry | null {
    const direct = ONTOLOGY_GLOSSARY[raw];
    if (direct) return direct;
    const mapped = ALIAS_MAP[raw.trim().toLowerCase()];
    if (mapped && ONTOLOGY_GLOSSARY[mapped]) return ONTOLOGY_GLOSSARY[mapped];
    return null;
}

interface TermTooltipProps {
    term: string;
    children?: React.ReactNode;
    className?: string;
    showIcon?: boolean;
}

export function TermTooltip({ term, children, className = '', showIcon = true }: TermTooltipProps) {
    const entry = resolveTermKey(term);
    const [open, setOpen] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    const [coords, setCoords] = useState<{ top: number; left: number; placeAbove: boolean }>({
        top: 0,
        left: 0,
        placeAbove: true,
    });

    const triggerRef = useRef<HTMLSpanElement>(null);
    const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        setMounted(true);
        const checkMobile = () => setIsMobile(window.innerWidth < 640);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    const updatePosition = useCallback(() => {
        if (!triggerRef.current) return;
        const rect = triggerRef.current.getBoundingClientRect();
        const tooltipWidth = 320;
        const margin = 12;
        let left = rect.left + rect.width / 2 - tooltipWidth / 2;
        left = Math.max(margin, Math.min(left, window.innerWidth - tooltipWidth - margin));

        const placeAbove = rect.top > 220;
        const top = placeAbove ? rect.top - 10 : rect.bottom + 10;

        setCoords({ top, left, placeAbove });
    }, []);

    const handleOpen = () => {
        if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
        updatePosition();
        setOpen(true);
    };

    const handleClose = () => {
        closeTimeoutRef.current = setTimeout(() => {
            setOpen(false);
        }, 120);
    };

    useEffect(() => {
        if (!open) return;
        const onScrollOrResize = () => {
            if (!isMobile) updatePosition();
        };
        window.addEventListener('scroll', onScrollOrResize, true);
        window.addEventListener('resize', onScrollOrResize);
        return () => {
            window.removeEventListener('scroll', onScrollOrResize, true);
            window.removeEventListener('resize', onScrollOrResize);
        };
    }, [open, isMobile, updatePosition]);

    if (!entry) {
        return <span className={className}>{children || term}</span>;
    }

    return (
        <>
            <span
                ref={triggerRef}
                onMouseEnter={() => !isMobile && handleOpen()}
                onMouseLeave={() => !isMobile && handleClose()}
                onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    updatePosition();
                    setOpen((prev) => !prev);
                }}
                className={`inline-flex items-center gap-1 cursor-help border-b border-dashed border-cyan-400/60 hover:border-cyan-300 text-inherit transition-colors select-none ${className}`}
            >
                <span>{children || term}</span>
                {showIcon && (
                    <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-cyan-500/15 text-cyan-300 text-[9px] font-bold leading-none shrink-0">
                        ?
                    </span>
                )}
            </span>

            {mounted &&
                open &&
                createPortal(
                    isMobile ? (
                        <div
                            className="fixed inset-0 z-[99999] bg-slate-950/70 backdrop-blur-xs flex items-end justify-center p-3 overscroll-contain animate-in fade-in duration-150"
                            onClick={(e) => {
                                e.stopPropagation();
                                setOpen(false);
                            }}
                        >
                            <div
                                className="w-full max-w-md rounded-2xl bg-[#0b1326] border-2 border-cyan-500/60 shadow-[0_20px_60px_rgba(0,0,0,0.9)] p-5 text-left text-slate-100 mb-14"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <div className="w-10 h-1 bg-slate-700 rounded-full mx-auto mb-3" />
                                <div className="flex items-start justify-between gap-3 mb-2">
                                    <div>
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-cyan-500/15 border border-cyan-500/30 text-[10px] font-bold uppercase tracking-wider text-cyan-300">
                                            <Sparkles className="w-2.5 h-2.5" />
                                            {entry.category}
                                        </span>
                                        <h4 className="text-base font-extrabold text-white mt-1.5">
                                            {entry.zhTitle}
                                        </h4>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setOpen(false)}
                                        className="p-1.5 rounded-lg bg-slate-800/80 text-slate-400 hover:text-white"
                                        aria-label="Close explanation"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>

                                {entry.formula && (
                                    <div className="my-2.5 px-3 py-1.5 rounded-lg bg-slate-900/90 border border-slate-700/80 font-mono text-xs text-amber-300">
                                        {entry.formula}
                                    </div>
                                )}

                                <p className="text-xs text-slate-200 leading-relaxed mb-2">
                                    {entry.zhDesc}
                                </p>
                                <p className="text-[11px] text-slate-400 leading-relaxed border-t border-slate-800 pt-2">
                                    {entry.enDesc}
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div
                            onMouseEnter={() => {
                                if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
                            }}
                            onMouseLeave={handleClose}
                            style={{
                                top: coords.top,
                                left: coords.left,
                                transform: coords.placeAbove ? 'translateY(-100%)' : 'translateY(0)',
                            }}
                            className="fixed z-[99999] w-[320px] rounded-xl bg-[#0b1326] border border-cyan-500/60 shadow-[0_16px_48px_rgba(0,0,0,0.92),0_0_25px_rgba(6,182,212,0.18)] p-4 text-left text-slate-100 pointer-events-auto"
                        >
                            <div className="flex items-center justify-between gap-2 mb-1.5">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-cyan-500/15 border border-cyan-500/30 text-[10px] font-bold uppercase tracking-wider text-cyan-300">
                                    <BookOpen className="w-2.5 h-2.5" />
                                    {entry.category}
                                </span>
                                <span className="text-[10px] font-mono text-slate-400">{entry.term}</span>
                            </div>

                            <div className="text-sm font-bold text-white mb-1.5">
                                {entry.zhTitle}
                            </div>

                            {entry.formula && (
                                <div className="mb-2 px-2.5 py-1 rounded bg-slate-900/95 border border-slate-800 font-mono text-[11px] text-amber-300">
                                    {entry.formula}
                                </div>
                            )}

                            <p className="text-xs text-slate-200 leading-relaxed mb-1.5">
                                {entry.zhDesc}
                            </p>
                            <p className="text-[11px] text-slate-400 leading-relaxed border-t border-slate-800/90 pt-1.5">
                                {entry.enDesc}
                            </p>
                        </div>
                    ),
                    document.body
                )}
        </>
    );
}

const REGEX_TERMS = [
    'P/E Ratio',
    'P/B Ratio',
    'FCF Yield',
    'PEG Ratio',
    'Gross Margin',
    'D/E Ratio',
    'RS-Momentum',
    'RS-Ratio',
    'Walk-Forward',
    '200SMA',
    '50SMA',
    'ROE',
    'PEG',
    'FCF',
    'RRG',
    'TAM',
    'DCF',
    'T\\+5',
    'Beta',
    '市盈率',
    '市净率',
    '自由现金流',
    '净资产收益率',
    '毛利率',
    '现金流折现',
];

const TERM_SPLIT_REGEX = new RegExp(`(${REGEX_TERMS.join('|')})`, 'gi');

export function TextWithTooltips({ text, className = '' }: { text: string; className?: string }) {
    if (!text) return null;
    const parts = text.split(TERM_SPLIT_REGEX);
    const seen = new Set<string>();

    return (
        <span className={className}>
            {parts.map((part, idx) => {
                const entry = resolveTermKey(part);
                if (entry && !seen.has(entry.term)) {
                    seen.add(entry.term);
                    return (
                        <TermTooltip key={idx} term={entry.term} showIcon={false} className="text-cyan-300 font-medium">
                            {part}
                        </TermTooltip>
                    );
                }
                return <React.Fragment key={idx}>{part}</React.Fragment>;
            })}
        </span>
    );
}
