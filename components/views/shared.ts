import type { CourseConfig } from "@/lib/config/types";
import type { View } from "@/lib/config/defaults";
import type { WorkspaceAction } from "@/lib/store/reducer";
import type { EHRState, Patient, Role } from "@/lib/types";

export interface ViewProps {
  state: EHRState;
  dispatch: (action: WorkspaceAction) => void;
  config: CourseConfig;
  patient: Patient;
  role: Role;
  selectPatient: (id: string, view?: View) => void;
  setView: (view: View) => void;
  makeId: (prefix: string) => string;
  readOnly: boolean;
}

export function nowIso() {
  return new Date().toISOString();
}

export function download(name: string, value: string, type = "application/json") {
  const url = URL.createObjectURL(new Blob([value], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

export function formatWhen(iso: string | null | undefined) {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function providerName(config: CourseConfig, id: string | undefined, fallback: string) {
  return config.providers.find((provider) => provider.id === id)?.name ?? fallback;
}
