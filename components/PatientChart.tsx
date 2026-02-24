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
} from "lucide-react";
import { Patient } from "@/lib/types";

interface PatientChartProps {
  patient: Patient | null;
}

const tabs = [
  { id: "demographics", label: "Demographics", icon: User, color: "text-gray-100" },
  { id: "problems", label: "Problems", icon: AlertCircle, color: "text-gray-100" },
  { id: "labs", label: "Labs", icon: Activity, color: "text-gray-100" },
  { id: "meds", label: "Meds", icon: Pill, color: "text-gray-100" },
  { id: "visits", label: "Visits", icon: Calendar, color: "text-gray-100" },
  { id: "immunizations", label: "Immun.", icon: Syringe, color: "text-gray-100" },
] as const;

type TabId = (typeof tabs)[number]["id"];

export default function PatientChart({ patient }: PatientChartProps) {
  const [activeTab, setActiveTab] = useState<TabId>("demographics");

  if (!patient) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center text-gray-500 p-6">
        <Heart className="w-12 h-12 mb-3 opacity-30" />
        <p className="text-sm">Select a patient to view their EHR chart</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Patient header */}
      <div className="px-3 py-2 bg-gray-800/60 border-b border-gray-700">
        <p className="text-sm font-semibold text-[#122033] truncate">
          {patient.name}
        </p>
        <p className="text-xs text-gray-400">
          {patient.id} · {patient.age}y {patient.gender} · DOB: {patient.dob}
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-gray-700 bg-gray-800/40 overflow-x-auto shrink-0">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1 px-2.5 py-2 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeTab === tab.id
                  ? `border-[#8C1515] ${tab.color} bg-gray-800/60`
                  : "border-transparent text-gray-500 hover:text-gray-300 hover:bg-gray-800/30"
              }`}
            >
              <Icon className="w-3 h-3" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
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
            {activeTab === "demographics" && (
              <div className="space-y-1">
                <InfoRow label="Name" value={patient.name} />
                <InfoRow label="ID" value={patient.id} mono />
                <InfoRow label="Age" value={`${patient.age} years`} />
                <InfoRow label="Gender" value={patient.gender} />
                <InfoRow label="Date of Birth" value={patient.dob} />
                <InfoRow label="Last Visit" value={patient.lastVisit} />
                {patient.allergies.length > 0 && (
                  <div className="mt-3">
                    <p className="text-xs font-semibold text-red-400 uppercase mb-1.5">
                      Allergies
                    </p>
                    {patient.allergies.map((a, i) => (
                      <div
                        key={i}
                        className={`rounded-md p-2 text-xs border mb-1.5 ${
                          a.severity === "Severe/Anaphylaxis"
                            ? "border-red-700/60 bg-red-900/20"
                            : a.severity === "Moderate"
                            ? "border-orange-700/60 bg-orange-900/20"
                            : "border-yellow-700/60 bg-yellow-900/20"
                        }`}
                      >
                        <p className="text-gray-200 font-medium">{a.allergen}</p>
                        <p className="text-gray-400">
                          {a.reaction} ·{" "}
                          <span
                            className={
                              a.severity === "Severe/Anaphylaxis"
                                ? "text-red-400"
                                : a.severity === "Moderate"
                                ? "text-orange-400"
                                : "text-yellow-400"
                            }
                          >
                            {a.severity}
                          </span>
                        </p>
                      </div>
                    ))}
                  </div>
                )}
                {patient.allergies.length === 0 && (
                  <div className="mt-3 rounded-md p-2 text-xs border border-green-800/30 bg-green-900/10">
                    <p className="text-green-400">NKDA — No Known Drug Allergies</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === "problems" && (
              <div>
                {patient.conditions.length === 0 ? (
                  <p className="text-xs text-gray-500 text-center py-4">
                    No active conditions
                  </p>
                ) : (
                  patient.conditions.map((c) => (
                    <div
                      key={c.code}
                      className="rounded-md p-2 text-xs border border-gray-700/50 bg-gray-900/40 mb-1.5"
                    >
                      <p className="text-gray-100 font-medium">{c.display}</p>
                      <p className="text-gray-500 mt-0.5">
                        Code: <span className="font-mono">{c.code}</span> · Onset:{" "}
                        {c.onset}
                      </p>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === "labs" && (
              <div>
                {patient.labs.length === 0 ? (
                  <p className="text-xs text-gray-500 text-center py-4">
                    No recent labs
                  </p>
                ) : (
                  patient.labs.map((l, i) => (
                    <div
                      key={i}
                      className={`rounded-md p-2 text-xs border mb-1.5 flex justify-between items-center ${
                        l.flag === "High"
                          ? "border-red-800/60 bg-red-900/10 border-l-2 border-l-red-500"
                          : l.flag === "Low"
                          ? "border-yellow-800/60 bg-yellow-900/10 border-l-2 border-l-yellow-500"
                          : "border-gray-700/50 bg-gray-900/40"
                      }`}
                    >
                      <div>
                        <p className="text-gray-200">{l.name}</p>
                        <p className="text-gray-500">{l.date}</p>
                      </div>
                      <div className="text-right">
                        <span
                          className={`font-mono font-bold ${
                            l.flag !== "Normal"
                              ? l.flag === "High"
                                ? "text-red-400"
                                : "text-yellow-400"
                              : "text-gray-300"
                          }`}
                        >
                          {l.value}{" "}
                          <span className="text-gray-500 font-normal text-xs">
                            {l.unit}
                          </span>
                        </span>
                        {l.flag !== "Normal" && (
                          <p
                            className={`text-xs ${
                              l.flag === "High" ? "text-red-400" : "text-yellow-400"
                            }`}
                          >
                            {l.flag}
                          </p>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === "meds" && (
              <div>
                {patient.medications.length === 0 ? (
                  <p className="text-xs text-gray-500 text-center py-4">
                    No medications on file
                  </p>
                ) : (
                  patient.medications.map((m, i) => (
                    <div
                      key={i}
                      className={`rounded-md p-2 text-xs border mb-1.5 ${
                        m.status === "Active"
                          ? "border-green-800/40 bg-green-900/10"
                          : "border-gray-700/30 bg-gray-900/20 opacity-60"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-gray-100 font-medium">{m.name}</p>
                        <span
                          className={`text-xs px-1.5 py-0.5 rounded-full ${
                            m.status === "Active"
                              ? "bg-green-900/50 text-green-400"
                              : "bg-gray-800 text-gray-500"
                          }`}
                        >
                          {m.status}
                        </span>
                      </div>
                      <p className="text-gray-400 mt-0.5">
                        {m.dose} · {m.frequency} · {m.route}
                      </p>
                      <p className="text-gray-600 mt-0.5">Started: {m.started}</p>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === "visits" && (
              <div>
                {patient.visits.length === 0 ? (
                  <p className="text-xs text-gray-500 text-center py-4">
                    No visit history
                  </p>
                ) : (
                  patient.visits.map((v, i) => (
                    <div
                      key={i}
                      className="rounded-md p-2.5 text-xs border border-gray-700/50 bg-gray-900/40 mb-2"
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-semibold text-gray-200">
                          {v.date}
                        </span>
                        <span
                          className={`text-xs px-1.5 py-0.5 rounded-full ${
                            v.type === "ED Visit"
                              ? "bg-red-900/50 text-red-400"
                              : v.type === "Hospital Admission"
                              ? "bg-orange-900/50 text-orange-400"
                              : v.type === "Telehealth"
                              ? "bg-purple-900/50 text-purple-400"
                              : "bg-blue-900/50 text-blue-400"
                          }`}
                        >
                          {v.type}
                        </span>
                      </div>
                      <p className="text-gray-400 mb-1">
                        <span className="text-gray-500">CC:</span>{" "}
                        {v.chiefComplaint}
                      </p>
                      <p className="text-gray-400 mb-1">
                        <span className="text-gray-500">Provider:</span>{" "}
                        {v.provider}
                      </p>
                      <div className="mt-1.5 pt-1.5 border-t border-gray-700/50">
                        <p className="text-gray-300 mb-1">
                          <span className="text-gray-500 font-medium">
                            Assessment:
                          </span>{" "}
                          {v.assessment}
                        </p>
                        <p className="text-gray-500">
                          <span className="font-medium text-gray-400">
                            Vitals:
                          </span>{" "}
                          BP {v.vitals.bp} · HR {v.vitals.hr} · SpO₂{" "}
                          {v.vitals.spo2}% · Wt {v.vitals.weight}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === "immunizations" && (
              <div>
                {patient.immunizations.length === 0 ? (
                  <p className="text-xs text-gray-500 text-center py-4">
                    No immunization history
                  </p>
                ) : (
                  patient.immunizations.map((imm, i) => (
                    <div
                      key={i}
                      className="rounded-md p-2 text-xs border border-gray-700/50 bg-gray-900/40 mb-1.5"
                    >
                      <p className="text-gray-200">{imm.name}</p>
                      <p className="text-gray-500 mt-0.5">
                        CVX: <span className="font-mono">{imm.cvx}</span> ·{" "}
                        {imm.date}
                      </p>
                    </div>
                  ))
                )}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

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
    <div className="flex justify-between items-baseline py-1 border-b border-gray-800/60">
      <span className="text-xs text-gray-500">{label}</span>
      <span className={`text-xs text-gray-200 ${mono ? "font-mono" : ""}`}>
        {value}
      </span>
    </div>
  );
}
