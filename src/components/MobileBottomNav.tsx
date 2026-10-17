'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Compass, Sparkles, Activity, BrainCircuit, Briefcase } from 'lucide-react';

const NAV_ITEMS = [
    {
        href: '/',
        label: '选股大师',
        subLabel: 'Screener',
        icon: Compass,
        match: (path: string) => path === '/' || (path.startsWith('/screener/') && path !== '/screener/matrix'),
        activeColor: 'text-cyan-400 border-cyan-400/50 bg-cyan-500/10',
    },
    {
        href: '/screener/matrix',
        label: '共振矩阵',
        subLabel: 'Matrix',
        icon: Sparkles,
        match: (path: string) => path === '/screener/matrix',
        activeColor: 'text-amber-400 border-amber-400/50 bg-amber-500/10',
    },
    {
        href: '/updates',
        label: '更替动态',
        subLabel: 'Updates',
        icon: Activity,
        match: (path: string) => path.startsWith('/updates'),
        activeColor: 'text-emerald-400 border-emerald-400/50 bg-emerald-500/10',
    },
    {
        href: '/audit',
        label: '胜率自愈',
        subLabel: 'AI Audit',
        icon: BrainCircuit,
        match: (path: string) => path.startsWith('/audit'),
        activeColor: 'text-purple-400 border-purple-400/50 bg-purple-500/10',
    },
    {
        href: '/watchlist',
        label: '投资组合',
        subLabel: 'Portfolio',
        icon: Briefcase,
        match: (path: string) => path.startsWith('/watchlist'),
        activeColor: 'text-indigo-400 border-indigo-400/50 bg-indigo-500/10',
    },
];

export function MobileBottomNav() {
    const pathname = usePathname() || '/';

    return (
        <nav
            aria-label="Mobile Primary Navigation"
            className="md:hidden print:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#070b14]/95 backdrop-blur-xl border-t border-slate-800/90 px-1.5 pt-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))] shadow-[0_-8px_30px_rgba(0,0,0,0.65)]"
        >
            <div className="grid grid-cols-5 gap-1 max-w-md mx-auto">
                {NAV_ITEMS.map((item) => {
                    const Icon = item.icon;
                    const isActive = item.match(pathname);
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-xl border transition-all active:scale-95 ${
                                isActive
                                    ? item.activeColor
                                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                            }`}
                        >
                            <Icon className={`w-4 h-4 mb-0.5 ${isActive ? 'scale-110' : ''} transition-transform`} />
                            <span className="text-[11px] font-bold leading-tight tracking-tight truncate max-w-full">
                                {item.label}
                            </span>
                            <span className="text-[8px] font-medium opacity-70 leading-none truncate max-w-full">
                                {item.subLabel}
                            </span>
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
}
