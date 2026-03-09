"use client";

import React from "react";
import { Columns3, Lock } from "lucide-react";
import type { ConfigSnapshot } from "@/lib/types";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface MatrixConfigProps {
  config: ConfigSnapshot;
  onConfigChange: (config: ConfigSnapshot) => void;
  isFrozen: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function MatrixConfig({ config }: MatrixConfigProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full px-4 py-8">
      {/* Icon */}
      <div className="w-14 h-14 rounded-2xl bg-fordham-maroon/10 border border-fordham-maroon/20 flex items-center justify-center mb-4">
        <Columns3 size={24} className="text-fordham-maroon" />
      </div>

      {/* Title */}
      <h3 className="t-body font-semibold t-primary mb-1">Matrix Mode</h3>
      <p className="t-caption t-secondary text-center mb-6 max-w-[260px]">
        Compare configurations side-by-side to identify optimal parameter
        combinations.
      </p>

      {/* Grid preview hint */}
      <div className="w-full grid grid-cols-3 gap-2 mb-6">
        {["Config A", "Config B", "Config C"].map((label, i) => (
          <div
            key={i}
            className="rounded-lg border border-dashed border-[#c3d0e1] bg-[#f4f7fb] p-3 text-center"
          >
            <div className="w-6 h-6 rounded-full bg-[#d6dfeb] mx-auto mb-2 flex items-center justify-center">
              <span className="t-micro font-semibold t-secondary">
                {i + 1}
              </span>
            </div>
            <p className="t-micro font-medium t-secondary">{label}</p>
          </div>
        ))}
      </div>

      {/* Preview of current config */}
      <div className="w-full rounded-lg border border-[#d6dfeb] bg-white p-3 mb-4">
        <p className="t-micro font-semibold t-secondary uppercase tracking-wider mb-2">
          Current Config Preview
        </p>
        <div className="space-y-1">
          <PreviewRow label="Model" value={config.modelName} />
          <PreviewRow label="Temperature" value={config.temperature.toFixed(1)} />
          <PreviewRow label="Context" value={config.contextLevel} />
          <PreviewRow label="RAG" value={config.ragEnabled ? "On" : "Off"} />
          <PreviewRow
            label="History"
            value={`${config.historyDepth} turns`}
          />
        </div>
      </div>

      {/* Coming soon badge */}
      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200/80">
        <Lock size={11} className="text-amber-600" />
        <span className="t-micro font-semibold text-amber-700">
          Coming Soon
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function PreviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center py-0.5">
      <span className="t-micro t-tertiary">{label}</span>
      <span className="t-micro t-primary font-mono font-medium">{value}</span>
    </div>
  );
}
