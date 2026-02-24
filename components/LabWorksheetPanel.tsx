"use client";
import React, { useState } from "react";
import { ChevronDown, ChevronUp, ClipboardCheck } from "lucide-react";

interface LabWorksheetPanelProps {
  selectedPatientLabel: string;
  totalTokens: number;
  totalCost: number;
}

type WorksheetState = {
  modelError: string;
  groundingDelta: string;
  temperatureDelta: string;
  privacyDecision: string;
  ragComparison: string;
  safetyRisk: string;
};

const EMPTY_WORKSHEET: WorksheetState = {
  modelError: "",
  groundingDelta: "",
  temperatureDelta: "",
  privacyDecision: "",
  ragComparison: "",
  safetyRisk: "",
};

export default function LabWorksheetPanel({
  selectedPatientLabel,
  totalTokens,
  totalCost,
}: LabWorksheetPanelProps) {
  const [notes, setNotes] = useState<WorksheetState>(EMPTY_WORKSHEET);
  const [expanded, setExpanded] = useState(true);

  const update = (key: keyof WorksheetState, value: string) => {
    setNotes((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <section className="ehr-shell overflow-hidden">
      <button
        onClick={() => setExpanded((prev) => !prev)}
        className="w-full flex items-center justify-between px-4 py-3 border-b border-[#d6dfeb] bg-[#f3f7fd]"
      >
        <div className="flex items-center gap-2">
          <ClipboardCheck className="w-4 h-4 text-[#C49A6C]" />
          <h3 className="text-sm font-semibold text-gray-100 text-left">Lab Worksheet</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">6 prompts</span>
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-gray-500" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-500" />
          )}
        </div>
      </button>

      {expanded && <div className="p-4 space-y-3">
        <div className="rounded-lg border border-gray-700/60 bg-gray-950/60 p-2.5 text-xs text-gray-400">
          <p>
            Active patient:{" "}
            <span className="text-gray-200 font-medium">{selectedPatientLabel}</span>
          </p>
          <p>
            Session usage:{" "}
            <span className="font-mono text-gray-300">
              {totalTokens.toLocaleString()} tokens · ${totalCost.toFixed(5)}
            </span>
          </p>
        </div>

        <WorksheetField
          label="1) Wrong model error observed"
          value={notes.modelError}
          onChange={(v) => update("modelError", v)}
          placeholder="What happened with an incorrect model name? Paste or summarize the API error."
        />

        <WorksheetField
          label="2) Grounding behavior difference"
          value={notes.groundingDelta}
          onChange={(v) => update("groundingDelta", v)}
          placeholder="How did the answer change when system instruction was blank vs explicit?"
        />

        <WorksheetField
          label="3) Temperature experiment"
          value={notes.temperatureDelta}
          onChange={(v) => update("temperatureDelta", v)}
          placeholder="Compare the same question at 1.0 and 0.0 (consistency, wording, confidence)."
        />

        <WorksheetField
          label="4) Privacy minimum-necessary decision"
          value={notes.privacyDecision}
          onChange={(v) => update("privacyDecision", v)}
          placeholder="For your query, which context level is sufficient and why?"
        />

        <WorksheetField
          label="5) RAG comparison"
          value={notes.ragComparison}
          onChange={(v) => update("ragComparison", v)}
          placeholder="With RAG vs without RAG: what changed in specificity, guideline alignment, and uncertainty?"
        />

        <WorksheetField
          label="6) Safety risk + mitigation"
          value={notes.safetyRisk}
          onChange={(v) => update("safetyRisk", v)}
          placeholder="Name one unsafe AI behavior you found and one governance control to reduce risk."
        />
      </div>}
    </section>
  );
}

function WorksheetField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold text-gray-300 mb-1.5">
        {label}
      </span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={2}
        placeholder={placeholder}
        className="w-full bg-gray-950 border border-gray-700 text-gray-200 text-xs rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-[#8C1515]/60 focus:border-transparent resize-y min-h-[58px] placeholder-gray-600"
      />
    </label>
  );
}
