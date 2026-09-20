import type { EHRState } from "./types";
import { initialState } from "./seed";

const DB_NAME = "fordham-ehr-practice-v3";
const STORE = "course-state";
const KEY = "active";

function storageUnavailable() {
  return typeof window !== "undefined" && new URLSearchParams(window.location.search).get("storage") === "unavailable";
}

export async function loadState(): Promise<EHRState | null> {
  if (typeof indexedDB === "undefined" || storageUnavailable()) throw new Error("IndexedDB is unavailable");
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 2);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE);
    };
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const tx = request.result.transaction(STORE, "readonly");
      const get = tx.objectStore(STORE).get(KEY);
      get.onsuccess = () => resolve(get.result ? normalizeState(get.result) : null);
      get.onerror = () => reject(get.error);
    };
  });
}

export async function saveState(state: EHRState): Promise<void> {
  if (typeof indexedDB === "undefined" || storageUnavailable()) throw new Error("IndexedDB is unavailable");
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 2);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE);
    };
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const tx = request.result.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(state, KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    };
  });
}

export function normalizeState(value: unknown): EHRState {
  if (!value || typeof value !== "object") throw new Error("Invalid workspace");
  const raw = value as Partial<EHRState> & { version?: number };
  if (![1, 2].includes(raw.version ?? 0) || !Array.isArray(raw.patients)) throw new Error("Unsupported workspace version");
  const exerciseMap = new Map((raw.exercises ?? []).map((exercise) => [exercise.id, exercise]));
  return {
    ...initialState,
    ...raw,
    version: 2,
    exercises: initialState.exercises.map((template) => ({ ...template, ...(exerciseMap.get(template.id) ?? {}) })),
    exchanges: raw.exchanges ?? initialState.exchanges,
    identityReviews: raw.identityReviews ?? initialState.identityReviews,
    queryRuns: raw.queryRuns ?? [],
    implementation: raw.implementation ?? initialState.implementation,
  };
}
