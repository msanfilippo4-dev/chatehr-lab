"use client";
import React, { useState } from "react";
import { ChevronDown, ChevronUp, ClipboardCheck } from "lucide-react";

interface LabWorksheetPanelProps {
  selectedPatientLabel: string;
  totalTokens: number;
  totalCost: number;
}

type WorksheetState = {
  missionA: string;
  missionB: string;
  missionC: string;
  experiments: string;
  governance: string;
  benchmarkQ1: string;
  benchmarkQ2: string;
  benchmarkQ3: string;
};

const EMPTY_WORKSHEET: WorksheetState = {
  missionA: "",
  missionB: "",
  missionC: "",
  experiments: "",
  governance: "",
  benchmarkQ1: "",
  benchmarkQ2: "",
  benchmarkQ3: "",
};

type BenchmarkResult = {
  benchmark: { overallScore: number };
};

export default function LabWorksheetPanel({
  selectedPatientLabel,
  totalTokens,
  totalCost,
}: LabWorksheetPanelProps) {
  const [notes, setNotes] = useState<WorksheetState>(EMPTY_WORKSHEET);
  const [teamName, setTeamName] = useState("");
  const [expanded, setExpanded] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [benchmarkScore, setBenchmarkScore] = useState<number | null>(null);

  const update = (key: keyof WorksheetState, value: string) => {
    setNotes((prev) => ({ ...prev, [key]: value }));
  };

  const submitWorksheet = async () => {
    setSubmitError(null);
    setSubmitMessage(null);
    setBenchmarkScore(null);
    setIsSubmitting(true);
    try {
      const saveRes = await fetch("/api/worksheet/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamName,
          selectedPatientLabel,
          totalTokens,
          totalCost,
          notes,
        }),
      });
      const saveData = (await saveRes.json()) as { error?: string; message?: string };
      if (!saveRes.ok) {
        setSubmitError(saveData.error || "Unable to save worksheet.");
        return;
      }

      const hasBenchmarkAnswers =
        notes.benchmarkQ1.trim() && notes.benchmarkQ2.trim() && notes.benchmarkQ3.trim();

      if (hasBenchmarkAnswers) {
        const benchRes = await fetch("/api/submissions/evaluate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            answers: {
              q1: notes.benchmarkQ1,
              q2: notes.benchmarkQ2,
              q3: notes.benchmarkQ3,
            },
          }),
        });
        const benchData = (await benchRes.json()) as BenchmarkResult & { error?: string };
        if (benchRes.ok && benchData.benchmark?.overallScore !== undefined) {
          setBenchmarkScore(benchData.benchmark.overallScore);
        }
      }

      setSubmitMessage(saveData.message || "Worksheet submitted.");
    } catch {
      setSubmitError("Network error while submitting worksheet.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="ehr-shell overflow-hidden">
      <button
        onClick={() => setExpanded((prev) => !prev)}
        className="w-full flex items-center justify-between px-4 py-3 border-b border-[#d6dfeb] bg-[#f3f7fd]"
      >
        <div className="flex items-center gap-2">
          <ClipboardCheck className="w-4 h-4 text-[#C49A6C]" />
          <h3 className="text-sm font-semibold text-gray-100 text-left">
            Lab Worksheet + Submission
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="t-micro t-secondary">8 prompts</span>
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-gray-500" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-500" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="max-h-[65vh] overflow-y-auto overscroll-contain touch-pan-y [-webkit-overflow-scrolling:touch] p-4 space-y-3">
          <div className="rounded-lg border border-gray-700/60 bg-gray-950/60 p-2.5 text-xs text-gray-400">
            <p>
              Active target:{" "}
              <span className="text-gray-200 font-medium">{selectedPatientLabel}</span>
            </p>
            <p>
              Session usage:{" "}
              <span className="font-mono text-gray-300">
                {totalTokens.toLocaleString()} tokens · ${totalCost.toFixed(5)}
              </span>
            </p>
          </div>

          <label className="block">
            <span className="block t-caption font-semibold text-gray-300 mb-1.5">
              Team name (optional)
            </span>
            <input
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              placeholder="Example: Group A"
              className="w-full bg-gray-950 border border-gray-700 text-gray-200 t-caption rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-[#8C1515]/60 focus:border-transparent placeholder-gray-600"
            />
          </label>

          <WorksheetField
            label="1) Mission A (LAB-001): safety finding + chart evidence"
            value={notes.missionA}
            onChange={(v) => update("missionA", v)}
            placeholder="Unsafe risk, evidence (lab+med+allergy), and safer mitigation."
          />

          <WorksheetField
            label="2) Mission B (LAB-002): RAG OFF vs ON"
            value={notes.missionB}
            onChange={(v) => update("missionB", v)}
            placeholder="What changed in specificity, grounding, and uncertainty?"
          />

          <WorksheetField
            label="3) Mission C (LAB-003): minimum necessary decision"
            value={notes.missionC}
            onChange={(v) => update("missionC", v)}
            placeholder="Chosen context level and privacy/safety justification."
          />

          <WorksheetField
            label="4) Comparison experiments (model, temperature, context)"
            value={notes.experiments}
            onChange={(v) => update("experiments", v)}
            placeholder="What changed when one variable changed?"
          />

          <WorksheetField
            label="5) Governance control + verification step"
            value={notes.governance}
            onChange={(v) => update("governance", v)}
            placeholder="One risk control and one uncertainty/verification action."
          />

          <WorksheetField
            label="6) Benchmark Q1 draft"
            value={notes.benchmarkQ1}
            onChange={(v) => update("benchmarkQ1", v)}
            placeholder="One safety risk + mitigation with chart evidence."
          />

          <WorksheetField
            label="7) Benchmark Q2 draft"
            value={notes.benchmarkQ2}
            onChange={(v) => update("benchmarkQ2", v)}
            placeholder="RAG OFF vs ON differences."
          />

          <WorksheetField
            label="8) Benchmark Q3 draft"
            value={notes.benchmarkQ3}
            onChange={(v) => update("benchmarkQ3", v)}
            placeholder="Minimum-necessary context decision and tradeoff."
          />

          {submitError && (
            <p className="t-caption text-[#8C1515] rounded-lg border border-[#f2c7c7] bg-[#fff6f6] px-3 py-2">
              {submitError}
            </p>
          )}
          {submitMessage && (
            <p className="t-caption text-[#304762] rounded-lg border border-[#d6dfeb] bg-[#f8fbff] px-3 py-2">
              {submitMessage}
              {benchmarkScore !== null
                ? ` Benchmark score: ${benchmarkScore}%`
                : " Add Benchmark Q1-Q3 to get automatic scoring."}
            </p>
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={submitWorksheet}
              disabled={isSubmitting}
              className="rounded-lg px-3 py-2 t-caption font-semibold border border-[#d6dfeb] bg-[#8C1515] text-white hover:bg-[#6B1010] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? "Submitting..." : "Submit Worksheet Response"}
            </button>
            <a
              href="/submissions"
              className="t-caption text-[#8C1515] underline underline-offset-2 hover:text-[#6B1010]"
            >
              Open full benchmark view
            </a>
          </div>
        </div>
      )}
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
      <span className="block t-caption font-semibold text-gray-300 mb-1.5">
        {label}
      </span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={2}
        placeholder={placeholder}
        className="w-full bg-gray-950 border border-gray-700 text-gray-200 t-caption rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-[#8C1515]/60 focus:border-transparent resize-y min-h-[58px] placeholder-gray-600"
      />
    </label>
  );
}

