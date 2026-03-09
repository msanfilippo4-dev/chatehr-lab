"use client";

import React, { useState, useMemo } from "react";
import { Code2, Copy, Check, Lock } from "lucide-react";
import type { ConfigSnapshot } from "@/lib/types";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ExpertConfigProps {
  config: ConfigSnapshot;
  onConfigChange: (config: ConfigSnapshot) => void;
  isFrozen: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ExpertConfig({
  config,
  isFrozen,
}: ExpertConfigProps) {
  const [copied, setCopied] = useState(false);

  // Format the config as JSON, omitting identity/meta fields for clarity
  const jsonString = useMemo(() => {
    const {
      id: _id,
      teamId: _teamId,
      createdAt: _createdAt,
      createdBy: _createdBy,
      configHash: _configHash,
      ...displayConfig
    } = config;
    return JSON.stringify(displayConfig, null, 2);
  }, [config]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(jsonString);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement("textarea");
      textarea.value = jsonString;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header area */}
      <div className="flex flex-col items-center pt-6 pb-4 px-4">
        <div className="w-14 h-14 rounded-2xl bg-fordham-maroon/10 border border-fordham-maroon/20 flex items-center justify-center mb-4">
          <Code2 size={24} className="text-fordham-maroon" />
        </div>
        <h3 className="t-body font-semibold t-primary mb-1">Expert Mode</h3>
        <p className="t-caption t-secondary text-center max-w-[260px] mb-2">
          JSON editor with schema validation for advanced configuration.
        </p>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200/80 mb-4">
          <Lock size={11} className="text-amber-600" />
          <span className="t-micro font-semibold text-amber-700">
            Editing Coming Soon
          </span>
        </div>
      </div>

      {/* JSON display */}
      <div className="flex-1 mx-3 mb-3 flex flex-col overflow-hidden rounded-lg border border-[#d6dfeb]">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-[#d6dfeb] bg-[#f4f7fb]">
          <div className="flex items-center gap-1.5">
            <Code2 size={11} className="t-tertiary" />
            <span className="t-micro font-semibold t-secondary uppercase tracking-wider">
              config.json
            </span>
          </div>
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1 px-2 py-1 rounded-md hover:bg-white transition-colors t-micro t-secondary"
          >
            {copied ? (
              <>
                <Check size={11} className="text-green-600" />
                <span className="text-green-600 font-medium">Copied</span>
              </>
            ) : (
              <>
                <Copy size={11} />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>

        {/* JSON content */}
        <div className="flex-1 overflow-auto bg-[#0b1117] p-3">
          <pre className="text-[11px] leading-[1.6] font-mono text-[#e2e8f0] whitespace-pre select-all">
            {jsonString}
          </pre>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-3 py-1.5 border-t border-[#d6dfeb] bg-[#f4f7fb]">
          <span className="t-micro t-tertiary">
            {isFrozen ? "Frozen" : "Draft"} &middot; v{config.version}
          </span>
          <span className="t-micro t-tertiary font-mono">
            {jsonString.length} chars
          </span>
        </div>
      </div>
    </div>
  );
}
