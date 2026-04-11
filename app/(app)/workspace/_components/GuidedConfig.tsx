"use client";

import React from "react";
import {
  Cpu,
  Sliders,
  MessageSquare,
  Database,
  BookOpen,
  MessageCircle,
  Shield,
  DollarSign,
  Info,
  Sparkles,
} from "lucide-react";
import type { ConfigSnapshot, ContextLevel, SectionToggles } from "@/lib/types";
import {
  MODEL_REGISTRY,
  CORE_MODEL_IDS,
  ADVANCED_MODEL_IDS,
  CONTEXT_LEVELS,
  STYLE_PROFILES,
  RESPONSE_FORMATS,
  TEACHING_PRESETS,
  KNOWN_RETIRED_MODEL_IDS,
} from "@/lib/constants";
import ConfigSection from "./ConfigSection";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface GuidedConfigProps {
  config: ConfigSnapshot;
  onConfigChange: (config: ConfigSnapshot) => void;
  isFrozen: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Update a single config field. */
function patch(
  config: ConfigSnapshot,
  onConfigChange: (c: ConfigSnapshot) => void,
  field: keyof ConfigSnapshot,
  value: unknown,
) {
  onConfigChange({ ...config, [field]: value });
}

/** Update a nested section toggle. */
function patchToggle(
  config: ConfigSnapshot,
  onConfigChange: (c: ConfigSnapshot) => void,
  key: keyof SectionToggles,
  value: boolean,
) {
  onConfigChange({
    ...config,
    sectionToggles: { ...config.sectionToggles, [key]: value },
  });
}

// ---------------------------------------------------------------------------
// Shared sub-components for controls
// ---------------------------------------------------------------------------

/** Label + optional tooltip. */
function FieldLabel({
  label,
  help,
}: {
  label: string;
  help?: string;
}) {
  return (
    <div className="flex items-center gap-1.5 mb-1">
      <span className="t-caption font-semibold t-primary">{label}</span>
      {help && (
        <span className="group relative cursor-help">
          <Info size={11} className="t-tertiary" />
          <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-full mb-1.5 w-48 rounded-md bg-[#122033] text-white t-micro px-2.5 py-1.5 opacity-0 group-hover:opacity-100 transition-opacity z-50 shadow-lg text-center leading-snug">
            {help}
          </span>
        </span>
      )}
    </div>
  );
}

/** Segmented control with fixed options. */
function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  disabled,
  labels,
}: {
  value: T;
  options: T[];
  onChange: (v: T) => void;
  disabled?: boolean;
  labels?: Record<string, string>;
}) {
  return (
    <div className="flex rounded-lg border border-[#d6dfeb] overflow-hidden bg-white">
      {options.map((opt, i) => {
        const isActive = value === opt;
        const displayLabel = labels?.[String(opt)] ?? String(opt);
        return (
          <button
            key={i}
            type="button"
            disabled={disabled}
            onClick={() => onChange(opt)}
            className={`flex-1 px-2 py-1.5 t-micro font-medium transition-colors border-r border-[#d6dfeb] last:border-r-0 ${
              isActive
                ? "bg-fordham-maroon text-white"
                : "t-secondary hover:bg-[#f4f7fb]"
            } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
          >
            {displayLabel}
          </button>
        );
      })}
    </div>
  );
}

/** Slider with value display and optional color gradient. */
function SliderControl({
  value,
  min,
  max,
  step,
  onChange,
  disabled,
  gradient,
  formatValue,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  disabled?: boolean;
  gradient?: string;
  formatValue?: (v: number) => string;
}) {
  const display = formatValue ? formatValue(value) : value.toFixed(step < 1 ? (step < 0.1 ? 2 : 1) : 0);
  const pct = ((value - min) / (max - min)) * 100;

  return (
    <div className="flex items-center gap-2.5">
      <div className="relative flex-1">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          disabled={disabled}
          className="w-full h-1.5 rounded-full appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            background: gradient
              ? `linear-gradient(to right, ${gradient})`
              : `linear-gradient(to right, #8C1515 0%, #8C1515 ${pct}%, #d6dfeb ${pct}%, #d6dfeb 100%)`,
          }}
        />
      </div>
      <span className="w-10 text-right font-mono t-micro t-maroon font-semibold shrink-0">
        {display}
      </span>
    </div>
  );
}

/** Toggle switch. */
function Toggle({
  checked,
  onChange,
  disabled,
  label,
  description,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  label?: string;
  description?: string;
}) {
  return (
    <label
      className={`flex items-start gap-2.5 ${
        disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
      }`}
    >
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative shrink-0 w-8 h-[18px] rounded-full transition-colors mt-0.5 ${
          checked ? "bg-fordham-maroon" : "bg-[#c3d0e1]"
        } ${disabled ? "cursor-not-allowed" : "cursor-pointer"}`}
      >
        <span
          className={`absolute top-[2px] left-[2px] w-[14px] h-[14px] rounded-full bg-white shadow-sm transition-transform ${
            checked ? "translate-x-[14px]" : "translate-x-0"
          }`}
        />
      </button>
      {(label || description) && (
        <div className="flex-1 min-w-0">
          {label && (
            <span className="t-caption t-primary font-medium block">
              {label}
            </span>
          )}
          {description && (
            <span className="t-micro t-tertiary block mt-0.5 leading-snug">
              {description}
            </span>
          )}
        </div>
      )}
    </label>
  );
}

/** Radio card for selecting an option. */
function RadioCard({
  selected,
  onClick,
  disabled,
  title,
  description,
  icon,
}: {
  selected: boolean;
  onClick: () => void;
  disabled?: boolean;
  title: string;
  description?: string;
  icon?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`w-full text-left rounded-lg border p-2.5 transition-all ${
        selected
          ? "border-fordham-maroon bg-fordham-maroon/5 ring-1 ring-fordham-maroon/30"
          : "border-[#d6dfeb] bg-white hover:border-fordham-maroon/40 hover:bg-[#f4f7fb]"
      } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
    >
      <div className="flex items-start gap-2">
        {/* Selection indicator */}
        <div
          className={`w-3.5 h-3.5 rounded-full border-2 mt-0.5 shrink-0 flex items-center justify-center transition-colors ${
            selected
              ? "border-fordham-maroon"
              : "border-[#c3d0e1]"
          }`}
        >
          {selected && (
            <div className="w-1.5 h-1.5 rounded-full bg-fordham-maroon" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            {icon}
            <span className="t-caption font-semibold t-primary">{title}</span>
          </div>
          {description && (
            <p className="t-micro t-tertiary mt-0.5 leading-snug">
              {description}
            </p>
          )}
        </div>
      </div>
    </button>
  );
}

/** Checkbox control. */
function Checkbox({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <label
      className={`flex items-center gap-2 ${
        disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        className="w-3.5 h-3.5 rounded border-[#c3d0e1] text-fordham-maroon focus:ring-fordham-maroon/40 accent-fordham-maroon"
      />
      <span className="t-caption t-primary">{label}</span>
    </label>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function GuidedConfig({
  config,
  onConfigChange,
  isFrozen,
}: GuidedConfigProps) {
  const d = isFrozen; // shorthand for disabled

  const applyPreset = (presetId: string) => {
    const preset = TEACHING_PRESETS.find((item) => item.id === presetId);
    if (!preset) return;

    onConfigChange({
      ...config,
      ...preset.config,
      presetId: preset.id,
      modelProvider: preset.config.modelProvider ?? config.modelProvider,
      sectionToggles: preset.config.sectionToggles
        ? { ...config.sectionToggles, ...preset.config.sectionToggles }
        : config.sectionToggles,
    });
  };

  // Filter models by selected provider
  const providerModels = Object.entries(MODEL_REGISTRY).filter(
    ([modelId, entry]) =>
      entry.provider === config.modelProvider &&
      !KNOWN_RETIRED_MODEL_IDS.has(modelId)
  );
  const coreProviderModels = providerModels.filter(([modelId]) =>
    CORE_MODEL_IDS.includes(modelId)
  );
  const advancedProviderModels = providerModels.filter(([modelId]) =>
    ADVANCED_MODEL_IDS.includes(modelId)
  );

  // All models for fallback (any provider)
  const allModels = Object.entries(MODEL_REGISTRY).filter(
    ([modelId]) => !KNOWN_RETIRED_MODEL_IDS.has(modelId)
  );

  return (
    <div className="space-y-2">
      {/* ================================================================= */}
      {/* Section 1: Model & Infrastructure                                 */}
      {/* ================================================================= */}
      <ConfigSection title="Model & Infrastructure" icon={Cpu} defaultOpen>
        <div>
          <FieldLabel
            label="Teaching Presets"
            help="One-click starter presets designed to make the major tradeoffs easier to compare."
          />
          <div className="grid gap-2">
            {TEACHING_PRESETS.map((preset) => {
              const isActive = config.presetId === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  disabled={d}
                  onClick={() => applyPreset(preset.id)}
                  className={`rounded-xl border p-3 text-left transition-colors ${
                    isActive
                      ? "border-fordham-maroon bg-fordham-maroon/5"
                      : "border-[#d6dfeb] bg-white hover:bg-[#f8fbff]"
                  } ${d ? "cursor-not-allowed opacity-50" : ""}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="t-caption font-semibold t-primary">
                        {preset.title}
                      </p>
                      <p className="mt-1 t-micro t-tertiary">
                        {preset.summary}
                      </p>
                    </div>
                    {isActive && (
                      <span className="rounded-full bg-fordham-maroon px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-white">
                        Current
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Model Provider */}
        <div>
          <FieldLabel label="Model Provider" />
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={d}
              onClick={() => {
                // Switch provider and auto-select first model of that provider
                const firstGemini = Object.keys(MODEL_REGISTRY).find(
                  (k) =>
                    MODEL_REGISTRY[k].provider === "gemini" &&
                    !KNOWN_RETIRED_MODEL_IDS.has(k)
                );
                onConfigChange({
                  ...config,
                  presetId: null,
                  modelProvider: "gemini",
                  modelName: firstGemini || config.modelName,
                });
              }}
              className={`flex flex-col items-center gap-1.5 rounded-lg border p-3 transition-all ${
                config.modelProvider === "gemini"
                  ? "border-fordham-maroon bg-fordham-maroon/5 ring-1 ring-fordham-maroon/30"
                  : "border-[#d6dfeb] bg-white hover:border-fordham-maroon/40"
              } ${d ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
            >
              <Sparkles
                size={18}
                className={
                  config.modelProvider === "gemini"
                    ? "text-fordham-maroon"
                    : "t-secondary"
                }
              />
              <span className="t-caption font-semibold t-primary">Gemini</span>
              <span className="t-micro t-tertiary">Google AI</span>
            </button>

            <button
              type="button"
              disabled={d}
              onClick={() => {
                const firstOpenRouter = Object.keys(MODEL_REGISTRY).find(
                  (k) =>
                    MODEL_REGISTRY[k].provider === "openrouter" &&
                    !KNOWN_RETIRED_MODEL_IDS.has(k)
                );
                onConfigChange({
                  ...config,
                  presetId: null,
                  modelProvider: "openrouter",
                  modelName: firstOpenRouter || config.modelName,
                });
              }}
              className={`flex flex-col items-center gap-1.5 rounded-lg border p-3 transition-all ${
                config.modelProvider === "openrouter"
                  ? "border-fordham-maroon bg-fordham-maroon/5 ring-1 ring-fordham-maroon/30"
                  : "border-[#d6dfeb] bg-white hover:border-fordham-maroon/40"
              } ${d ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
            >
              <Cpu
                size={18}
                className={
                  config.modelProvider === "openrouter"
                    ? "text-fordham-maroon"
                    : "t-secondary"
                }
              />
              <span className="t-caption font-semibold t-primary">OpenRouter</span>
              <span className="t-micro t-tertiary">Open-weight models</span>
            </button>
          </div>
        </div>

        {/* Model Variant */}
        <div>
          <FieldLabel
            label="Model Variant"
            help="Select the specific model within the chosen provider."
          />
          <select
            value={config.modelName}
            onChange={(e) =>
              onConfigChange({
                ...config,
                presetId: null,
                modelName: e.target.value,
              })
            }
            disabled={d}
            className="w-full border border-[#d6dfeb] rounded-lg px-3 py-1.5 t-caption t-primary bg-white focus:outline-none focus:ring-2 focus:ring-fordham-maroon/40 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {coreProviderModels.length > 0 && (
              <optgroup label="Core Course Models">
                {coreProviderModels.map(([key, entry]) => (
                  <option key={key} value={key}>
                    {entry.displayName}
                  </option>
                ))}
              </optgroup>
            )}
            {advancedProviderModels.length > 0 && (
              <optgroup label="Advanced Comparison Models">
                {advancedProviderModels.map(([key, entry]) => (
                  <option key={key} value={key}>
                    {entry.displayName}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
          {MODEL_REGISTRY[config.modelName] && (
            <p className="mt-1.5 t-micro t-tertiary">
              {MODEL_REGISTRY[config.modelName].recommendedFor}
            </p>
          )}
        </div>

        {/* Fallback Model */}
        <div>
          <FieldLabel
            label="Fallback Model"
            help="Optional model to use if the primary model fails or times out."
          />
          <select
            value={config.fallbackModel}
            onChange={(e) =>
              patch(config, onConfigChange, "fallbackModel", e.target.value)
            }
            disabled={d}
            className="w-full border border-[#d6dfeb] rounded-lg px-3 py-1.5 t-caption t-primary bg-white focus:outline-none focus:ring-2 focus:ring-fordham-maroon/40 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <option value="">None</option>
            {allModels
              .filter(([key]) => key !== config.modelName)
              .map(([key, entry]) => (
                <option key={key} value={key}>
                  {entry.displayName} ({entry.provider})
                </option>
              ))}
          </select>
        </div>

        {/* Max Output Tokens */}
        <div>
          <FieldLabel
            label="Max Output Tokens"
            help="Maximum number of tokens the model can generate in a single response."
          />
          <Segmented
            value={config.maxOutputTokens}
            options={[256, 512, 1024, 2048]}
            onChange={(v) => patch(config, onConfigChange, "maxOutputTokens", v)}
            disabled={d}
          />
        </div>

        {/* Request Timeout */}
        <div>
          <FieldLabel
            label="Request Timeout"
            help="How long to wait for a model response before timing out."
          />
          <Segmented
            value={config.requestTimeoutMs}
            options={[15000, 30000, 60000]}
            onChange={(v) =>
              patch(config, onConfigChange, "requestTimeoutMs", v)
            }
            disabled={d}
            labels={{
              "15000": "15s",
              "30000": "30s",
              "60000": "60s",
            }}
          />
        </div>

        {/* Retries */}
        <div>
          <FieldLabel
            label="Retries"
            help="Number of retry attempts on API failure."
          />
          <Segmented
            value={config.retries}
            options={[0, 1, 2]}
            onChange={(v) => patch(config, onConfigChange, "retries", v)}
            disabled={d}
          />
        </div>
      </ConfigSection>

      {/* ================================================================= */}
      {/* Section 2: Sampling                                               */}
      {/* ================================================================= */}
      <ConfigSection title="Sampling" icon={Sliders}>
        {/* Temperature */}
        <div>
          <FieldLabel
            label="Temperature"
            help="Controls randomness. Lower values produce more focused, deterministic responses."
          />
          <SliderControl
            value={config.temperature}
            min={0}
            max={2}
            step={0.1}
            onChange={(v) => patch(config, onConfigChange, "temperature", v)}
            disabled={d}
            gradient="#3b82f6 0%, #f59e0b 50%, #ef4444 100%"
          />
          <div className="flex justify-between t-micro t-tertiary mt-0.5">
            <span>Precise</span>
            <span>Balanced</span>
            <span>Creative</span>
          </div>
        </div>

        {/* Top-P */}
        <div>
          <FieldLabel
            label="Top-P (Nucleus Sampling)"
            help="Considers tokens with cumulative probability up to this value. Lower narrows the sampling."
          />
          <SliderControl
            value={config.topP}
            min={0}
            max={1}
            step={0.05}
            onChange={(v) => patch(config, onConfigChange, "topP", v)}
            disabled={d}
          />
        </div>

        {/* Top-K (Gemini only) */}
        {config.modelProvider === "gemini" && (
          <div>
            <FieldLabel
              label="Top-K"
              help="Limits sampling to the top K most probable tokens. Gemini-specific parameter."
            />
            <div className="flex items-center gap-2.5">
              <input
                type="number"
                min={1}
                max={100}
                value={config.topK}
                onChange={(e) =>
                  patch(
                    config,
                    onConfigChange,
                    "topK",
                    Math.max(1, Math.min(100, parseInt(e.target.value) || 1))
                  )
                }
                disabled={d}
                className="w-20 border border-[#d6dfeb] rounded-lg px-2.5 py-1.5 t-caption t-primary font-mono bg-white text-center focus:outline-none focus:ring-2 focus:ring-fordham-maroon/40 disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <span className="t-micro t-tertiary">1 - 100</span>
            </div>
          </div>
        )}

        {/* Frequency Penalty */}
        <div>
          <FieldLabel
            label="Frequency Penalty"
            help="Penalizes tokens proportional to how often they have appeared. Reduces repetition."
          />
          <SliderControl
            value={config.frequencyPenalty}
            min={0}
            max={2}
            step={0.1}
            onChange={(v) =>
              patch(config, onConfigChange, "frequencyPenalty", v)
            }
            disabled={d}
          />
        </div>

        {/* Presence Penalty */}
        <div>
          <FieldLabel
            label="Presence Penalty"
            help="Penalizes tokens that have appeared at all. Encourages topic diversity."
          />
          <SliderControl
            value={config.presencePenalty}
            min={0}
            max={2}
            step={0.1}
            onChange={(v) =>
              patch(config, onConfigChange, "presencePenalty", v)
            }
            disabled={d}
          />
        </div>
      </ConfigSection>

      {/* ================================================================= */}
      {/* Section 3: Prompting                                              */}
      {/* ================================================================= */}
      <ConfigSection title="Prompting" icon={MessageSquare}>
        {/* System Instruction */}
        <div>
          <FieldLabel
            label="System Instruction"
            help="The system prompt that defines the model's role and behavior."
          />
          <textarea
            value={config.systemInstruction}
            onChange={(e) =>
              patch(config, onConfigChange, "systemInstruction", e.target.value)
            }
            disabled={d}
            rows={5}
            placeholder="You are a _______ assistant. Your role is to _______. When answering, always _______. If you are unsure, _______."
            className="w-full border border-[#d6dfeb] rounded-lg px-3 py-2 t-caption t-primary bg-white focus:outline-none focus:ring-2 focus:ring-fordham-maroon/40 disabled:opacity-50 disabled:cursor-not-allowed resize-none placeholder:t-tertiary"
          />
          <p className="t-micro t-tertiary mt-0.5">
            {config.systemInstruction.length} characters
          </p>
        </div>

        {/* Style Profile */}
        <div>
          <FieldLabel label="Style Profile" />
          <div className="space-y-1.5">
            {Object.entries(STYLE_PROFILES).map(([key, prof]) => (
              <RadioCard
                key={key}
                selected={config.styleProfile === key}
                onClick={() =>
                  patch(
                    config,
                    onConfigChange,
                    "styleProfile",
                    key as ConfigSnapshot["styleProfile"]
                  )
                }
                disabled={d}
                title={prof.label}
                description={prof.description}
              />
            ))}
          </div>
        </div>

        {/* Response Format */}
        <div>
          <FieldLabel label="Response Format" />
          <div className="space-y-1.5">
            {Object.entries(RESPONSE_FORMATS).map(([key, fmt]) => (
              <RadioCard
                key={key}
                selected={config.responseFormat === key}
                onClick={() =>
                  patch(
                    config,
                    onConfigChange,
                    "responseFormat",
                    key as ConfigSnapshot["responseFormat"]
                  )
                }
                disabled={d}
                title={fmt.label}
                description={fmt.description}
              />
            ))}
          </div>
        </div>

        {/* Few-shot Examples */}
        <div>
          <FieldLabel
            label="Few-shot Examples"
            help="Number of example Q&A pairs to include in the prompt for in-context learning."
          />
          <Segmented
            value={config.fewShotCount}
            options={[0, 1, 3]}
            onChange={(v) => patch(config, onConfigChange, "fewShotCount", v)}
            disabled={d}
            labels={{ "0": "None", "1": "1 example", "3": "3 examples" }}
          />
        </div>

        {/* Safety Preamble */}
        <Toggle
          checked={config.safetyPreambleEnabled}
          onChange={(v) =>
            patch(config, onConfigChange, "safetyPreambleEnabled", v)
          }
          disabled={d}
          label="Safety Preamble"
          description="Prepend a safety disclaimer reminding the model it is not a licensed provider."
        />

        {/* Citation Required */}
        <Toggle
          checked={config.citationRequired}
          onChange={(v) =>
            patch(config, onConfigChange, "citationRequired", v)
          }
          disabled={d}
          label="Citation Required"
          description="Require the model to cite sources from retrieved guidelines."
        />

        {/* Abstain Rule */}
        <div>
          <FieldLabel
            label="Abstain Rule"
            help="Instruction for the model on when to decline answering."
          />
          <textarea
            value={config.abstainRule}
            onChange={(e) =>
              patch(config, onConfigChange, "abstainRule", e.target.value)
            }
            disabled={d}
            rows={2}
            placeholder="If you cannot answer with confidence, state that clearly."
            className="w-full border border-[#d6dfeb] rounded-lg px-3 py-2 t-caption t-primary bg-white focus:outline-none focus:ring-2 focus:ring-fordham-maroon/40 disabled:opacity-50 disabled:cursor-not-allowed resize-none placeholder:t-tertiary"
          />
        </div>
      </ConfigSection>

      {/* ================================================================= */}
      {/* Section 4: Context Assembly                                       */}
      {/* ================================================================= */}
      <ConfigSection title="Context Assembly" icon={Database}>
        {/* Context Level */}
        <div>
          <FieldLabel
            label="Context Level"
            help="Controls how much of the patient record is included in the prompt."
          />
          <div className="space-y-1.5">
            {(Object.keys(CONTEXT_LEVELS) as ContextLevel[]).map((level) => {
              const info = CONTEXT_LEVELS[level];
              return (
                <RadioCard
                  key={level}
                  selected={config.contextLevel === level}
                  onClick={() =>
                    patch(config, onConfigChange, "contextLevel", level)
                  }
                  disabled={d}
                  title={info.label}
                  description={info.description}
                />
              );
            })}
          </div>
        </div>

        {/* Note Inclusion Window */}
        <div>
          <FieldLabel
            label="Note Inclusion Window"
            help="Number of recent clinical notes to include in context (1-20)."
          />
          <div className="flex items-center gap-2.5">
            <input
              type="number"
              min={1}
              max={20}
              value={config.noteWindow}
              onChange={(e) =>
                patch(
                  config,
                  onConfigChange,
                  "noteWindow",
                  Math.max(1, Math.min(20, parseInt(e.target.value) || 1))
                )
              }
              disabled={d}
              className="w-20 border border-[#d6dfeb] rounded-lg px-2.5 py-1.5 t-caption t-primary font-mono bg-white text-center focus:outline-none focus:ring-2 focus:ring-fordham-maroon/40 disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <span className="t-micro t-tertiary">recent notes</span>
          </div>
        </div>

        {/* Section Toggles */}
        <div>
          <FieldLabel
            label="Section Toggles"
            help="Choose which EHR sections are included in the patient context."
          />
          <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
            <Checkbox
              checked={config.sectionToggles.demographics}
              onChange={(v) => patchToggle(config, onConfigChange, "demographics", v)}
              disabled={d}
              label="Demographics"
            />
            <Checkbox
              checked={config.sectionToggles.conditions}
              onChange={(v) => patchToggle(config, onConfigChange, "conditions", v)}
              disabled={d}
              label="Conditions"
            />
            <Checkbox
              checked={config.sectionToggles.medications}
              onChange={(v) => patchToggle(config, onConfigChange, "medications", v)}
              disabled={d}
              label="Medications"
            />
            <Checkbox
              checked={config.sectionToggles.allergies}
              onChange={(v) => patchToggle(config, onConfigChange, "allergies", v)}
              disabled={d}
              label="Allergies"
            />
            <Checkbox
              checked={config.sectionToggles.labs}
              onChange={(v) => patchToggle(config, onConfigChange, "labs", v)}
              disabled={d}
              label="Labs"
            />
            <Checkbox
              checked={config.sectionToggles.vitals}
              onChange={(v) => patchToggle(config, onConfigChange, "vitals", v)}
              disabled={d}
              label="Vitals"
            />
            <Checkbox
              checked={config.sectionToggles.immunizations}
              onChange={(v) => patchToggle(config, onConfigChange, "immunizations", v)}
              disabled={d}
              label="Immunizations"
            />
            <Checkbox
              checked={config.sectionToggles.visits}
              onChange={(v) => patchToggle(config, onConfigChange, "visits", v)}
              disabled={d}
              label="Visits"
            />
            <Checkbox
              checked={config.sectionToggles.imaging}
              onChange={(v) => patchToggle(config, onConfigChange, "imaging", v)}
              disabled={d}
              label="Imaging"
            />
            <Checkbox
              checked={config.sectionToggles.socialHistory}
              onChange={(v) => patchToggle(config, onConfigChange, "socialHistory", v)}
              disabled={d}
              label="Social History"
            />
            <Checkbox
              checked={config.sectionToggles.clinicalNotes}
              onChange={(v) => patchToggle(config, onConfigChange, "clinicalNotes", v)}
              disabled={d}
              label="Clinical Notes"
            />
          </div>
        </div>

        {/* Summary Pre-pass */}
        <Toggle
          checked={config.summaryPrepass}
          onChange={(v) => patch(config, onConfigChange, "summaryPrepass", v)}
          disabled={d}
          label="Summary Pre-pass"
          description="Run an LLM summarization pass on the patient context before the main query."
        />
      </ConfigSection>

      {/* ================================================================= */}
      {/* Section 5: RAG & Retrieval                                        */}
      {/* ================================================================= */}
      <ConfigSection title="RAG & Retrieval" icon={BookOpen}>
        {/* RAG Enabled */}
        <Toggle
          checked={config.ragEnabled}
          onChange={(v) => patch(config, onConfigChange, "ragEnabled", v)}
          disabled={d}
          label="Enable RAG"
          description="Retrieve clinical guideline chunks to augment the model's context."
        />

        {/* Conditional RAG settings */}
        {config.ragEnabled && (
          <div className="space-y-3 pl-2 border-l-2 border-fordham-maroon/20 ml-1">
            {/* RAG Top-K */}
            <div>
              <FieldLabel
                label="Retrieval Top-K"
                help="Number of guideline chunks to retrieve and inject into context."
              />
              <SliderControl
                value={config.ragTopK}
                min={1}
                max={5}
                step={1}
                onChange={(v) => patch(config, onConfigChange, "ragTopK", v)}
                disabled={d}
                formatValue={(v) => String(v)}
              />
            </div>

            {/* Retrieval Method */}
            <div>
              <FieldLabel label="Retrieval Method" />
              <div className="space-y-1.5">
                <RadioCard
                  selected={config.ragMethod === "keyword"}
                  onClick={() =>
                    patch(config, onConfigChange, "ragMethod", "keyword")
                  }
                  disabled={d}
                  title="Keyword"
                  description="TF-IDF style keyword matching against guideline chunks."
                />
                <RadioCard
                  selected={config.ragMethod === "embedding"}
                  onClick={() =>
                    patch(config, onConfigChange, "ragMethod", "embedding")
                  }
                  disabled={d}
                  title="Semantic"
                  description="Embedding-based similarity search for more nuanced retrieval."
                />
                <RadioCard
                  selected={config.ragMethod === "hybrid"}
                  onClick={() =>
                    patch(config, onConfigChange, "ragMethod", "hybrid")
                  }
                  disabled={d}
                  title="Hybrid"
                  description="Combines keyword and semantic scores for best coverage."
                />
              </div>
            </div>

            {/* Reranker */}
            <Toggle
              checked={config.ragReranker}
              onChange={(v) =>
                patch(config, onConfigChange, "ragReranker", v)
              }
              disabled={d}
              label="Reranker"
              description="Apply a cross-encoder reranker to refine retrieval results."
            />
          </div>
        )}
      </ConfigSection>

      {/* ================================================================= */}
      {/* Section 6: Conversation                                           */}
      {/* ================================================================= */}
      <ConfigSection title="Conversation" icon={MessageCircle}>
        {/* History Depth */}
        <div>
          <FieldLabel
            label="History Depth"
            help="Number of previous conversation turns to include as context."
          />
          <Segmented
            value={config.historyDepth}
            options={[0, 5, 10, 20]}
            onChange={(v) => patch(config, onConfigChange, "historyDepth", v)}
            disabled={d}
            labels={{
              "0": "None",
              "5": "5 turns",
              "10": "10 turns",
              "20": "20 turns",
            }}
          />
          <p className="t-micro t-tertiary mt-1">
            {config.historyDepth === 0
              ? "Each query is independent -- no conversation memory."
              : `Last ${config.historyDepth} messages are included for conversational continuity.`}
          </p>
        </div>

        {/* Memory Strategy */}
        <div>
          <FieldLabel
            label="Memory Strategy"
            help="How conversation history is managed when it exceeds the depth limit."
          />
          <div className="space-y-1.5">
            <RadioCard
              selected={config.memoryStrategy === "none"}
              onClick={() =>
                patch(config, onConfigChange, "memoryStrategy", "none")
              }
              disabled={d}
              title="None"
              description="No memory management. Older messages are simply dropped."
            />
            <RadioCard
              selected={config.memoryStrategy === "sliding-window"}
              onClick={() =>
                patch(config, onConfigChange, "memoryStrategy", "sliding-window")
              }
              disabled={d}
              title="Sliding Window"
              description="Keep the N most recent turns and discard older ones."
            />
            <RadioCard
              selected={config.memoryStrategy === "summary"}
              onClick={() =>
                patch(config, onConfigChange, "memoryStrategy", "summary")
              }
              disabled={d}
              title="Summarize"
              description="Summarize older messages into a condensed context block."
            />
          </div>
        </div>
      </ConfigSection>

      {/* ================================================================= */}
      {/* Section 7: Safety & Guardrails                                    */}
      {/* ================================================================= */}
      <ConfigSection title="Safety & Guardrails" icon={Shield}>
        {/* Confidence Floor */}
        <div>
          <FieldLabel
            label="Confidence Floor"
            help="Minimum confidence threshold. Below this, the model will state uncertainty."
          />
          <SliderControl
            value={config.confidenceFloor}
            min={0}
            max={1}
            step={0.05}
            onChange={(v) =>
              patch(config, onConfigChange, "confidenceFloor", v)
            }
            disabled={d}
          />
          <p className="t-micro t-tertiary mt-0.5">
            {config.confidenceFloor === 0
              ? "No confidence filtering -- model will always respond."
              : `Model will abstain when confidence is below ${(config.confidenceFloor * 100).toFixed(0)}%.`}
          </p>
        </div>
      </ConfigSection>

      {/* ================================================================= */}
      {/* Section 8: Cost Controls                                          */}
      {/* ================================================================= */}
      <ConfigSection title="Cost Controls" icon={DollarSign}>
        {/* Per-Turn Token Budget */}
        <div>
          <FieldLabel
            label="Per-Turn Token Budget"
            help="Maximum total tokens (input + output) allowed per single chat turn."
          />
          <div className="flex items-center gap-2.5">
            <input
              type="number"
              min={256}
              max={100000}
              value={config.perTurnTokenBudget}
              onChange={(e) =>
                patch(
                  config,
                  onConfigChange,
                  "perTurnTokenBudget",
                  Math.max(256, parseInt(e.target.value) || 256)
                )
              }
              disabled={d}
              className="w-24 border border-[#d6dfeb] rounded-lg px-2.5 py-1.5 t-caption t-primary font-mono bg-white text-center focus:outline-none focus:ring-2 focus:ring-fordham-maroon/40 disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <span className="t-micro t-tertiary">tokens / turn</span>
          </div>
        </div>

        {/* Per-Run Budget Cap */}
        <div>
          <FieldLabel
            label="Per-Run Budget Cap"
            help="Maximum USD cost allowed per benchmark run. Prevents runaway spending."
          />
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 t-caption t-tertiary">
                $
              </span>
              <input
                type="number"
                min={0.01}
                max={100}
                step={0.1}
                value={config.perRunBudgetCap}
                onChange={(e) =>
                  patch(
                    config,
                    onConfigChange,
                    "perRunBudgetCap",
                    Math.max(0.01, parseFloat(e.target.value) || 0.01)
                  )
                }
                disabled={d}
                className="w-24 border border-[#d6dfeb] rounded-lg pl-6 pr-2.5 py-1.5 t-caption t-primary font-mono bg-white text-center focus:outline-none focus:ring-2 focus:ring-fordham-maroon/40 disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>
            <span className="t-micro t-tertiary">USD / run</span>
          </div>
        </div>
      </ConfigSection>
    </div>
  );
}
