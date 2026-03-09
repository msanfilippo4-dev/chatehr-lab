"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bot,
  Send,
  AlertCircle,
  BookOpen,
  MessageSquare,
} from "lucide-react";
import type { Message } from "@/lib/types";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ChatInterfaceProps {
  messages: Message[];
  onSendMessage: (content: string) => void;
  isLoading: boolean;
  patientName?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ChatInterface({
  messages,
  onSendMessage,
  isLoading,
  patientName,
}: ChatInterfaceProps) {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ── Auto-scroll to latest message ────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // ── Auto-resize textarea ─────────────────────────────────────────────
  const resizeTextarea = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 140) + "px";
  }, []);

  useEffect(() => {
    resizeTextarea();
  }, [input, resizeTextarea]);

  // ── Send message ─────────────────────────────────────────────────────
  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;
    onSendMessage(trimmed);
    setInput("");
    // Reset textarea height after clearing
    requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSend();
  };

  return (
    <div className="flex flex-col h-full">
      {/* ── Header ───────────────────────────────────────────────────── */}
      <div className="h-12 border-b border-[#d6dfeb] flex items-center px-4 justify-between shrink-0 bg-[#f8fbff]">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-fordham-maroon/10 flex items-center justify-center border border-fordham-maroon/30">
            <Bot className="w-4 h-4 text-fordham-maroon" />
          </div>
          <div>
            <p className="t-caption font-semibold t-primary">
              Clinical Assistant
            </p>
            {patientName && (
              <p className="t-micro t-secondary">
                Reviewing: {patientName}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── Message list ─────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Empty state */}
        {messages.length === 0 && !isLoading && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center mb-3">
              <MessageSquare className="w-6 h-6 text-gray-400" />
            </div>
            <p className="t-small t-secondary font-medium">
              Start a conversation about this patient
            </p>
            <p className="t-caption t-tertiary mt-1 max-w-xs">
              Ask clinical questions, request summaries, or explore the patient
              record with AI assistance.
            </p>
          </div>
        )}

        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className={`flex ${
                msg.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-[88%] flex flex-col gap-1 ${
                  msg.role === "user" ? "items-end" : "items-start"
                }`}
              >
                {/* Message bubble */}
                <div
                  className={`rounded-2xl px-4 py-3 t-small leading-relaxed shadow-sm ${
                    msg.role === "user"
                      ? "bg-fordham-maroon/10 text-fordham-maroon border border-fordham-maroon/20 rounded-tr-sm"
                      : msg.isError
                      ? "bg-red-50 text-red-800 border border-red-300/60 rounded-tl-sm"
                      : "bg-white text-[#122033] border border-[#d6dfeb] rounded-tl-sm"
                  }`}
                >
                  {/* Error header */}
                  {msg.isError && (
                    <div className="flex items-center gap-1.5 mb-1.5 text-red-600">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span className="t-caption font-semibold">
                        API Error
                      </span>
                    </div>
                  )}

                  {/* Message content with basic markdown rendering */}
                  <div
                    className="whitespace-pre-wrap break-words"
                    dangerouslySetInnerHTML={{
                      __html: renderMarkdown(msg.content),
                    }}
                  />
                </div>

                {/* Usage metadata footer */}
                {msg.role === "assistant" && msg.usage && (
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 px-1 t-micro t-mono t-tertiary">
                    <span>
                      {msg.usage.inputTokens.toLocaleString()} in /{" "}
                      {msg.usage.outputTokens.toLocaleString()} out
                    </span>
                    <span className="t-tertiary">&middot;</span>
                    <span>
                      ~${(msg.usage.estimatedCost || 0).toFixed(6)}
                    </span>
                    {typeof msg.usage.modelLatencyMs === "number" && (
                      <>
                        <span className="t-tertiary">&middot;</span>
                        <span>
                          {(msg.usage.modelLatencyMs / 1000).toFixed(1)}s model
                        </span>
                      </>
                    )}
                    {typeof msg.usage.totalLatencyMs === "number" && (
                      <>
                        <span className="t-tertiary">&middot;</span>
                        <span>
                          {(msg.usage.totalLatencyMs / 1000).toFixed(1)}s total
                        </span>
                      </>
                    )}
                    {msg.usage.model && (
                      <>
                        <span className="t-tertiary">&middot;</span>
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
                  <div className="px-2 py-1 t-caption text-amber-700 bg-amber-50 rounded-md border border-amber-200/60 mt-0.5">
                    <span className="font-semibold">Hint:</span> {msg.hint}
                  </div>
                )}
              </div>
            </motion.div>
          ))}

          {/* Loading indicator */}
          {isLoading && (
            <motion.div
              key="loading-indicator"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex justify-start"
            >
              <div className="bg-white border border-[#d6dfeb] rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-2.5 shadow-sm">
                <LoadingDots />
                <span className="t-small t-secondary">
                  Analyzing chart...
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Scroll anchor */}
        <div ref={messagesEndRef} />
      </div>

      {/* ── Input area ───────────────────────────────────────────────── */}
      <div className="p-3 border-t border-[#d6dfeb] bg-[#f8fbff] shrink-0">
        <form onSubmit={handleSubmit} className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              patientName
                ? `Ask about ${patientName}... (Enter to send, Shift+Enter for newline)`
                : "Ask a clinical question..."
            }
            disabled={isLoading}
            rows={1}
            className="flex-1 bg-white border border-[#d6dfeb] t-body t-primary rounded-xl pl-4 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-fordham-maroon/40 focus:border-fordham-maroon/60 disabled:opacity-50 disabled:cursor-not-allowed placeholder:t-tertiary resize-none shadow-inner transition-colors"
            style={{ minHeight: "42px", maxHeight: "140px" }}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="shrink-0 p-2.5 bg-fordham-maroon hover:bg-fordham-dark transition-colors text-white rounded-xl disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
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

// ---------------------------------------------------------------------------
// Loading dots animation
// ---------------------------------------------------------------------------

function LoadingDots() {
  return (
    <div className="flex items-center gap-1">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-fordham-maroon/60"
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{
            duration: 1.2,
            repeat: Infinity,
            delay: i * 0.2,
          }}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Simple markdown renderer (bold, italic, line breaks)
// ---------------------------------------------------------------------------

function renderMarkdown(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/\n/g, "<br />");
}
