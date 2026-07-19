// ============================================================
// StockChatAssistant — Floating AI chat panel for stock reports
// Allows conversational questions with real-time streaming
// ============================================================

"use client";

import React, { useState, useEffect, useRef } from "react";
import { Sparkles, Send, X, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

interface Message {
  id: string;
  role: "user" | "model";
  content: string;
}

interface StockChatAssistantProps {
  symbol: string;
  companyName: string;
  lang?: "en" | "zh";
}

export default function StockChatAssistant({
  symbol,
  companyName,
  lang = "zh",
}: StockChatAssistantProps) {
  const { user, getIdToken } = useAuth();
  
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Localization helpers
  const t = (en: string, zh: string) => (lang === "en" ? en : zh);

  const suggestions = [
    t("What is its historical P/E valuation range?", "它的历史市盈率（P/E）估值区间是多少？"),
    t("How does its growth & valuation compare to GEMS peers?", "对比同行业其它 GEMS 标的，它的增速和估值如何？"),
    t("What are the core rationales and risks of the report?", "该公司定性研报的核心投资逻辑与潜在风险是什么？"),
  ];

  // Auto-scroll to bottom of conversation
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen, isLoading]);

  // If user is not logged in or doesn't have a verified session, don't render the chat ball
  if (!user) return null;

  const handleSend = async (textToSend: string) => {
    const trimmed = textToSend.trim();
    if (!trimmed) return;

    setInput("");
    setErrorMsg(null);
    setIsLoading(true);

    // 1. Add user message
    const userMsgId = Math.random().toString();
    const newUserMsg: Message = {
      id: userMsgId,
      role: "user",
      content: trimmed,
    };
    setMessages((prev) => [...prev, newUserMsg]);

    // 2. Prepare payload history
    // Map current message list (excluding the one we just added) to the simple payload format
    const historyPayload = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    // 3. Add model placeholder message for streaming
    const aiMsgId = Math.random().toString();
    const newAiMsg: Message = {
      id: aiMsgId,
      role: "model",
      content: "",
    };
    setMessages((prev) => [...prev, newAiMsg]);

    try {
      const token = await getIdToken();
      if (!token) {
        throw new Error(t("Authentication expired. Please log in again.", "身份验证过期，请重新登录。"));
      }

      const response = await fetch("/api/stock/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          symbol,
          message: trimmed,
          history: historyPayload,
        }),
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.message || `HTTP ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error(t("Streaming failed: no readable stream body", "流式解析失败：未返回数据流"));
      }

      const decoder = new TextDecoder("utf-8");
      let done = false;

      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        if (value) {
          const chunk = decoder.decode(value, { stream: !done });
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === aiMsgId ? { ...msg, content: msg.content + chunk } : msg
            )
          );
        }
      }
    } catch (err) {
      console.error("Chat error:", err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      
      // Update UI with error
      setErrorMsg(t(`Chat failed: ${errorMessage}`, `对话失败：${errorMessage}`));
      
      // Clean up placeholder if empty
      setMessages((prev) => {
        const target = prev.find((m) => m.id === aiMsgId);
        if (target && !target.content) {
          return prev.filter((m) => m.id !== aiMsgId);
        }
        return prev.map((m) =>
          m.id === aiMsgId
            ? { ...m, content: m.content + t("\n\n*(Connection interrupted)*", "\n\n*(连接中断)*") }
            : m
        );
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 print:hidden">
      {/* Floating Action Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="w-14 h-14 bg-gradient-to-br from-emerald-500 to-teal-600 text-white rounded-full flex items-center justify-center shadow-xl shadow-teal-500/20 hover:shadow-teal-400/30 transition-all hover:scale-105 border border-white/20 group relative"
        >
          <Sparkles className="w-6 h-6 animate-pulse group-hover:rotate-12 transition-transform" />
          <span className="absolute -top-1 -right-1 flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
          </span>
        </button>
      )}

      {/* Chat Drawer/Panel */}
      {isOpen && (
        <div className="w-[400px] h-[600px] bg-slate-950/95 border border-slate-800/80 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-5 duration-200">
          {/* Header */}
          <div className="px-4 py-3 bg-slate-900 border-b border-slate-800/50 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-emerald-400" />
              <div>
                <h3 className="text-sm font-bold text-white font-sans">{symbol} AI {t("Assistant", "选股助手")}</h3>
                <p className="text-[10px] text-slate-500">{companyName}</p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Conversation History */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col justify-center items-center text-center p-4">
                <Sparkles className="w-10 h-10 text-emerald-400/50 mb-3" />
                <h4 className="text-sm font-semibold text-slate-300 mb-2">
                  {t("Ask GEMS AI Assistant", "向 GEMS AI 选股助手提问")}
                </h4>
                <p className="text-xs text-slate-500 max-w-[280px] leading-relaxed mb-6">
                  {t(
                    `Ask about ${symbol}'s historical valuations, competitive peers, revenue growth, or specific risks inside the GEMS database.`,
                    `您可以针对 ${symbol} 的历史估值、同业竞争、营收增长速度或研报涉及的具体风险进行提问与比对。`
                  )}
                </p>

                {/* Suggestions List */}
                <div className="w-full space-y-2">
                  {suggestions.map((s, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSend(s)}
                      className="w-full p-2.5 text-xs text-left text-teal-400 hover:text-teal-300 bg-teal-500/5 hover:bg-teal-500/10 border border-teal-500/20 hover:border-teal-500/40 rounded-xl transition-all font-medium leading-normal"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((m) => {
                  const isUser = m.role === "user";
                  return (
                    <div
                      key={m.id}
                      className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                    >
                      <div className="max-w-[85%] flex flex-col spacing-y-1">
                        {/* Role tag */}
                        <span className={`text-[9px] font-semibold text-slate-500 mb-1 ${isUser ? "text-right" : "text-left"}`}>
                          {isUser ? t("You", "您") : t("GEMS AI", "GEMS 助手")}
                        </span>

                        {/* Bubble */}
                        <div
                          className={`px-4 py-2.5 rounded-2xl text-sm ${
                            isUser
                              ? "bg-gradient-to-br from-blue-600 to-blue-700 text-white rounded-tr-none"
                              : "bg-slate-900 border border-slate-800/80 text-slate-200 rounded-tl-none"
                          }`}
                        >
                          {isUser ? (
                            <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
                          ) : (
                            <div className="prose prose-invert prose-xs text-slate-300">
                              {parseMarkdownToReact(m.content)}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {isLoading && messages[messages.length - 1]?.role === "user" && (
                  <div className="flex justify-start">
                    <div className="max-w-[85%]">
                      <span className="text-[9px] font-semibold text-slate-500 mb-1 block">
                        GEMS AI
                      </span>
                      <div className="px-4 py-3 bg-slate-900 border border-slate-800/80 rounded-2xl rounded-tl-none flex gap-1 items-center">
                        <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce delay-100" />
                        <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce delay-200" />
                        <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce delay-300" />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Error toast */}
          {errorMsg && (
            <div className="px-4 py-2 bg-red-950/80 border-t border-red-900/50 text-red-400 text-xs font-semibold flex justify-between items-center animate-in fade-in duration-200">
              <span className="truncate">{errorMsg}</span>
              <button onClick={() => setErrorMsg(null)} className="text-red-400 hover:text-white p-1 ml-2">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Input Area */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend(input);
            }}
            className="p-3 bg-slate-900/80 border-t border-slate-850 flex gap-2 items-center"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t(`Ask about ${symbol}...`, `向 AI 助理提问关于 ${symbol}...`)}
              disabled={isLoading}
              className="flex-1 bg-slate-950 border border-slate-800/50 focus:border-emerald-500/50 rounded-xl px-4 py-2 text-sm text-slate-200 outline-none transition-all disabled:opacity-50 placeholder:text-slate-600"
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="p-2 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-800 text-white disabled:text-slate-600 rounded-xl transition-all shadow-md shadow-emerald-500/10 disabled:shadow-none"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Simple regex-based Markdown parsing for conversational chat
// ============================================================

function parseMarkdownToReact(text: string): React.ReactNode[] {
  if (!text) return [];

  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];

  let inList = false;
  let listItems: React.ReactNode[] = [];

  let inTable = false;
  let tableRows: string[][] = [];

  const flushList = (key: string | number) => {
    if (listItems.length > 0) {
      elements.push(
        <ul key={`list-${key}`} className="list-disc pl-5 mb-2.5 space-y-1">
          {listItems}
        </ul>
      );
      listItems = [];
      inList = false;
    }
  };

  const flushTable = (key: string | number) => {
    if (tableRows.length > 0) {
      const headers = tableRows[0];
      const hasSeparator =
        tableRows.length > 1 &&
        tableRows[1].every((cell) => {
          const c = cell.trim();
          return c.startsWith(":") || c.startsWith("-") || c === "";
        });
      const rows = hasSeparator ? tableRows.slice(2) : tableRows.slice(1);

      elements.push(
        <div key={`table-${key}`} className="my-2 border border-slate-800 rounded-lg overflow-hidden max-w-full overflow-x-auto">
          <table className="min-w-full text-xs text-slate-300">
            <thead className="bg-slate-900 border-b border-slate-800 font-bold">
              <tr>
                {headers.map((h, idx) => (
                  <th key={idx} className="px-2 py-1.5 text-left border-r border-slate-800 last:border-r-0">
                    {parseInlineStyles(h)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rIdx) => (
                <tr key={rIdx} className="border-b border-slate-800 last:border-b-0 hover:bg-slate-800/10">
                  {row.map((cell, cIdx) => (
                    <td key={cIdx} className="px-2 py-1 border-r border-slate-800 last:border-r-0">
                      {parseInlineStyles(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      tableRows = [];
      inTable = false;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Table checking
    if (line.trim().startsWith("|") && line.trim().endsWith("|")) {
      flushList(i);
      inTable = true;
      const cells = line.split("|").slice(1, -1);
      tableRows.push(cells);
      continue;
    } else if (inTable) {
      flushTable(i);
    }

    // List item checking
    const listMatch = line.match(/^(\s*)[-*+]\s+(.*)/);
    if (listMatch) {
      inList = true;
      listItems.push(
        <li key={`li-${i}`} className="text-slate-300 text-xs leading-relaxed">
          {parseInlineStyles(listMatch[2])}
        </li>
      );
      continue;
    } else if (inList) {
      flushList(i);
    }

    // Header checking
    const headerMatch = line.match(/^(#{1,6})\s+(.*)/);
    if (headerMatch) {
      const level = headerMatch[1].length;
      const content = headerMatch[2];
      const headerClass =
        level === 1
          ? "text-base font-extrabold text-white mt-3 mb-1.5"
          : level === 2
          ? "text-sm font-bold text-white mt-2.5 mb-1.5"
          : "text-xs font-bold text-white mt-2 mb-1";
      elements.push(
        <div key={`h-${i}`} className={headerClass}>
          {parseInlineStyles(content)}
        </div>
      );
      continue;
    }

    // Empty lines
    if (!line.trim()) {
      elements.push(<div key={`empty-${i}`} className="h-1.5" />);
      continue;
    }

    // Standard paragraph
    elements.push(
      <p key={`p-${i}`} className="text-slate-300 text-xs leading-relaxed mb-1.5">
        {parseInlineStyles(line)}
      </p>
    );
  }

  flushList("end");
  flushTable("end");

  return elements;
}

function parseInlineStyles(text: string): React.ReactNode {
  const parts = text.split(/(\*\*.*?\*\*|`.*?`)/g);
  return parts.map((part, idx) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={idx} className="font-bold text-white">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code key={idx} className="bg-slate-800 text-teal-400 px-1.5 py-0.5 rounded font-mono text-[10px]">
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}
