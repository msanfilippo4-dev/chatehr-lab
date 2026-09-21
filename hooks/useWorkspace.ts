"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { postJson } from "@/lib/api";
import { loadState, normalizeState, saveState } from "@/lib/db";
import { buildInitialState } from "@/lib/seed";
import { ehrReducer, type ActionMeta, type WorkspaceAction } from "@/lib/store/reducer";
import type { EHRState, ProgressRow, Role } from "@/lib/types";

export type StorageTone = "ok" | "busy" | "error";

interface Options {
  owner: string;
  role: Role;
  enabled: boolean;
  readOnly: boolean;
  cloudWorkspace: EHRState | null | undefined;
  /** Changing this key re-hydrates from `cloudWorkspace` (e.g. entering or leaving preview). */
  hydrateKey: string;
  onProgress: (rows: ProgressRow[]) => void;
}

export function makeId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function reducerWithMeta(state: EHRState, action: WorkspaceAction & { meta: ActionMeta }) {
  return ehrReducer(state, action, action.meta);
}

export function useWorkspace(options: Options) {
  const { owner, role, enabled, readOnly, cloudWorkspace, hydrateKey, onProgress } = options;
  const [state, rawDispatch] = useReducer(reducerWithMeta, undefined, () => buildInitialState(undefined, owner));
  const [ready, setReady] = useState(false);
  const [storage, setStorage] = useState<{ message: string; tone: StorageTone }>({ message: "Loading your Fordham course workspace…", tone: "busy" });
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const roleRef = useRef(role);
  roleRef.current = role;
  const readOnlyRef = useRef(readOnly);
  readOnlyRef.current = readOnly;
  const cloudRef = useRef(cloudWorkspace);
  cloudRef.current = cloudWorkspace;

  const dispatch = useCallback((action: WorkspaceAction) => {
    if (readOnlyRef.current && action.type !== "replace") {
      setStorage({ message: "Preview mode: changes are not saved.", tone: "error" });
      return;
    }
    rawDispatch({ ...action, meta: { at: new Date().toISOString(), actor: owner || "learner", role: roleRef.current, makeId } });
  }, [owner]);

  // Hydrate once per key: cloud workspace wins, then local recovery copy, then a fresh workspace.
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const cloudWorkspace = cloudRef.current;
    setReady(false);
    (async () => {
      let local: EHRState | null = null;
      let localFailed = false;
      try {
        local = await loadState();
      } catch {
        localFailed = true;
      }
      if (cancelled) return;
      if (cloudWorkspace) {
        try {
          rawDispatch({ type: "replace", state: normalizeState(cloudWorkspace, owner), meta: { at: new Date().toISOString(), actor: owner, role: roleRef.current, makeId } });
          setStorage({ message: "Your saved Fordham course workspace was restored.", tone: "ok" });
        } catch {
          setStorage({ message: "The saved workspace could not be read. A fresh workspace was created; contact the instructor if work is missing.", tone: "error" });
        }
      } else if (local) {
        rawDispatch({ type: "replace", state: normalizeState(local, owner), meta: { at: new Date().toISOString(), actor: owner, role: roleRef.current, makeId } });
        setStorage({ message: "Your browser workspace was restored and will now sync to your Fordham account.", tone: "ok" });
      } else {
        rawDispatch({ type: "replace", state: buildInitialState(undefined, owner), meta: { at: new Date().toISOString(), actor: owner, role: roleRef.current, makeId } });
        setStorage({ message: localFailed ? "Browser storage is unavailable. Work will still save to your Fordham account." : "A new Fordham course workspace was created.", tone: localFailed ? "error" : "ok" });
      }
      setReady(true);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, hydrateKey, owner]);

  // Persist locally and sync to the cloud (debounced) on every change.
  useEffect(() => {
    if (!ready || !enabled || readOnly) return;
    saveState(state).catch(() => setStorage((current) => (current.tone === "error" ? current : { message: "Browser storage is unavailable. Course sync will continue.", tone: "error" })));
    if (syncTimer.current) clearTimeout(syncTimer.current);
    setStorage({ message: "Saving to your Fordham course account…", tone: "busy" });
    syncTimer.current = setTimeout(async () => {
      try {
        const payload = await postJson<{ savedAt: string; progress: ProgressRow[] }>("/api/course/sync", { workspace: state });
        onProgress(payload.progress);
        setStorage({ message: `Saved to your Fordham course account at ${new Date(payload.savedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}.`, tone: "ok" });
      } catch (error) {
        setStorage({ message: error instanceof Error && error.message ? `Cloud save failed: ${error.message} Work remains in this browser; export evidence before leaving.` : "Cloud save failed. Work remains in this browser; export evidence before leaving.", tone: "error" });
      }
    }, 900);
    return () => { if (syncTimer.current) clearTimeout(syncTimer.current); };
  }, [state, ready, enabled, readOnly, onProgress]);

  const replace = useCallback((next: EHRState, message?: string) => {
    rawDispatch({ type: "replace", state: next, meta: { at: new Date().toISOString(), actor: owner, role: roleRef.current, makeId } });
    if (message) setStorage({ message, tone: "ok" });
  }, [owner]);

  const flushSync = useCallback(async () => {
    if (syncTimer.current) clearTimeout(syncTimer.current);
    const payload = await postJson<{ savedAt: string; progress: ProgressRow[] }>("/api/course/sync", { workspace: state });
    onProgress(payload.progress);
    setStorage({ message: `Saved to your Fordham course account at ${new Date(payload.savedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}.`, tone: "ok" });
    return payload;
  }, [state, onProgress]);

  return { state, dispatch, replace, ready, storage, setStorage, flushSync };
}
