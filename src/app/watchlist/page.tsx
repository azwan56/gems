"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Gem, ArrowLeft, StarOff, Trash2, Shield, Sword, Rocket, CircleDollarSign, RefreshCcw, AlertTriangle, HelpCircle, ChevronDown } from "lucide-react";
import type { WatchlistItem } from "@/lib/types";

const ROLE_CONFIGS = {
  anchor: { icon: Shield, color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20", label: "Anchor (Stability)", desc: "Low volatility, strong cash flow" },
  striker: { icon: Sword, color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20", label: "Striker (Core Growth)", desc: "High conviction, steady compounding" },
  rocket: { icon: Rocket, color: "text-purple-400", bg: "bg-purple-500/10", border: "border-purple-500/20", label: "Rocket (High Beta)", desc: "High risk/reward, hyper-growth" },
  core_dividend: { icon: CircleDollarSign, color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20", label: "Core Dividend", desc: "Value: Reliable yield" },
  turnaround: { icon: RefreshCcw, color: "text-cyan-400", bg: "bg-cyan-500/10", border: "border-cyan-500/20", label: "Turnaround", desc: "Value: Cyclical reversion" },
  special_situation: { icon: AlertTriangle, color: "text-pink-400", bg: "bg-pink-500/10", border: "border-pink-500/20", label: "Special Sit.", desc: "Value: Event-driven" },
  unassigned: { icon: HelpCircle, color: "text-slate-400", bg: "bg-slate-800", border: "border-slate-700", label: "Unassigned", desc: "Needs allocation" }
};

type RoleKey = keyof typeof ROLE_CONFIGS;

export default function WatchlistPage() {
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWatchlist();
  }, []);

  const fetchWatchlist = async () => {
    try {
      const res = await fetch("/api/watchlist?userId=demo-user");
      if (res.ok) {
        const data = await res.json();
        setWatchlist(data.watchlist);
      }
    } catch { /* ignore */ }
    setLoading(false);
  };

  const removeItem = async (symbol: string) => {
    try {
      await fetch("/api/watchlist", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: "demo-user", symbol }),
      });
      setWatchlist((prev) => prev.filter((w) => w.symbol !== symbol));
    } catch { /* ignore */ }
  };

  const updateRole = async (symbol: string, newRole: RoleKey) => {
    const roleToSend = newRole === "unassigned" ? undefined : newRole;
    try {
      // Optimistic UI update
      setWatchlist(prev => prev.map(item => 
        item.symbol === symbol ? { ...item, role: roleToSend } : item
      ));

      await fetch("/api/watchlist", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: "demo-user", symbol, role: roleToSend }),
      });
    } catch { 
      // Revert on failure by refetching
      fetchWatchlist();
    }
  };

  // Group items
  const grouped = watchlist.reduce((acc, item) => {
    const role = item.role || "unassigned";
    if (!acc[role]) acc[role] = [];
    acc[role].push(item);
    return acc;
  }, {} as Record<string, WatchlistItem[]>);

  // Growth layout vs Value layout vs Unassigned
  const growthRoles: RoleKey[] = ["anchor", "striker", "rocket"];
  const valueRoles: RoleKey[] = ["core_dividend", "turnaround", "special_situation"];

  const renderStockCard = (item: WatchlistItem) => (
    <div key={item.symbol} className="bg-slate-800/60 border border-slate-700 rounded-xl p-4 flex flex-col gap-3 hover:bg-slate-800 transition-colors group relative">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-xl font-bold text-white">{item.symbol}</h3>
          <p className="text-xs text-slate-500 mt-1">Added {new Date(item.addedAt).toLocaleDateString()}</p>
        </div>
        <button
          onClick={() => removeItem(item.symbol)}
          className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100"
          title="Remove from portfolio"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <div className="relative mt-2">
        <select
          value={item.role || "unassigned"}
          onChange={(e) => updateRole(item.symbol, e.target.value as RoleKey)}
          className="w-full appearance-none bg-slate-900 border border-slate-700 text-sm text-slate-300 rounded-lg px-3 py-2 pr-8 outline-none focus:border-blue-500 transition-colors"
        >
          <option value="unassigned">-- Select Role --</option>
          <optgroup label="Growth & Scale">
            <option value="anchor">Anchor (Stability)</option>
            <option value="striker">Striker (Core Growth)</option>
            <option value="rocket">Rocket (High Beta)</option>
          </optgroup>
          <optgroup label="Value & Income">
            <option value="core_dividend">Core Dividend</option>
            <option value="turnaround">Turnaround</option>
            <option value="special_situation">Special Situation</option>
          </optgroup>
        </select>
        <ChevronDown className="w-4 h-4 text-slate-500 absolute right-3 top-2.5 pointer-events-none" />
      </div>
    </div>
  );

  const renderColumn = (roleKey: RoleKey) => {
    const config = ROLE_CONFIGS[roleKey];
    const items = grouped[roleKey] || [];
    const Icon = config.icon;

    return (
      <div key={roleKey} className={`flex flex-col rounded-2xl border ${config.border} bg-slate-900/50 overflow-hidden`}>
        <div className={`p-4 border-b ${config.border} ${config.bg} flex items-center justify-between`}>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg bg-slate-900 ${config.color}`}>
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <h2 className={`font-bold ${config.color}`}>{config.label}</h2>
              <p className="text-xs text-slate-400">{config.desc}</p>
            </div>
          </div>
          <span className="text-sm font-mono font-bold text-slate-500 bg-slate-900 px-2.5 py-1 rounded-md">{items.length}</span>
        </div>
        <div className="p-4 flex-1 space-y-3 min-h-[150px]">
          {items.length === 0 ? (
            <div className="h-full flex items-center justify-center text-sm text-slate-600 border-2 border-dashed border-slate-800 rounded-xl p-6 text-center">
              No stocks assigned to this role
            </div>
          ) : (
            items.map(renderStockCard)
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-slate-800 px-6 py-4 bg-slate-900/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors">
              <ArrowLeft className="w-4 h-4" />
              <Gem className="w-5 h-5 text-blue-400" />
              <span className="font-bold text-white">Gems</span>
            </Link>
            <div className="h-5 w-px bg-slate-700" />
            <h1 className="text-sm font-semibold">Portfolio Dashboard</h1>
          </div>
          <div className="text-sm text-slate-400">
            Total Conviction Picks: <span className="text-white font-bold">{watchlist.length}</span> / 10
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 px-6 py-8 overflow-x-auto">
        <div className="max-w-7xl mx-auto min-w-[1000px]">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : watchlist.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-32 text-center">
              <StarOff className="w-16 h-16 text-slate-700 mb-6" />
              <h2 className="text-2xl font-bold text-slate-300 mb-3">Your Portfolio is Empty</h2>
              <p className="text-slate-500 mb-8 max-w-md">
                Run a screening strategy to find high-conviction stocks and assign them to your portfolio formation.
              </p>
              <Link
                href="/"
                className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold transition-all hover:scale-105 shadow-lg shadow-blue-500/20"
              >
                Browse Strategies
              </Link>
            </div>
          ) : (
            <div className="space-y-8">
              
              {/* Unassigned Pool */}
              {(grouped["unassigned"]?.length > 0) && (
                <div className="mb-8">
                  <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <HelpCircle className="w-4 h-4" /> Needs Allocation ({grouped["unassigned"].length})
                  </h3>
                  <div className="grid grid-cols-4 gap-4">
                    {grouped["unassigned"].map(renderStockCard)}
                  </div>
                </div>
              )}

              {/* Growth Formation */}
              <div>
                <h3 className="text-sm font-bold text-blue-400 uppercase tracking-widest mb-4">Growth & Scale Formation</h3>
                <div className="grid grid-cols-3 gap-6">
                  {growthRoles.map(renderColumn)}
                </div>
              </div>

              <div className="h-px bg-slate-800 my-8" />

              {/* Value Formation */}
              <div>
                <h3 className="text-sm font-bold text-amber-400 uppercase tracking-widest mb-4">Value & Income Formation</h3>
                <div className="grid grid-cols-3 gap-6">
                  {valueRoles.map(renderColumn)}
                </div>
              </div>

            </div>
          )}
        </div>
      </div>
    </div>
  );
}
