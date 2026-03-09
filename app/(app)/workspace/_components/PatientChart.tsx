"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  User,
  AlertCircle,
  Activity,
  Pill,
  Calendar,
  Syringe,
  Heart,
  ScanLine,
  Home,
} from "lucide-react";
import type { Patient } from "@/lib/types";

// ---------------------------------------------------------------------------
// Tab definitions
// ---------------------------------------------------------------------------

const tabs = [
  { id: "demographics", label: "Demographics", icon: User },
  { id: "problems", label: "Problems", icon: AlertCircle },
  { id: "labs", label: "Labs", icon: Activity },
  { id: "meds", label: "Meds", icon: Pill },
  { id: "visits", label: "Visits", icon: Calendar },
  { id: "immunizations", label: "Immun.", icon: Syringe },
  { id: "imaging", label: "Imaging", icon: ScanLine },
  { id: "sdoh", label: "SDOH", icon: Home },
] as const;

type TabId = (typeof tabs)[number]["id"];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface PatientChartProps {
  patient: Patient | null;
}

export default function PatientChart({ patient }: PatientChartProps) {
  const [activeTab, setActiveTab] = useState<TabId>("demographics");
  const [expandedVisit, setExpandedVisit] = useState<number | null>(null);

  // ── Empty state ──────────────────────────────────────────────────────
  if (!patient) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-6">
        <Heart className="w-12 h-12 mb-3 text-fordham-maroon/30" />
        <p className="t-small t-secondary">
          Select a patient to view their EHR chart
        </p>
      </div>
    );
  }

  // ── Sorted labs (date DESC) ──────────────────────────────────────────
  const sortedLabs = [...patient.labs].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  // ── Sorted visits (date DESC) ────────────────────────────────────────
  const sortedVisits = [...patient.visits].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  return (
    <div className="flex flex-col h-full">
      {/* ── Patient header ─────────────────────────────────────────────── */}
      <div className="px-3 py-2 border-b border-[#d6dfeb] bg-[#f4f7fb]/80">
        <p className="t-body font-semibold t-primary truncate">
          {patient.name}
        </p>
        <p className="t-micro t-secondary">
          {patient.id} &middot; {patient.age}y {patient.gender} &middot; DOB:{" "}
          {patient.dob}
        </p>
      </div>

      {/* ── Tab bar ────────────────────────────────────────────────────── */}
      <div className="flex border-b border-[#d6dfeb] bg-[#f8fbff] overflow-x-auto shrink-0">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1 px-2.5 py-2 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeTab === tab.id
                  ? "border-fordham-maroon text-fordham-maroon bg-white/60"
                  : "border-transparent t-secondary hover:text-fordham-maroon/70 hover:bg-white/40"
              }`}
            >
              <Icon className="w-3 h-3" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── Tab content ────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-3">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="space-y-2"
          >
            {/* ── Demographics ───────────────────────────────────────── */}
            {activeTab === "demographics" && (
              <div className="space-y-1">
                <InfoRow label="Name" value={patient.name} />
                <InfoRow label="ID" value={patient.id} mono />
                <InfoRow label="Age" value={`${patient.age} years`} />
                <InfoRow label="Gender" value={patient.gender} />
                <InfoRow label="Date of Birth" value={patient.dob} />
                <InfoRow label="Race" value={patient.race || "Not specified"} />
                <InfoRow
                  label="Ethnicity"
                  value={patient.ethnicity || "Not specified"}
                />
                <InfoRow
                  label="Language"
                  value={patient.language || "Not specified"}
                />
                <InfoRow
                  label="Marital Status"
                  value={patient.maritalStatus || "Not specified"}
                />
                <InfoRow
                  label="Insurance"
                  value={patient.insuranceType || "Not specified"}
                />
                <InfoRow label="Last Visit" value={patient.lastVisit} />

                {/* Allergies highlighted in red */}
                {patient.allergies.length > 0 ? (
                  <div className="mt-3">
                    <p className="text-xs font-semibold text-red-600 uppercase mb-1.5 tracking-wide">
                      Allergies
                    </p>
                    {patient.allergies.map((a, i) => (
                      <div
                        key={i}
                        className={`rounded-md p-2 text-xs border mb-1.5 ${
                          a.severity === "Severe/Anaphylaxis"
                            ? "border-red-400/60 bg-red-50"
                            : a.severity === "Moderate"
                            ? "border-orange-400/60 bg-orange-50"
                            : "border-yellow-400/60 bg-yellow-50"
                        }`}
                      >
                        <p className="t-primary font-medium">{a.allergen}</p>
                        <p className="t-secondary">
                          {a.reaction} &middot;{" "}
                          <span
                            className={
                              a.severity === "Severe/Anaphylaxis"
                                ? "text-red-600 font-semibold"
                                : a.severity === "Moderate"
                                ? "text-orange-600"
                                : "text-yellow-700"
                            }
                          >
                            {a.severity}
                          </span>
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-3 rounded-md p-2 text-xs border border-green-300/60 bg-green-50">
                    <p className="text-green-700">
                      NKDA -- No Known Drug Allergies
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* ── Problems ───────────────────────────────────────────── */}
            {activeTab === "problems" && (
              <div>
                {patient.conditions.length === 0 ? (
                  <EmptyState text="No active conditions" />
                ) : (
                  patient.conditions.map((c, i) => (
                    <div
                      key={`${c.code}-${i}`}
                      className="rounded-md p-2 text-xs border border-[#d6dfeb] bg-white/60 mb-1.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="t-primary font-medium">{c.display}</p>
                        <span className="shrink-0 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-green-100 text-green-700">
                          Active
                        </span>
                      </div>
                      <p className="t-secondary mt-0.5">
                        ICD:{" "}
                        <span className="font-mono text-fordham-maroon">
                          {c.code}
                        </span>{" "}
                        &middot; Onset: {c.onset}
                      </p>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* ── Labs ───────────────────────────────────────────────── */}
            {activeTab === "labs" && (
              <div>
                {sortedLabs.length === 0 ? (
                  <EmptyState text="No recent labs" />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-[#d6dfeb]">
                          <th className="text-left py-1.5 px-1 t-secondary font-semibold">
                            Name
                          </th>
                          <th className="text-right py-1.5 px-1 t-secondary font-semibold">
                            Value
                          </th>
                          <th className="text-left py-1.5 px-1 t-secondary font-semibold">
                            Unit
                          </th>
                          <th className="text-center py-1.5 px-1 t-secondary font-semibold">
                            Flag
                          </th>
                          <th className="text-right py-1.5 px-1 t-secondary font-semibold">
                            Date
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedLabs.map((l, i) => (
                          <tr
                            key={i}
                            className={`border-b border-[#d6dfeb]/50 ${
                              l.flag === "High"
                                ? "bg-red-50/60"
                                : l.flag === "Low"
                                ? "bg-blue-50/60"
                                : ""
                            }`}
                          >
                            <td className="py-1.5 px-1 t-primary">
                              {l.name}
                            </td>
                            <td className="py-1.5 px-1 text-right font-mono font-semibold">
                              <span
                                className={
                                  l.flag === "High"
                                    ? "text-red-600"
                                    : l.flag === "Low"
                                    ? "text-blue-600"
                                    : "text-green-700"
                                }
                              >
                                {l.value}
                              </span>
                            </td>
                            <td className="py-1.5 px-1 t-secondary">
                              {l.unit}
                            </td>
                            <td className="py-1.5 px-1 text-center">
                              <span
                                className={`inline-block px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
                                  l.flag === "High"
                                    ? "bg-red-100 text-red-700"
                                    : l.flag === "Low"
                                    ? "bg-blue-100 text-blue-700"
                                    : "bg-green-100 text-green-700"
                                }`}
                              >
                                {l.flag}
                              </span>
                            </td>
                            <td className="py-1.5 px-1 text-right t-secondary font-mono">
                              {l.date}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* ── Medications ────────────────────────────────────────── */}
            {activeTab === "meds" && (
              <div>
                {patient.medications.length === 0 ? (
                  <EmptyState text="No medications on file" />
                ) : (
                  patient.medications.map((m, i) => (
                    <div
                      key={i}
                      className={`rounded-md p-2 text-xs border mb-1.5 ${
                        m.status === "Active"
                          ? "border-green-300/60 bg-white/60"
                          : "border-[#d6dfeb] bg-gray-50 opacity-60"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`w-2 h-2 rounded-full shrink-0 ${
                              m.status === "Active"
                                ? "bg-green-500"
                                : "bg-gray-400"
                            }`}
                          />
                          <p className="t-primary font-medium">{m.name}</p>
                        </div>
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                            m.status === "Active"
                              ? "bg-green-100 text-green-700"
                              : "bg-gray-100 text-gray-500"
                          }`}
                        >
                          {m.status}
                        </span>
                      </div>
                      <p className="t-secondary mt-0.5 ml-3.5">
                        {m.dose} &middot; {m.frequency} &middot; {m.route}
                      </p>
                      <p className="t-tertiary mt-0.5 ml-3.5">
                        Started: {m.started}
                      </p>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* ── Visits ─────────────────────────────────────────────── */}
            {activeTab === "visits" && (
              <div>
                {sortedVisits.length === 0 ? (
                  <EmptyState text="No visit history" />
                ) : (
                  sortedVisits.map((v, i) => {
                    const isExpanded = expandedVisit === i;
                    return (
                      <div
                        key={i}
                        className="rounded-md text-xs border border-[#d6dfeb] bg-white/60 mb-2 overflow-hidden"
                      >
                        {/* Visit header -- click to expand */}
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedVisit(isExpanded ? null : i)
                          }
                          className="w-full text-left px-2.5 py-2 flex items-center justify-between hover:bg-[#f4f7fb] transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <span className="t-primary font-semibold">
                              {v.date}
                            </span>
                            <VisitTypeBadge type={v.type} />
                          </div>
                          <svg
                            className={`w-3.5 h-3.5 t-secondary transition-transform ${
                              isExpanded ? "rotate-180" : ""
                            }`}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 9l-7 7-7-7"
                            />
                          </svg>
                        </button>

                        {/* Chief complaint always visible */}
                        <div className="px-2.5 pb-1.5">
                          <p className="t-secondary">
                            <span className="t-tertiary font-medium">CC:</span>{" "}
                            {v.chiefComplaint}
                          </p>
                          <p className="t-tertiary">
                            Provider: {v.provider}
                          </p>
                        </div>

                        {/* Expandable detail */}
                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              className="overflow-hidden"
                            >
                              <div className="px-2.5 pb-2.5 pt-1 border-t border-[#d6dfeb]/60 space-y-1.5">
                                {/* Vitals */}
                                <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                                  <VitalChip
                                    label="BP"
                                    value={v.vitals.bp}
                                  />
                                  <VitalChip
                                    label="HR"
                                    value={`${v.vitals.hr} bpm`}
                                  />
                                  <VitalChip
                                    label="RR"
                                    value={`${v.vitals.rr}`}
                                  />
                                  <VitalChip
                                    label="SpO2"
                                    value={`${v.vitals.spo2}%`}
                                  />
                                  <VitalChip
                                    label="Temp"
                                    value={v.vitals.temp}
                                  />
                                  <VitalChip
                                    label="Wt"
                                    value={v.vitals.weight}
                                  />
                                </div>

                                {/* Assessment */}
                                <div>
                                  <p className="t-micro font-semibold t-secondary uppercase tracking-wide mb-0.5">
                                    Assessment
                                  </p>
                                  <p className="t-caption t-primary">
                                    {v.assessment}
                                  </p>
                                </div>

                                {/* Plan */}
                                <div>
                                  <p className="t-micro font-semibold t-secondary uppercase tracking-wide mb-0.5">
                                    Plan
                                  </p>
                                  <p className="t-caption t-primary whitespace-pre-wrap">
                                    {v.plan}
                                  </p>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* ── Immunizations ──────────────────────────────────────── */}
            {activeTab === "immunizations" && (
              <div>
                {patient.immunizations.length === 0 ? (
                  <EmptyState text="No immunization history" />
                ) : (
                  patient.immunizations.map((imm, i) => (
                    <div
                      key={i}
                      className="rounded-md p-2 text-xs border border-[#d6dfeb] bg-white/60 mb-1.5"
                    >
                      <p className="t-primary font-medium">{imm.name}</p>
                      <p className="t-secondary mt-0.5">
                        CVX:{" "}
                        <span className="font-mono text-fordham-maroon">
                          {imm.cvx}
                        </span>{" "}
                        &middot; {imm.date}
                      </p>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* ── Imaging ────────────────────────────────────────────── */}
            {activeTab === "imaging" && (
              <div>
                {!patient.imagingReports ||
                patient.imagingReports.length === 0 ? (
                  <EmptyState text="No imaging reports on file" />
                ) : (
                  patient.imagingReports.map((img, i) => (
                    <div
                      key={i}
                      className="rounded-md p-2.5 text-xs border border-[#d6dfeb] bg-white/60 mb-2"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5">
                          <ScanLine className="w-3 h-3 t-maroon" />
                          <span className="t-primary font-semibold">
                            {img.modality} -- {img.bodyPart}
                          </span>
                        </div>
                        <span className="t-tertiary font-mono">{img.date}</span>
                      </div>
                      <div className="space-y-1 ml-4.5">
                        <div>
                          <p className="t-micro font-semibold t-secondary uppercase tracking-wide">
                            Findings
                          </p>
                          <p className="t-caption t-primary">{img.findings}</p>
                        </div>
                        <div>
                          <p className="t-micro font-semibold t-secondary uppercase tracking-wide">
                            Impression
                          </p>
                          <p className="t-caption t-primary">
                            {img.impression}
                          </p>
                        </div>
                        <p className="t-micro t-tertiary">
                          Ordering: {img.orderingProvider}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* ── SDOH ───────────────────────────────────────────────── */}
            {activeTab === "sdoh" && (
              <div>
                {!patient.socialHistory ? (
                  <EmptyState text="No social determinants data on file" />
                ) : (
                  <div className="space-y-1">
                    <SDOHRow
                      label="Housing / Living Situation"
                      value={patient.socialHistory.livingSituation}
                      icon="home"
                    />
                    <SDOHRow
                      label="Employment / Occupation"
                      value={patient.socialHistory.occupation}
                      icon="work"
                    />
                    <SDOHRow
                      label="Exercise Frequency"
                      value={patient.socialHistory.exerciseFrequency}
                      icon="activity"
                    />
                    <SDOHRow
                      label="Tobacco / Smoking"
                      value={patient.socialHistory.smokingStatus}
                      icon="tobacco"
                    />
                    <SDOHRow
                      label="Alcohol Use"
                      value={patient.socialHistory.alcoholUse}
                      icon="alcohol"
                    />
                  </div>
                )}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function InfoRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex justify-between items-baseline py-1 border-b border-[#d6dfeb]/60">
      <span className="text-xs t-secondary">{label}</span>
      <span className={`text-xs t-primary ${mono ? "font-mono" : ""}`}>
        {value}
      </span>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <p className="text-xs t-secondary text-center py-6">{text}</p>
  );
}

function VisitTypeBadge({
  type,
}: {
  type: "Office Visit" | "ED Visit" | "Telehealth" | "Hospital Admission";
}) {
  const styles: Record<string, string> = {
    "ED Visit": "bg-red-100 text-red-700",
    "Hospital Admission": "bg-orange-100 text-orange-700",
    Telehealth: "bg-purple-100 text-purple-700",
    "Office Visit": "bg-blue-100 text-blue-700",
  };
  return (
    <span
      className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
        styles[type] || "bg-gray-100 text-gray-600"
      }`}
    >
      {type}
    </span>
  );
}

function VitalChip({ label, value }: { label: string; value: string }) {
  return (
    <span className="t-micro">
      <span className="t-tertiary font-medium">{label}</span>{" "}
      <span className="t-primary font-mono">{value}</span>
    </span>
  );
}

function SDOHRow({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: string;
}) {
  const iconMap: Record<string, string> = {
    home: "border-blue-200 bg-blue-50",
    work: "border-amber-200 bg-amber-50",
    food: "border-green-200 bg-green-50",
    education: "border-purple-200 bg-purple-50",
    tobacco: "border-red-200 bg-red-50",
    alcohol: "border-orange-200 bg-orange-50",
    activity: "border-teal-200 bg-teal-50",
  };

  return (
    <div
      className={`rounded-md p-2 text-xs border mb-1 ${
        iconMap[icon] || "border-[#d6dfeb] bg-white/60"
      }`}
    >
      <p className="t-secondary font-semibold text-[10px] uppercase tracking-wide mb-0.5">
        {label}
      </p>
      <p className="t-primary">{value}</p>
    </div>
  );
}
