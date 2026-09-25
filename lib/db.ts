import type { AuditEvent, EHRState, Patient } from "./types";
import { AUDIT_LIMIT } from "./types";
import { buildInitialState } from "./seed";

const DB_NAME = "fordham-ehr-practice-v3";
const STORE = "course-state";
const KEY = "active";
export const EXPORT_FORMAT = "fordms-workspace-export";
export const EXPORT_FORMAT_VERSION = 4;

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

/** Placeholder addresses produced by the v1–v3 formula seed. */
const LEGACY_ADDRESS = /^\d+ Example Avenue, New York, NY 100\d\d$/;
/** Identity fields that FORDMS-A1 (duplicate detection, MPI signals) depends on. */
const A1_IDENTITY_PATIENTS = new Set(["PT-001", "PT-012"]);

/**
 * Upgrade one seeded patient from a v1–v3 workspace to the v4 hand-authored chart.
 * The learner cannot edit problems, medications, allergies, vitals, or results, so those
 * lists are still the old formula seed and are replaced. Identity (id, MRN, name, DOB,
 * phone, and the PT-001/PT-012 addresses), proxy settings, learner notes, and any
 * registration data are kept. Seeded prior notes are added ahead of learner notes.
 */
export function upgradeSeedPatient(existing: Patient, seed: Patient): Patient {
  const learnerNotes = existing.notes ?? [];
  const noteIds = new Set(learnerNotes.map((note) => note.id));
  const seededNotes = seed.notes.filter((note) => !noteIds.has(note.id));
  const keepAddress = A1_IDENTITY_PATIENTS.has(existing.id) || !LEGACY_ADDRESS.test(existing.address ?? "");
  return {
    ...seed,
    id: existing.id,
    mrn: existing.mrn,
    name: existing.name,
    dob: existing.dob,
    phone: existing.phone ?? seed.phone,
    address: keepAddress ? existing.address : seed.address,
    duplicateCandidate: existing.duplicateCandidate ?? seed.duplicateCandidate,
    proxyAccess: existing.proxyAccess ?? seed.proxyAccess,
    registeredAt: existing.registeredAt,
    notes: [...seededNotes, ...learnerNotes],
  };
}

function mergeById<T extends { id: string }>(current: T[] | undefined, seed: T[]): T[] {
  if (!Array.isArray(current)) return seed;
  const ids = new Set(current.map((item) => item.id));
  return [...current, ...seed.filter((item) => !ids.has(item.id))];
}

/**
 * Upgrade any stored workspace (schema version 1–4) to the current version 4 shape.
 *
 * The v3 → v4 step is non-destructive: every existing collection, audit event, and id is
 * kept; seeded charts gain the v4 clinical detail; new seed rows (messages, tasks,
 * appointments) are appended only when their ids are absent; and the v4 slices (eMAR,
 * flowsheets, In Basket, claims, tickets) are added from the seed when missing.
 * Unknown versions are rejected.
 */
export function normalizeState(value: unknown, owner?: string): EHRState {
  if (!value || typeof value !== "object") throw new Error("Invalid workspace");
  const raw = value as LooseState;
  if (![1, 2, 3, 4].includes(raw.version ?? 0) || !Array.isArray(raw.patients) || raw.patients.length === 0) {
    throw new Error("Unsupported workspace version");
  }
  const base = buildInitialState();
  const audit: AuditEvent[] = Array.isArray(raw.audit) ? raw.audit.filter((event) => event && typeof event === "object" && typeof (event as AuditEvent).id === "string").slice(0, AUDIT_LIMIT) : [];
  const meta = { ...base.meta, ...(raw.meta ?? {}) };
  if (owner) meta.owner = owner;
  const upgrading = (raw.version ?? 0) < 4;
  const seedById = new Map(base.patients.map((patient) => [patient.id, patient]));
  const patients = upgrading
    ? raw.patients.map((patient) => {
        const seed = seedById.get(patient.id);
        return seed ? upgradeSeedPatient(patient, seed) : patient;
      })
    : raw.patients;
  return {
    version: 4,
    meta,
    appointments: upgrading ? mergeById(raw.appointments, base.appointments) : raw.appointments ?? base.appointments,
    patients,
    orders: raw.orders ?? [],
    tasks: upgrading ? mergeById(raw.tasks, base.tasks) : raw.tasks ?? base.tasks,
    messages: upgrading ? mergeById(raw.messages, base.messages) : raw.messages ?? base.messages,
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
    marOrders: raw.marOrders ?? base.marOrders,
    marAdministrations: raw.marAdministrations ?? base.marAdministrations,
    marScans: raw.marScans ?? [],
    flowsheets: raw.flowsheets ?? base.flowsheets,
    inBasket: raw.inBasket ?? base.inBasket,
    claims: raw.claims ?? base.claims,
    tickets: raw.tickets ?? base.tickets,
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
