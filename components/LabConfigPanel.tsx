"use client";
import React, { useState } from "react";
import { Settings, Info, ChevronDown, ChevronUp, Wand2 } from "lucide-react";
import { LabConfig } from "@/lib/types";
import ContextLevelBadge from "./ContextLevelBadge";

interface LabConfigPanelProps {
  config: LabConfig;
  onChange: (config: LabConfig) => void;
}

const DEFAULT_SYSTEM_INSTRUCTION = `You are a __________ clinical assistant working in a mock EHR system.
Only answer questions based on the patient EHR context provided below.
Do not use general medical knowledge that isn't grounded in the patient's chart.
If the information is not in the chart, say "I don't have that information in the current chart."
Always prioritize patient __________ in your responses.`;

export default function LabConfigPanel({ config, onChange }: LabConfigPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [showHint, setShowHint] = useState<string | null>(null);

  const update = (partial: Partial<LabConfig>) => {
    onChange({ ...config, ...partial });
  };

  return (
    <div className="ehr-shell overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-3 bg-[#f3f7fd] hover:bg-[#eaf0f8] transition-colors border-b border-[#d6dfeb]"
      >
        <div className="flex items-center gap-2">
          <Settings className="w-4 h-4 text-[#C49A6C]" />
          <span className="text-sm font-semibold text-gray-200">
            Lab Configuration
          </span>
          <span className="t-micro bg-gray-800 text-gray-300 px-1.5 py-0.5 rounded-full border border-gray-700/50">
            Fill in the blanks
          </span>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-gray-500" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-500" />
        )}
      </button>

      {isExpanded && (
        <div className="max-h-[70vh] overflow-y-auto overscroll-contain touch-pan-y [-webkit-overflow-scrolling:touch] p-4 space-y-5">
          {/* Step 1: Model Name */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="t-caption font-semibold text-gray-300 flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-[#233247] text-[#9fb5d0] text-xs flex items-center justify-center font-bold">
                  1
                </span>
                Model Name
              </label>
              <button
                onClick={() =>
                  setShowHint(showHint === "model" ? null : "model")
                }
                className="text-gray-600 hover:text-gray-400"
              >
                <Info className="w-3.5 h-3.5" />
              </button>
            </div>
            {showHint === "model" && (
              <div className="mb-2 p-2.5 bg-[#eef4fd] border border-[#bfcde0] rounded t-caption text-gray-300">
                The model ID tells Google&apos;s API which AI model to use. Try:{" "}
                <code className="font-mono bg-gray-950 px-1 rounded">
                  2.0
                </code>{" "}
                — wrong names cause API errors! That&apos;s a feature, not a bug.
              </div>
            )}
            <div className="flex items-center gap-1 bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 font-mono text-sm focus-within:ring-2 focus-within:ring-[#8C1515]/60 focus-within:border-transparent">
              <span className="text-gray-500">gemini-</span>
              <input
                type="text"
                value={config.modelSuffix}
                onChange={(e) => update({ modelSuffix: e.target.value })}
                placeholder="___"
                className="bg-transparent text-gray-200 w-12 focus:outline-none placeholder-gray-600 text-center"
                maxLength={10}
              />
              <span className="text-gray-500">-flash</span>
            </div>
            <p className="t-micro t-tertiary mt-1">
              Full model ID:{" "}
              <span className="font-mono text-gray-500">
                gemini-{config.modelSuffix || "___"}-flash
              </span>
            </p>
          </div>

          {/* Step 2: System Instruction */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="t-caption font-semibold text-gray-300 flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-[#3b1f23] text-[#d9a5ab] text-xs flex items-center justify-center font-bold">
                  2
                </span>
                System Instruction
              </label>
              <div className="flex items-center gap-2">
                <button
                  onClick={() =>
                    update({ systemInstruction: DEFAULT_SYSTEM_INSTRUCTION })
                  }
                  className="text-xs text-gray-400 hover:text-gray-300 flex items-center gap-0.5"
                >
                  <Wand2 className="w-3 h-3" /> Reset
                </button>
                <button
                  onClick={() =>
                    setShowHint(showHint === "system" ? null : "system")
                  }
                  className="text-gray-600 hover:text-gray-400"
                >
                  <Info className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            {showHint === "system" && (
              <div className="mb-2 p-2.5 bg-[#eef4fd] border border-[#bfcde0] rounded t-caption text-gray-300">
                Fill in the <span className="text-[#C49A6C]">__________</span>{" "}
                blanks. The system instruction defines the AI&apos;s role and rules.
                Try clearing it entirely — notice how the AI behaves without
                guardrails.
              </div>
            )}
            <textarea
              value={config.systemInstruction}
              onChange={(e) => update({ systemInstruction: e.target.value })}
              rows={5}
              placeholder={DEFAULT_SYSTEM_INSTRUCTION}
              className="w-full bg-gray-950 border border-gray-700 text-gray-200 text-xs rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-[#8C1515]/60 focus:border-transparent placeholder-gray-700 resize-none font-mono leading-relaxed"
            />
            <p className="t-micro t-tertiary mt-1">
              Replace the{" "}
              <span className="text-[#C49A6C] font-mono">__________</span> with
              your instructions
            </p>
          </div>

          {/* Step 3: Temperature */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="t-caption font-semibold text-gray-300 flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-[#3a3322] text-[#d4be8c] text-xs flex items-center justify-center font-bold">
                  3
                </span>
                Temperature:{" "}
                <span className="font-mono text-gray-200 ml-1">
                  {config.temperature.toFixed(1)}
                </span>
              </label>
              <button
                onClick={() =>
                  setShowHint(showHint === "temp" ? null : "temp")
                }
                className="text-gray-600 hover:text-gray-400"
              >
                <Info className="w-3.5 h-3.5" />
              </button>
            </div>
            {showHint === "temp" && (
              <div className="mb-2 p-2.5 bg-[#eef4fd] border border-[#bfcde0] rounded t-caption text-gray-300">
                Controls randomness. <strong>0.0</strong> = deterministic (same
                answer every time). <strong>1.0</strong> = creative/random. Ask
                the same question twice at temperature 1.0 and see what happens.
              </div>
            )}
            <div className="flex items-center gap-3">
              <span className="t-micro t-secondary">0.0</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={config.temperature}
                onChange={(e) =>
                  update({ temperature: parseFloat(e.target.value) })
                }
                className="flex-1 h-2 rounded-full appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, #8C1515 ${config.temperature * 100}%, #374151 ${config.temperature * 100}%)`,
                }}
              />
              <span className="t-micro t-secondary">1.0</span>
            </div>
            <div className="flex justify-between mt-1">
              <span className="t-micro t-tertiary">← Deterministic</span>
              <span className="t-micro t-tertiary">Creative →</span>
            </div>
          </div>

          {/* Step 4: Context Level */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="t-caption font-semibold text-gray-300 flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-[#1f3a39] text-[#9fcfcb] text-xs flex items-center justify-center font-bold">
                  4
                </span>
                Context Level (Privacy Experiment)
              </label>
              <button
                onClick={() =>
                  setShowHint(showHint === "context" ? null : "context")
                }
                className="text-gray-600 hover:text-gray-400"
              >
                <Info className="w-3.5 h-3.5" />
              </button>
            </div>
            {showHint === "context" && (
              <div className="mb-2 p-2.5 bg-[#eef4fd] border border-[#bfcde0] rounded t-caption text-gray-300">
                Controls how much patient data is sent to the AI. Think about
                HIPAA&apos;s &quot;minimum necessary&quot; standard — what does the AI
                actually need to answer your question?
              </div>
            )}
            <div className="space-y-2">
              {(["LIMITED", "STANDARD", "FULL"] as const).map((level) => (
                <label
                  key={level}
                  className={`flex items-start gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                    config.contextLevel === level
                      ? "border-[#8C1515]/60 bg-[#8C1515]/10"
                      : "border-[#d6dfeb] bg-[#f7f9fc] hover:bg-[#edf2f9] hover:border-[#bfcde0]"
                  }`}
                >
                  <input
                    type="radio"
                    name="contextLevel"
                    value={level}
                    checked={config.contextLevel === level}
                    onChange={() => update({ contextLevel: level })}
                    className="mt-0.5 accent-[#8C1515]"
                  />
                  <div>
                    <p className="t-caption font-semibold text-gray-200">
                      {level}
                    </p>
                    <p className="t-micro t-secondary mt-0.5">
                      {level === "LIMITED" &&
                        "Age + gender + zip prefix only. No name, no diagnoses."}
                      {level === "STANDARD" &&
                        "Name + conditions + labs + meds + allergies + immunizations."}
                      {level === "FULL" &&
                        "Everything + all visit notes (clinical narrative text)."}
                    </p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Step 5: RAG Toggle */}
          <div className="flex items-center justify-between p-3 rounded-lg border border-[#d6dfeb] bg-[#f7f9fc]">
            <div>
              <p className="t-caption font-semibold text-gray-300 flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-[#2d2540] text-[#b9a9dc] text-xs flex items-center justify-center font-bold">
                  5
                </span>
                Enable RAG (Clinical Guidelines)
              </p>
              <p className="t-micro t-secondary mt-0.5">
                Retrieve relevant guideline chunks to ground responses
              </p>
            </div>
            <button
              onClick={() => update({ ragEnabled: !config.ragEnabled })}
              className={`relative w-11 h-6 rounded-full transition-colors ${
                config.ragEnabled ? "bg-[#8C1515]" : "bg-[#c8d5e3]"
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform shadow-sm ${
                  config.ragEnabled ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          {/* Context badge */}
          <ContextLevelBadge level={config.contextLevel} />
        </div>
      )}
    </div>
  );
}
