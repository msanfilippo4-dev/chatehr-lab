"use client";
import React from "react";
import { ShieldAlert, Shield, ShieldCheck, AlertTriangle } from "lucide-react";

interface ContextLevelBadgeProps {
  level: "LIMITED" | "STANDARD" | "FULL";
}

const levelConfig = {
  LIMITED: {
    icon: ShieldAlert,
    color: "text-amber-700",
    bg: "bg-amber-50",
    border: "border-amber-200",
    label: "LIMITED Context",
    description:
      "Only age, gender, and a zip prefix are sent to the AI. It will struggle to answer clinical questions.",
    privacy:
      "Lowest PHI exposure — but note: age + zip prefix alone can still be re-identifying.",
    privacyColor: "text-amber-700",
  },
  STANDARD: {
    icon: Shield,
    color: "text-blue-700",
    bg: "bg-blue-50",
    border: "border-blue-200",
    label: "STANDARD Context",
    description:
      "Full structured EHR data sent: name, conditions, labs, meds, allergies, immunizations.",
    privacy:
      "Contains PHI (name + diagnoses). Compliant only within a covered entity with appropriate BAA.",
    privacyColor: "text-blue-700",
  },
  FULL: {
    icon: ShieldCheck,
    color: "text-green-700",
    bg: "bg-green-50",
    border: "border-green-200",
    label: "FULL Context",
    description:
      "All structured data + complete visit notes with clinical narrative text.",
    privacy:
      "Highest PHI exposure. Visit notes often contain incidental PHI: family info, social history, sensitive diagnoses.",
    privacyColor: "text-green-700",
  },
};

export default function ContextLevelBadge({ level }: ContextLevelBadgeProps) {
  const cfg = levelConfig[level];
  const Icon = cfg.icon;

  return (
    <div className={`rounded-lg border ${cfg.border} ${cfg.bg} p-3`}>
      <div className="flex items-center gap-2 mb-1.5">
        <Icon className={`w-4 h-4 ${cfg.color}`} />
        <span className={`text-xs font-bold ${cfg.color}`}>{cfg.label}</span>
      </div>
      <p className="text-xs text-gray-400 mb-2">{cfg.description}</p>
      <div className="flex items-start gap-1.5">
        <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0 mt-0.5" />
        <p className={`text-xs ${cfg.privacyColor}`}>{cfg.privacy}</p>
      </div>
    </div>
  );
}
