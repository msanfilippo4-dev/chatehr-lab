"use client";
import React, { useState } from "react";
import { BookOpen, ChevronDown, ChevronRight, Database, Zap } from "lucide-react";
import { RAGChunk } from "@/lib/types";

interface RAGPanelProps {
  chunks: RAGChunk[];
  isLoading: boolean;
  ragEnabled: boolean;
}

export default function RAGPanel({ chunks, isLoading, ragEnabled }: RAGPanelProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (!ragEnabled) {
    return (
      <div className="ehr-shell p-4 text-center">
        <Database className="w-6 h-6 text-gray-600 mx-auto mb-2" />
        <p className="text-xs text-gray-500">RAG disabled</p>
        <p className="text-xs text-gray-600 mt-1">
          Enable in Lab Configuration to retrieve clinical guidelines
        </p>
      </div>
    );
  }

  return (
    <div className="ehr-shell overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 bg-[#f3f7fd] border-b border-[#d6dfeb]">
        <Zap className="w-4 h-4 text-[#C49A6C]" />
        <h3 className="text-xs font-semibold text-gray-200">
          Clinical Guideline Retrieval
        </h3>
        {isLoading && (
          <div className="ml-auto w-3.5 h-3.5 border-2 border-gray-600 border-t-gray-300 rounded-full animate-spin" />
        )}
        {!isLoading && chunks.length > 0 && (
          <span className="ml-auto text-xs bg-gray-800 text-gray-300 px-1.5 py-0.5 rounded-full border border-gray-700/60">
            {chunks.length} retrieved
          </span>
        )}
      </div>

      <div className="p-3">
        {!isLoading && chunks.length === 0 && (
          <div className="text-center py-4">
            <BookOpen className="w-5 h-5 text-gray-600 mx-auto mb-1.5" />
            <p className="text-xs text-gray-500">No guidelines retrieved yet</p>
            <p className="text-xs text-gray-600 mt-1">
              Ask a clinical question to trigger retrieval
            </p>
          </div>
        )}

        <div className="space-y-2">
          {chunks.map((chunk, i) => {
            const chunkKey = chunk.id || String(i);
            const isExpanded = expandedId === chunkKey;
            return (
              <div
                key={chunkKey}
                className="border border-gray-700/60 rounded-lg overflow-hidden bg-gray-800/30"
              >
                <button
                  onClick={() => setExpandedId(isExpanded ? null : chunkKey)}
                  className="w-full flex items-center justify-between p-2.5 text-left hover:bg-gray-800/60 transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-5 h-5 rounded bg-[#8C1515]/20 text-[#C49A6C] text-xs flex items-center justify-center font-bold shrink-0 border border-[#8C1515]/30">
                      {i + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-gray-200 truncate">
                        {chunk.title}
                      </p>
                      <p className="text-xs text-gray-400">{chunk.source}</p>
                    </div>
                  </div>
                  {isExpanded ? (
                    <ChevronDown className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                  )}
                </button>

                {isExpanded && (
                  <div className="px-3 pb-3 border-t border-gray-700/40">
                    <p className="text-xs text-gray-300 leading-relaxed mt-2 whitespace-pre-wrap">
                      {chunk.text}
                    </p>
                    {chunk.keywords && chunk.keywords.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2.5">
                        {chunk.keywords.slice(0, 8).map((kw, ki) => (
                          <span
                            key={ki}
                            className="text-xs bg-gray-700/60 text-gray-400 px-1.5 py-0.5 rounded"
                          >
                            {kw}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {chunks.length > 0 && (
          <p className="text-xs text-gray-600 text-center mt-3">
            Retrieved via keyword scoring · 30+ clinical guideline chunks indexed
          </p>
        )}
      </div>
    </div>
  );
}
