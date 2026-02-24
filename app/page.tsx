"use client";
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useSession, signOut } from "next-auth/react";
import PatientSelector from "@/components/PatientSelector";
import PatientChart from "@/components/PatientChart";
import ChatInterface from "@/components/ChatInterface";
import LabConfigPanel from "@/components/LabConfigPanel";
import RAGPanel from "@/components/RAGPanel";
import LabWorksheetPanel from "@/components/LabWorksheetPanel";
import { Patient, Message, LabConfig, RAGChunk } from "@/lib/types";
import { buildPatientContext } from "@/lib/patient-context";
import {
  ALL_PATIENTS_OPTION_ID,
  BRONX_HOSPITAL_50_OPTION_ID,
  buildCohortContext,
  buildCohortKeywords,
  getBronxHospitalCohort,
} from "@/lib/cohort-context";

const DEFAULT_CONFIG: LabConfig = {
  modelName: "gemini-flash-latest",
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
  const { data: session } = useSession();
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

  const bronxCohortPatients = useMemo(() => getBronxHospitalCohort(patients), [patients]);
  const selectedPatient = useMemo(() => {
    if (
      selectedPatientId === ALL_PATIENTS_OPTION_ID ||
      selectedPatientId === BRONX_HOSPITAL_50_OPTION_ID
    ) {
      return null;
    }
    return patients.find((p) => p.id === selectedPatientId) || null;
  }, [patients, selectedPatientId]);
  const selectedCohortPatients = useMemo(() => {
    if (selectedPatientId === ALL_PATIENTS_OPTION_ID) return patients;
    if (selectedPatientId === BRONX_HOSPITAL_50_OPTION_ID) return bronxCohortPatients;
    return null;
  }, [selectedPatientId, patients, bronxCohortPatients]);
  const selectedTargetLabel = useMemo(() => {
    if (selectedPatient) return `${selectedPatient.name} (${selectedPatient.id})`;
    if (selectedPatientId === ALL_PATIENTS_OPTION_ID) {
      return `All Patients (${patients.length.toLocaleString()})`;
    }
    if (selectedPatientId === BRONX_HOSPITAL_50_OPTION_ID) {
      return `Bronx Hospital Cohort (${bronxCohortPatients.length})`;
    }
    return null;
  }, [selectedPatient, selectedPatientId, patients.length, bronxCohortPatients.length]);
  const canSendMessages = Boolean(selectedPatient || selectedCohortPatients);
  const samplePrompts = useMemo(() => {
    if (selectedPatientId === ALL_PATIENTS_OPTION_ID) {
      return [
        "How many patients have a documented influenza immunization?",
        "What percentage of patients have Hemoglobin A1c >= 8.0?",
        "Summarize the top chronic conditions in this full population.",
      ];
    }
    if (selectedPatientId === BRONX_HOSPITAL_50_OPTION_ID) {
      return [
        "How many Bronx cohort patients have flu shots, and how many do not?",
        "List Bronx cohort patient IDs with Hemoglobin A1c >= 8.0.",
        "Which Bronx cohort patient IDs have no documented conditions?",
      ];
    }
    if (selectedPatient) {
      return [
        `Summarize ${selectedPatient.name}'s key diagnoses, meds, and high-risk labs.`,
        "What is the top safety risk today and what chart evidence supports it?",
        "What follow-up checks should happen next and why?",
      ];
    }
    return [
      "Select a patient or cohort, then ask a chart-grounded question.",
      "Compare answers with RAG OFF vs RAG ON.",
      "Use context levels to test minimum-necessary data sharing.",
    ];
  }, [selectedPatientId, selectedPatient]);

  const handlePatientSelect = (patientId: string) => {
    setSelectedPatientId(patientId);
    setRagChunks([]);

    if (patientId === ALL_PATIENTS_OPTION_ID) {
      setMessages([
        {
          id: Date.now().toString(),
          role: "assistant",
          content: `Cohort loaded: **All Patients** (${patients.length.toLocaleString()}).\n\nUse this for population-level questions and aggregate findings.\n\nTry:\n1. How many patients have documented influenza immunization?\n2. What percentage have Hemoglobin A1c >= 8.0?\n3. What are the top chronic conditions?`,
        },
      ]);
    } else if (patientId === BRONX_HOSPITAL_50_OPTION_ID) {
      setMessages([
        {
          id: Date.now().toString(),
          role: "assistant",
          content: `Cohort loaded: **Bronx Hospital Cohort** (${bronxCohortPatients.length} patients).\n\nThis subset is designed for tractable group review.\n\nTry:\n1. How many have flu shots?\n2. Which IDs have A1c >= 8.0?\n3. Which IDs have no documented conditions?`,
        },
      ]);
    } else {
      const patient = patients.find((p) => p.id === patientId);
      if (patient) {
        setMessages([
          {
            id: Date.now().toString(),
            role: "assistant",
            content: `Chart loaded for **${patient.name}** (${patient.id}).\n\nAge: ${patient.age} · Gender: ${patient.gender} · ${patient.conditions.length} condition${patient.conditions.length !== 1 ? "s" : ""} · ${patient.medications.filter((m) => m.status === "Active").length} active med${patient.medications.filter((m) => m.status === "Active").length !== 1 ? "s" : ""}\n\nHow can I help you with this patient?`,
          },
        ]);
      }
    }
  };

  const handleSendMessage = useCallback(
    async (content: string) => {
      if (!canSendMessages) return;

      const userMsg: Message = {
        id: Date.now().toString(),
        role: "user",
        content,
      };
      setMessages((prev) => [...prev, userMsg]);
      setIsLoading(true);
      setRagChunks([]);

      try {
        const patientContext = selectedPatient
          ? buildPatientContext(selectedPatient, config.contextLevel)
          : selectedCohortPatients
          ? buildCohortContext(selectedCohortPatients, selectedTargetLabel || "Cohort", {
              includeRoster: selectedPatientId === BRONX_HOSPITAL_50_OPTION_ID,
            })
          : "No patient selected.";

        let currentRagChunks: RAGChunk[] = [];

        const patientKeywords = selectedPatient
          ? [
              ...selectedPatient.conditions.map((c) => c.display),
              ...selectedPatient.medications
                .filter((m) => m.status === "Active")
                .map((m) => m.name),
              ...selectedPatient.labs.map((l) => l.name),
              ...selectedPatient.allergies.map((a) => a.allergen),
              ...selectedPatient.immunizations.map((i) => i.name),
            ]
          : selectedCohortPatients
          ? buildCohortKeywords(selectedCohortPatients)
          : [];

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

        const modelName =
          typeof config.modelName === "string" && config.modelName.trim()
            ? config.modelName.trim()
            : "gemini-flash-latest";

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
    [
      canSendMessages,
      selectedPatient,
      selectedCohortPatients,
      selectedTargetLabel,
      selectedPatientId,
      config,
      messages,
    ]
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
          <p className="text-xs mt-1">
            <a
              href="/lab"
              className="text-[#8C1515] underline underline-offset-2 hover:text-[#6B1010]"
            >
              Need assignment steps? Open the lab instructions page.
            </a>
          </p>
          <p className="text-xs mt-1">
            <a
              href="/submissions"
              className="text-[#8C1515] underline underline-offset-2 hover:text-[#6B1010]"
            >
              Ready to submit? Open benchmark + judge feedback.
            </a>
          </p>
          <p className="text-xs mt-1">
            <a
              href="/fordham-health-bench"
              className="text-[#8C1515] underline underline-offset-2 hover:text-[#6B1010]"
            >
              Try the Fordham Health Bench (5 cases).
            </a>
          </p>
          <p className="text-xs mt-1">
            <a
              href="/extracredit"
              className="text-[#8C1515] underline underline-offset-2 hover:text-[#6B1010]"
            >
              Try Extra Credit (3 challenge exams).
            </a>
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
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
          {session?.user && (
            <div className="flex items-center gap-2">
              {session.user.image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={session.user.image}
                  alt={session.user.name ?? "User"}
                  className="w-7 h-7 rounded-full border border-[#d6dfeb]"
                />
              )}
              <span className="text-xs text-gray-500 hidden sm:inline">
                {session.user.name ?? session.user.email}
              </span>
              <button
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="text-xs text-[#8C1515] underline underline-offset-2 hover:text-[#6B1010]"
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main layout: 3 columns */}
      <div className="grid grid-cols-1 gap-4 xl:items-start xl:grid-cols-[280px_minmax(0,1fr)_300px]">
        {/* LEFT: EHR Panel */}
        <div className="flex flex-col gap-4 xl:sticky xl:top-6">
          <div className="ehr-shell">
            <div className="ehr-shell-header">Patient Lookup</div>
            <div className="p-4">
            <PatientSelector
              patients={patients}
              selectedPatientId={selectedPatientId}
              onSelect={handlePatientSelect}
              isLoading={isDataLoading}
            />
            {selectedCohortPatients && (
              <p className="mt-2 t-caption text-[#4c637f]">
                Cohort mode active. Ask count/list questions for this group.
              </p>
            )}
            {!isDataLoading && dataLoadError && (
              <p className="mt-2 t-caption text-[#8C1515]">
                Patient dataset error: {dataLoadError}
              </p>
            )}
            </div>
          </div>

          <div className="h-[420px] md:h-[520px] xl:h-[calc(100vh-270px)] ehr-shell overflow-hidden">
            <div className="ehr-shell-header">Patient Chart</div>
            <PatientChart patient={selectedPatient} />
          </div>
        </div>

        {/* CENTER: Chat + Worksheet */}
        <div className="min-w-0 flex flex-col gap-4">
          <div className="h-[55vh] md:h-[62vh] xl:h-[calc(100vh-360px)] min-w-0 ehr-shell overflow-hidden">
            <ChatInterface
              messages={messages}
              isLoading={isLoading}
              onSendMessage={handleSendMessage}
              patientName={selectedTargetLabel}
              disabled={!canSendMessages}
            />
          </div>
          <LabWorksheetPanel
            selectedPatientLabel={selectedTargetLabel || "No patient selected"}
            totalTokens={totals.tokens}
            totalCost={totals.cost}
          />
        </div>

        {/* RIGHT: Config + RAG */}
        <div className="min-w-0 flex flex-col gap-4 pr-1">
          <div className="ehr-shell p-3">
            <p className="t-small font-semibold t-primary">Student Workbench</p>
            <p className="ehr-panel-blurb mt-1">
              Configure model behavior, run safety/privacy experiments, and capture findings in the worksheet.
            </p>
          </div>
          <div className="ehr-shell p-3">
            <p className="t-small font-semibold t-primary">Sample Prompts</p>
            <ul className="list-disc pl-5 mt-1.5 space-y-1 t-caption t-secondary">
              {samplePrompts.map((prompt, idx) => (
                <li key={idx}>{prompt}</li>
              ))}
            </ul>
          </div>
          <LabConfigPanel config={config} onChange={setConfig} />
          <RAGPanel
            chunks={ragChunks}
            isLoading={isRagLoading}
            ragEnabled={config.ragEnabled}
          />
        </div>
      </div>
    </div>
  );
}
