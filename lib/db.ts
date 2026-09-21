import type { AuditEvent, EHRState } from "./types";
import { AUDIT_LIMIT } from "./types";
import { buildInitialState } from "./seed";

const DB_NAME = "fordham-ehr-practice-v3";
const STORE = "course-state";
const KEY = "active";
export const EXPORT_FORMAT = "fordms-workspace-export";
export const EXPORT_FORMAT_VERSION = 3;

function storageUnavailable() {
  return typeof window !== "undefined" && new URLSearchParams(window.location.search).get("storage") === "unavailable";
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 3);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE);
    };
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

export async function loadState(): Promise<EHRState | null> {
  if (typeof indexedDB === "undefined" || storageUnavailable()) throw new Error("IndexedDB is unavailable");
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const get = tx.objectStore(STORE).get(KEY);
    get.onsuccess = () => {
      try {
        resolve(get.result ? normalizeState(get.result) : null);
      } catch (error) {
        reject(error);
      }
    };
    get.onerror = () => reject(get.error);
  });
}

export async function saveState(state: EHRState): Promise<void> {
  if (typeof indexedDB === "undefined" || storageUnavailable()) throw new Error("IndexedDB is unavailable");
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(state, KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function clearLocalState(): Promise<void> {
  if (typeof indexedDB === "undefined" || storageUnavailable()) return;
  const db = await open();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

type LooseState = Partial<EHRState> & { version?: number; exercises?: unknown };

/**
 * Upgrade any stored workspace (schema version 1, 2, or 3) to the current
 * version 3 shape. Unknown collections are defaulted; unknown versions are rejected.
 */
export function normalizeState(value: unknown, owner?: string): EHRState {
  if (!value || typeof value !== "object") throw new Error("Invalid workspace");
  const raw = value as LooseState;
  if (![1, 2, 3].includes(raw.version ?? 0) || !Array.isArray(raw.patients) || raw.patients.length === 0) {
    throw new Error("Unsupported workspace version");
  }
  const base = buildInitialState();
  const audit: AuditEvent[] = Array.isArray(raw.audit) ? raw.audit.filter((event) => event && typeof event === "object" && typeof (event as AuditEvent).id === "string").slice(0, AUDIT_LIMIT) : [];
  const meta = { ...base.meta, ...(raw.meta ?? {}) };
  if (owner) meta.owner = owner;
  return {
    version: 3,
    meta,
    appointments: raw.appointments ?? base.appointments,
    patients: raw.patients,
    orders: raw.orders ?? [],
    tasks: raw.tasks ?? base.tasks,
    messages: raw.messages ?? base.messages,
    audit,
    exchanges: raw.exchanges ?? base.exchanges,
    identityReviews: raw.identityReviews ?? base.identityReviews,
    queryRuns: raw.queryRuns ?? [],
    savedQueries: raw.savedQueries ?? [],
    implementation: raw.implementation ?? base.implementation,
    registrations: raw.registrations ?? [],
    eligibilityChecks: raw.eligibilityChecks ?? [],
    referrals: raw.referrals ?? [],
    waitlist: raw.waitlist ?? [],
    aiReviews: raw.aiReviews ?? [],
  };
}

export interface ExportEnvelope {
  format: typeof EXPORT_FORMAT;
  formatVersion: number;
  exportedAt: string;
  exportedBy: string;
  workspace: EHRState;
}

export function exportEnvelope(state: EHRState, exportedBy: string): ExportEnvelope {
  return { format: EXPORT_FORMAT, formatVersion: EXPORT_FORMAT_VERSION, exportedAt: new Date().toISOString(), exportedBy, workspace: state };
}

/**
 * Parse an exported file (or a bare workspace) and mark every audit event
 * that lacks provenance as imported. Imported evidence is shown separately
 * and never outranks evidence earned in the current workspace.
 */
export function importEnvelope(text: string, owner: string): { state: EHRState; exportedAt?: string; exportedBy?: string; eventCount: number } {
  const parsed = JSON.parse(text) as Partial<ExportEnvelope> & LooseState;
  const candidate = parsed.format === EXPORT_FORMAT && parsed.workspace ? parsed.workspace : parsed;
  const state = normalizeState(candidate, owner);
  const audit = state.audit.map((event) => ({ ...event, provenance: "imported" as const }));
  return {
    state: { ...state, audit, meta: { ...state.meta, owner, lastImportAt: new Date().toISOString() } },
    exportedAt: parsed.format === EXPORT_FORMAT ? parsed.exportedAt : undefined,
    exportedBy: parsed.format === EXPORT_FORMAT ? parsed.exportedBy : undefined,
    eventCount: audit.length,
  };
}
