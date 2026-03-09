"use client";

import Link from "next/link";
import React, { useState, useCallback } from "react";
import {
  ArrowRight,
  FileText,
  MessageSquare,
  SlidersHorizontal,
  Users,
} from "lucide-react";
import type { Patient, Message, ConfigSnapshot } from "@/lib/types";
import { DEFAULT_CONFIG } from "@/lib/constants";
import { buildPatientContext } from "@/lib/patient-context";
import { useTeam } from "@/components/providers/TeamProvider";

import PatientSelector from "./_components/PatientSelector";
import PatientChart from "./_components/PatientChart";
import ChatInterface from "./_components/ChatInterface";
import ConfigStudio from "./_components/ConfigStudio";

// ---------------------------------------------------------------------------
// Workspace Page — 3-column layout wiring all components together
// ---------------------------------------------------------------------------

export default function WorkspacePage() {
  const { team, loading: teamLoading } = useTeam();

  // ── State ────────────────────────────────────────────────────────────────
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [config, setConfig] = useState<ConfigSnapshot>({
    ...DEFAULT_CONFIG,
    name: "Default Config",
  });

  // ── Patient Selection ────────────────────────────────────────────────────
  // When a patient is selected from the list, clear chat and fetch full data
  const handleSelectPatient = useCallback(async (patient: Patient) => {
    // Clear conversation when switching patients
    setMessages([]);
    // Set the patient immediately from the list data (lightweight)
    setSelectedPatient(patient);

    // Fetch full patient record from the API for complete data
    try {
      const res = await fetch(`/api/patients/${patient.id}`);
      if (res.ok) {
        const fullPatient: Patient = await res.json();
        setSelectedPatient(fullPatient);
      }
    } catch (err) {
      // If the full fetch fails, we still have the list data -- usable
      console.error("Failed to load full patient record:", err);
    }
  }, []);

  // ── Chat Handler ─────────────────────────────────────────────────────────
  const handleSendMessage = useCallback(
    async (content: string) => {
      // Build user message
      const userMessage: Message = {
        id: `user-${Date.now()}`,
        role: "user",
        content,
      };

      // Append user message to conversation
      setMessages((prev) => [...prev, userMessage]);
      setIsLoading(true);

      try {
        // Build patient context string using the current config settings
        let context: string | undefined;
        if (selectedPatient) {
          context = buildPatientContext(selectedPatient, {
            level: config.contextLevel,
            sectionToggles: config.sectionToggles,
            noteWindow: config.noteWindow,
          });
        }

        // Build conversation history for the API (role + content only)
        const conversationHistory = [
          ...messages.map((m) => ({ role: m.role, content: m.content })),
          { role: "user" as const, content },
        ];

        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: conversationHistory,
            context,
            configId: config.id,
            patientId: selectedPatient?.id,
          }),
        });

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({
            error: `Request failed with status ${res.status}`,
          }));

          const errorMessage: Message = {
            id: `error-${Date.now()}`,
            role: "assistant",
            content: errorData.error || "An unknown error occurred.",
            isError: true,
            hint:
              res.status === 401
                ? "You may need to sign in again."
                : res.status === 429
                ? "Rate limit hit. Wait a moment and try again."
                : res.status === 502
                ? "The model provider returned an error. Check your API key or try a different model."
                : undefined,
          };

          setMessages((prev) => [...prev, errorMessage]);
          return;
        }

        const data = await res.json();

        const assistantMessage: Message = {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: data.text,
          usage: data.usage
            ? {
                inputTokens: data.usage.inputTokens,
                outputTokens: data.usage.outputTokens,
                totalTokens: data.usage.totalTokens,
                estimatedCost: data.usage.estimatedCost,
                model: data.usage.model,
                modelLatencyMs: data.usage.latencyMs,
                totalLatencyMs: data.usage.latencyMs,
              }
            : undefined,
          ragChunks: data.ragChunks,
        };

        setMessages((prev) => [...prev, assistantMessage]);
      } catch (err) {
        console.error("Chat request failed:", err);

        const errorMessage: Message = {
          id: `error-${Date.now()}`,
          role: "assistant",
          content:
            err instanceof Error
              ? err.message
              : "Network error. Please check your connection and try again.",
          isError: true,
          hint: "This may be a network connectivity issue.",
        };

        setMessages((prev) => [...prev, errorMessage]);
      } finally {
        setIsLoading(false);
      }
    },
    [messages, selectedPatient, config]
  );

  // ── Config Handlers ──────────────────────────────────────────────────────

  const handleConfigChange = useCallback(
    (updated: ConfigSnapshot) => {
      setConfig(updated);
    },
    []
  );

  const handleSave = useCallback(async () => {
    try {
      const res = await fetch("/api/configs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Save failed" }));
        throw new Error(err.error || "Failed to save configuration");
      }

      const savedConfig: ConfigSnapshot = await res.json();
      setConfig(savedConfig);
      return savedConfig;
    } catch (err) {
      console.error("Failed to save config:", err);
      throw err;
    }
  }, [config]);

  const handleFreeze = useCallback(async () => {
    if (!config.id) {
      throw new Error("Config must be saved before freezing.");
    }

    try {
      const res = await fetch(`/api/configs/${config.id}/freeze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Freeze failed" }));
        throw new Error(err.error || "Failed to freeze configuration");
      }

      const frozenData = await res.json();
      setConfig((prev) => ({
        ...prev,
        isFrozen: true,
        configHash: frozenData.configHash ?? prev.configHash,
      }));
      return frozenData;
    } catch (err) {
      console.error("Failed to freeze config:", err);
      throw err;
    }
  }, [config.id]);

  // ── Layout ───────────────────────────────────────────────────────────────

  if (!teamLoading && !team) {
    return (
      <div className="mx-auto flex h-full max-w-3xl items-center justify-center">
        <section className="ehr-shell w-full max-w-2xl overflow-hidden">
          <div className="ehr-shell-header flex items-center gap-2">
            <Users size={12} />
            <span>Team Setup Required</span>
          </div>
          <div className="space-y-4 p-6">
            <div>
              <h1 className="t-heading text-xl">Create or join your team first</h1>
              <p className="mt-2 t-body t-secondary">
                Workspace chats, saved configurations, experiments, and
                benchmark runs are all stored at the team level. Join a team so
                your work persists and your leaderboard results count.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/join-team"
                className="inline-flex items-center gap-2 rounded-lg bg-fordham-maroon px-4 py-2.5 t-body font-medium text-white transition hover:bg-fordham-dark"
              >
                <Users size={16} />
                <span>Create or join a team</span>
              </Link>
              <Link
                href="/leaderboard"
                className="inline-flex items-center gap-2 rounded-lg border border-[#d6dfeb] bg-white px-4 py-2.5 t-body font-medium text-[#60768f] transition hover:border-fordham-maroon/30 hover:text-fordham-maroon"
              >
                <span>View leaderboard</span>
                <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="flex h-full gap-3">
      {/* ── Left Column: Patient Selector + Patient Chart ────────────── */}
      <div className="w-[280px] shrink-0 flex flex-col gap-3">
        {/* Patient Selector (fixed height with search) */}
        <div className="ehr-shell h-[240px] shrink-0 flex flex-col">
          <PatientSelector
            onSelectPatient={handleSelectPatient}
            selectedPatientId={selectedPatient?.id ?? null}
          />
        </div>

        {/* Patient Chart (fills remaining height, sticky) */}
        <div className="ehr-shell flex-1 min-h-0 flex flex-col overflow-hidden">
          <div className="ehr-shell-header flex items-center gap-2">
            <FileText size={12} />
            <span>Patient Chart</span>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto">
            <PatientChart patient={selectedPatient} />
          </div>
        </div>
      </div>

      {/* ── Center Column: Chat Interface ────────────────────────────── */}
      <div className="flex-1 min-w-0">
        <div className="ehr-shell flex h-full flex-col">
          <div className="ehr-shell-header flex items-center gap-2">
            <MessageSquare size={12} />
            <span>Clinical Chat</span>
          </div>
          <div className="flex-1 min-h-0">
            <ChatInterface
              messages={messages}
              onSendMessage={handleSendMessage}
              isLoading={isLoading}
              patientName={selectedPatient?.name}
            />
          </div>
        </div>
      </div>

      {/* ── Right Column: Config Studio ──────────────────────────────── */}
      <div className="w-[340px] shrink-0">
        <div className="ehr-shell flex h-full flex-col">
          <div className="ehr-shell-header flex items-center gap-2">
            <SlidersHorizontal size={12} />
            <span>Config Studio</span>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto">
            <ConfigStudio
              config={config}
              onConfigChange={handleConfigChange}
              onSave={handleSave}
              onFreeze={handleFreeze}
              isFrozen={config.isFrozen}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
