"use client";
import React, { useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bot, Send, Loader2, AlertCircle, BookOpen } from "lucide-react";
import { Message } from "@/lib/types";

interface ChatInterfaceProps {
  messages: Message[];
  isLoading: boolean;
  onSendMessage: (content: string) => void;
  patientName: string | null;
  disabled: boolean;
}

export default function ChatInterface({
  messages,
  isLoading,
  onSendMessage,
  patientName,
  disabled,
}: ChatInterfaceProps) {
  const [input, setInput] = React.useState("");
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = messagesContainerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, isLoading]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || disabled || isLoading) return;
    onSendMessage(input.trim());
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!input.trim() || disabled || isLoading) return;
      onSendMessage(input.trim());
      setInput("");
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="h-12 border-b border-gray-800 flex items-center px-4 justify-between shrink-0 bg-gray-900/60">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-[#8C1515]/20 flex items-center justify-center border border-[#8C1515]/40">
            <Bot className="w-4 h-4 text-[#C49A6C]" />
          </div>
          <div>
            <p className="t-caption font-semibold t-primary">
              Gemini Clinical Assistant
            </p>
            {patientName && (
              <p className="t-micro t-secondary">
                Reviewing: {patientName}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[88%] flex flex-col gap-1 ${
                  msg.role === "user" ? "items-end" : "items-start"
                }`}
              >
                {/* Message bubble */}
                <div
                  className={`rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
                    msg.role === "user"
                      ? "bg-[#8C1515] text-white rounded-tr-sm"
                      : msg.isError
                      ? "bg-red-900/40 text-red-200 border border-red-700/50 rounded-tl-sm"
                      : "bg-gray-800 text-gray-100 border border-gray-700/60 rounded-tl-sm"
                  }`}
                >
                  {msg.isError && (
                    <div className="flex items-center gap-1.5 mb-1.5 text-red-400">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span className="t-caption font-semibold">API Error</span>
                    </div>
                  )}
                  <div
                    className="whitespace-pre-wrap break-words"
                    dangerouslySetInnerHTML={{
                      __html: msg.content
                        .replace(/&/g, "&amp;")
                        .replace(/</g, "&lt;")
                        .replace(/>/g, "&gt;")
                        .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
                        .replace(/\*(.*?)\*/g, "<em>$1</em>")
                        .replace(/\n/g, "<br />"),
                    }}
                  />
                </div>

                {/* Token/cost display */}
                {msg.role === "assistant" && msg.usage && (
                  <div className="flex items-center gap-2 px-1 t-micro t-mono t-tertiary">
                    <span>↑{msg.usage.inputTokens} ↓{msg.usage.outputTokens} tok</span>
                    <span>·</span>
                    <span>~${(msg.usage.estimatedCost || 0).toFixed(6)}</span>
                    {typeof msg.usage.modelLatencyMs === "number" && (
                      <>
                        <span>·</span>
                        <span>{(msg.usage.modelLatencyMs / 1000).toFixed(1)}s model</span>
                      </>
                    )}
                    {typeof msg.usage.totalLatencyMs === "number" && (
                      <>
                        <span>·</span>
                        <span>{(msg.usage.totalLatencyMs / 1000).toFixed(1)}s total</span>
                      </>
                    )}
                    {msg.usage.model && (
                      <>
                        <span>·</span>
                        <span>{msg.usage.model}</span>
                      </>
                    )}
                  </div>
                )}

                {/* RAG indicator */}
                {msg.role === "assistant" &&
                  msg.ragChunks &&
                  msg.ragChunks.length > 0 && (
                    <div className="flex items-center gap-1.5 px-1 t-micro t-tertiary">
                      <BookOpen className="w-3 h-3" />
                      <span>
                        {msg.ragChunks.length} guideline
                        {msg.ragChunks.length !== 1 ? "s" : ""} retrieved
                      </span>
                    </div>
                  )}

                {/* Error hint */}
                {msg.isError && msg.hint && (
                  <div className="px-1 t-caption text-yellow-600">
                    Hint: {msg.hint}
                  </div>
                )}
              </div>
            </motion.div>
          ))}

          {isLoading && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex justify-start"
            >
              <div className="bg-gray-800 border border-gray-700 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-2.5">
                <Loader2 className="w-4 h-4 animate-spin text-[#C49A6C]" />
                <span className="t-small t-secondary">
                  Analyzing chart...
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <div />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-gray-800 bg-gray-900/40 shrink-0">
        {disabled && (
          <p className="t-micro text-center t-tertiary mb-2">
            Select a patient to begin
          </p>
        )}
        <form onSubmit={handleSubmit} className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              disabled
                ? "Select a patient first..."
                : patientName
                ? `Ask about ${patientName}... (Enter to send)`
                : "Ask a clinical question..."
            }
            disabled={disabled || isLoading}
            rows={1}
            className="flex-1 bg-gray-950 border border-gray-700 t-body t-primary rounded-xl pl-4 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#8C1515]/60 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed placeholder-gray-600 resize-none shadow-inner"
            style={{ minHeight: "42px", maxHeight: "120px" }}
            onInput={(e) => {
              const el = e.currentTarget;
              el.style.height = "auto";
              el.style.height = Math.min(el.scrollHeight, 120) + "px";
            }}
          />
          <button
            type="submit"
            disabled={!input.trim() || disabled || isLoading}
            className="shrink-0 p-2.5 bg-[#8C1515] hover:bg-[#6B1010] transition-colors text-white rounded-xl disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
        <p className="text-center t-micro t-tertiary mt-2">
          AI can make mistakes. Always verify clinical information with
          authoritative sources.
        </p>
      </div>
    </div>
  );
}
