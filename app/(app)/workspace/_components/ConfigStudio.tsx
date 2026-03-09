"use client";

import React, { useState } from "react";
import {
  Save,
  Lock,
  Unlock,
  Wand2,
  Columns3,
  Code2,
  Hash,
} from "lucide-react";
import type { ConfigSnapshot } from "@/lib/types";
import GuidedConfig from "./GuidedConfig";
import MatrixConfig from "./MatrixConfig";
import ExpertConfig from "./ExpertConfig";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ConfigStudioProps {
  config: ConfigSnapshot;
  onConfigChange: (config: ConfigSnapshot) => void;
  onSave: () => void;
  onFreeze: () => void;
  isFrozen: boolean;
}

// ---------------------------------------------------------------------------
// Mode tabs
// ---------------------------------------------------------------------------

type StudioMode = "guided" | "matrix" | "expert";

const MODE_TABS: { id: StudioMode; label: string; icon: React.ElementType }[] = [
  { id: "guided", label: "Guided", icon: Wand2 },
  { id: "matrix", label: "Matrix", icon: Columns3 },
  { id: "expert", label: "Expert", icon: Code2 },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ConfigStudio({
  config,
  onConfigChange,
  onSave,
  onFreeze,
  isFrozen,
}: ConfigStudioProps) {
  const [mode, setMode] = useState<StudioMode>("guided");

  return (
    <div className="flex flex-col h-full">
      {/* ── Top bar: config name + version ─────────────────────────────── */}
      <div className="px-3 py-2.5 border-b border-[#d6dfeb] bg-[#f8fbff] shrink-0">
        <div className="flex items-center gap-2 mb-2">
          {/* Config name input */}
          <input
            type="text"
            value={config.name || ""}
            onChange={(e) =>
              onConfigChange({ ...config, name: e.target.value })
            }
            disabled={isFrozen}
            placeholder="Untitled Config"
            className="flex-1 bg-transparent border-b border-transparent hover:border-[#d6dfeb] focus:border-fordham-maroon t-body font-semibold t-primary placeholder:t-tertiary focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed transition-colors truncate"
          />
          {/* Version badge */}
          <span className="shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#f4f7fb] border border-[#d6dfeb]">
            <Hash size={10} className="t-tertiary" />
            <span className="t-micro font-mono t-secondary font-medium">
              v{config.version}
            </span>
          </span>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onSave}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-fordham-maroon hover:bg-fordham-dark text-white t-caption font-semibold transition-colors shadow-sm"
          >
            <Save size={12} />
            Save
          </button>
          <button
            type="button"
            onClick={onFreeze}
            disabled={isFrozen}
            className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg t-caption font-semibold transition-colors shadow-sm ${
              isFrozen
                ? "bg-amber-50 border border-amber-200 text-amber-700 cursor-not-allowed"
                : "bg-white border border-[#d6dfeb] t-secondary hover:border-fordham-maroon hover:text-fordham-maroon"
            }`}
          >
            {isFrozen ? (
              <>
                <Lock size={12} />
                Frozen
              </>
            ) : (
              <>
                <Unlock size={12} />
                Freeze
              </>
            )}
          </button>
        </div>
      </div>

      {/* ── Mode switcher tabs ─────────────────────────────────────────── */}
      <div className="flex border-b border-[#d6dfeb] bg-[#f8fbff] shrink-0">
        {MODE_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = mode === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setMode(tab.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 t-micro font-semibold transition-colors border-b-2 ${
                isActive
                  ? "border-fordham-maroon text-fordham-maroon bg-white/60"
                  : "border-transparent t-secondary hover:text-fordham-maroon/70 hover:bg-white/40"
              }`}
            >
              <Icon size={12} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── Frozen banner ──────────────────────────────────────────────── */}
      {isFrozen && (
        <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border-b border-amber-200/80 shrink-0">
          <Lock size={12} className="text-amber-600 shrink-0" />
          <p className="t-micro text-amber-700 font-medium">
            This configuration is frozen and cannot be modified. Duplicate it to
            make changes.
          </p>
        </div>
      )}

      {/* ── Mode content ───────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        {mode === "guided" && (
          <div className="p-3">
            <GuidedConfig
              config={config}
              onConfigChange={onConfigChange}
              isFrozen={isFrozen}
            />
          </div>
        )}
        {mode === "matrix" && (
          <MatrixConfig
            config={config}
            onConfigChange={onConfigChange}
            isFrozen={isFrozen}
          />
        )}
        {mode === "expert" && (
          <ExpertConfig
            config={config}
            onConfigChange={onConfigChange}
            isFrozen={isFrozen}
          />
        )}
      </div>
    </div>
  );
}
