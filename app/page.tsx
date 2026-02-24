"use client";
import React, { useState, useEffect, useCallback } from "react";
import PatientSelector from "@/components/PatientSelector";
import PatientChart from "@/components/PatientChart";
import ChatInterface from "@/components/ChatInterface";
import LabConfigPanel from "@/components/LabConfigPanel";
import RAGPanel from "@/components/RAGPanel";
import LabWorksheetPanel from "@/components/LabWorksheetPanel";
import { Patient, Message, LabConfig, RAGChunk } from "@/lib/types";
import { buildPatientContext } from "@/lib/patient-context";

const DEFAULT_CONFIG: LabConfig = {
  modelSuffix: "",
  systemInstruction: "",
  temperature: 0.2,
  contextLevel: "STANDARD",
  ragEnabled: false,
};

const WELCOME_MESSAGE: Message = {
  id: "welcome",
  role: "assistant",
  content:
    "Welcome to the ChatEHR Lab!\n\nTo get started:\n1. Select a patient from the dropdown\n2. Fill in the Lab Configuration panel (the blanks on the left)\n3. Ask a clinical question\n\nYour AI Governance Lead should track token counts and costs as you chat.",
};

export default function ChatEHRPage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [dataLoadError, setDataLoadError] = useState<string | null>(null);
  const [selectedPatientId, setSelectedPatientId] = useState("");
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
  const [isLoading, setIsLoading] = useState(false);
  const [config, setConfig] = useState<LabConfig>(DEFAULT_CONFIG);
  const [ragChunks, setRagChunks] = useState<RAGChunk[]>([]);
  const [isRagLoading, setIsRagLoading] = useState(false);

  // Load patients
  useEffect(() => {
    fetch("/data/patients.json")
      .then(async (r) => {
        if (!r.ok) {
          throw new Error(`Failed to load patients (${r.status})`);
        }
        return r.json();
      })
      .then((data: Patient[]) => {
        setPatients(data);
        setDataLoadError(null);
        setIsDataLoading(false);
      })
      .catch((err: unknown) => {
        const message =
          err instanceof Error ? err.message : "Unable to load patient dataset";
        setDataLoadError(message);
        setIsDataLoading(false);
      });
  }, []);

  const selectedPatient = patients.find((p) => p.id === selectedPatientId) || null;

  const handlePatientSelect = (patientId: string) => {
    setSelectedPatientId(patientId);
    const patient = patients.find((p) => p.id === patientId);
    if (patient) {
      setMessages([
        {
          id: Date.now().toString(),
          role: "assistant",
          content: `Chart loaded for **${patient.name}** (${patient.id}).\n\nAge: ${patient.age} · Gender: ${patient.gender} · ${patient.conditions.length} condition${patient.conditions.length !== 1 ? "s" : ""} · ${patient.medications.filter((m) => m.status === "Active").length} active med${patient.medications.filter((m) => m.status === "Active").length !== 1 ? "s" : ""}\n\nHow can I help you with this patient?`,
        },
      ]);
      setRagChunks([]);
    }
  };

  const handleSendMessage = useCallback(
    async (content: string) => {
      if (!selectedPatient) return;

      const userMsg: Message = {
        id: Date.now().toString(),
        role: "user",
        content,
      };
      setMessages((prev) => [...prev, userMsg]);
      setIsLoading(true);
      setRagChunks([]);

      try {
        // Build patient context at selected level
        const patientContext = buildPatientContext(
          selectedPatient,
          config.contextLevel
        );

        let currentRagChunks: RAGChunk[] = [];

        const patientKeywords = [
          ...selectedPatient.conditions.map((c) => c.display),
          ...selectedPatient.medications
            .filter((m) => m.status === "Active")
            .map((m) => m.name),
          ...selectedPatient.labs.map((l) => l.name),
          ...selectedPatient.allergies.map((a) => a.allergen),
          ...selectedPatient.immunizations.map((i) => i.name),
        ];

        // RAG retrieval via API
        if (config.ragEnabled) {
          setIsRagLoading(true);
          try {
            const ragRes = await fetch("/api/rag", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                query: content,
                patientKeywords,
              }),
            });
            if (ragRes.ok) {
              const ragData = await ragRes.json();
              currentRagChunks = ragData.chunks || [];
              setRagChunks(currentRagChunks);
            }
          } catch {
            // RAG failure is non-fatal
          } finally {
            setIsRagLoading(false);
          }
        }

        // Full model name
        const modelName = `gemini-${config.modelSuffix.trim()}-flash`;

        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [...messages, userMsg].map((m) => ({
              role: m.role,
              content: m.content,
            })),
            context: patientContext,
            modelName,
            systemInstruction: config.systemInstruction,
            temperature: config.temperature,
            ragChunks: currentRagChunks,
          }),
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          setMessages((prev) => [
            ...prev,
            {
              id: (Date.now() + 1).toString(),
              role: "assistant",
              content: data.error || "An error occurred.",
              hint: data.hint,
              isError: true,
            },
          ]);
          return;
        }

        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            role: "assistant",
            content: data.text,
            usage: data.usage,
            ragChunks: currentRagChunks.length > 0 ? currentRagChunks : undefined,
          },
        ]);
      } catch (err: unknown) {
        const e = err as { message?: string };
        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            role: "assistant",
            content: `Network error: ${e.message || "Unknown error"}`,
            isError: true,
          },
        ]);
      } finally {
        setIsLoading(false);
      }
    },
    [selectedPatient, config, messages]
  );

  // Token/cost totals
  const totals = messages
    .filter((m) => m.usage)
    .reduce(
      (acc, m) => ({
        tokens: acc.tokens + (m.usage?.totalTokens || 0),
        cost: acc.cost + (m.usage?.estimatedCost || 0),
      }),
      { tokens: 0, cost: 0 }
    );

  return (
    <div className="space-y-4">
      {/* Page header */}
      <div className="ehr-shell p-4 md:p-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-[#122033] md:text-2xl">ChatEHR Lab</h1>
          <p className="text-xs text-gray-300 md:text-sm">
            Simulated EHR + Gemini API · HINF 6117
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Educational environment only. Not for real patient care.
          </p>
        </div>
        {totals.tokens > 0 && (
          <div className="text-left sm:text-right bg-[#f3f7fd] border border-[#d6dfeb] rounded-lg px-3 py-2">
            <p className="text-xs text-gray-300 font-mono">
              Session: {totals.tokens.toLocaleString()} tokens
            </p>
            <p className="text-xs text-gray-500 font-mono">
              ~${totals.cost.toFixed(5)} est. cost
            </p>
          </div>
        )}
      </div>

      {/* Main layout: 3 columns */}
      <div className="grid grid-cols-1 gap-4 xl:h-[calc(100vh-160px)] xl:grid-cols-[280px_minmax(0,1fr)_300px]">
        {/* LEFT: EHR Panel */}
        <div className="flex flex-col gap-4 xl:min-h-0 xl:overflow-hidden">
          <div className="ehr-shell">
            <div className="ehr-shell-header">Patient Lookup</div>
            <div className="p-4">
            <PatientSelector
              patients={patients}
              selectedPatientId={selectedPatientId}
              onSelect={handlePatientSelect}
              isLoading={isDataLoading}
            />
            {!isDataLoading && dataLoadError && (
              <p className="mt-2 text-xs text-[#8C1515]">
                Patient dataset error: {dataLoadError}
              </p>
            )}
            </div>
          </div>

          <div className="h-[420px] md:h-[520px] xl:h-auto xl:flex-1 ehr-shell overflow-hidden min-h-0">
            <div className="ehr-shell-header">Patient Chart</div>
            <PatientChart patient={selectedPatient} />
          </div>
        </div>

        {/* CENTER: Chat */}
        <div className="h-[60vh] md:h-[70vh] xl:h-auto xl:min-h-0 min-w-0 ehr-shell overflow-hidden">
          <ChatInterface
            messages={messages}
            isLoading={isLoading}
            onSendMessage={handleSendMessage}
            patientName={selectedPatient?.name || null}
            disabled={!selectedPatient}
          />
        </div>

        {/* RIGHT: Config + RAG */}
        <div className="min-w-0 flex flex-col gap-4 overflow-y-auto xl:h-full xl:min-h-0 pr-1">
          <div className="ehr-shell p-3 text-xs text-gray-400">
            <p className="font-semibold text-gray-200">Student Workbench</p>
            <p className="mt-1">
              Configure model behavior, run safety/privacy experiments, and capture findings in the worksheet.
            </p>
          </div>
          <LabConfigPanel config={config} onChange={setConfig} />
          <RAGPanel
            chunks={ragChunks}
            isLoading={isRagLoading}
            ragEnabled={config.ragEnabled}
          />
          <LabWorksheetPanel
            selectedPatientLabel={
              selectedPatient ? `${selectedPatient.name} (${selectedPatient.id})` : "No patient selected"
            }
            totalTokens={totals.tokens}
            totalCost={totals.cost}
          />
        </div>
      </div>
    </div>
  );
}
