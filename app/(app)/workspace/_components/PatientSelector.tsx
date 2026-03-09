"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Search, User, AlertTriangle } from "lucide-react";
import type { Patient } from "@/lib/types";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface PatientSelectorProps {
  onSelectPatient: (patient: Patient) => void;
  selectedPatientId: string | null;
}

interface PatientListResponse {
  patients: Patient[];
  total: number;
  page: number;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function PatientSelector({
  onSelectPatient,
  selectedPatientId,
}: PatientSelectorProps) {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [patients, setPatients] = useState<Patient[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);

  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // ── Debounce search input (300ms) ────────────────────────────────────
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(0);
      setPatients([]);
      setHasMore(true);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // ── Fetch patients from API ──────────────────────────────────────────
  const fetchPatients = useCallback(
    async (pageNum: number, searchTerm: string, append: boolean) => {
      setIsLoading(true);
      try {
        const params = new URLSearchParams({
          page: String(pageNum),
          limit: "50",
        });
        if (searchTerm.trim()) {
          params.set("search", searchTerm.trim());
        }

        const res = await fetch(`/api/patients?${params.toString()}`);
        if (!res.ok) throw new Error("Failed to fetch patients");

        const data: PatientListResponse = await res.json();

        if ((data.patients?.length ?? 0) < 50) {
          setHasMore(false);
        }

        setPatients((prev) =>
          append ? [...prev, ...(data.patients ?? [])] : data.patients ?? []
        );
      } catch (err) {
        console.error("PatientSelector fetch error:", err);
      } finally {
        setIsLoading(false);
        setInitialLoad(false);
      }
    },
    []
  );

  // ── Trigger fetch on search / page changes ──────────────────────────
  useEffect(() => {
    fetchPatients(page, debouncedSearch, page > 0);
  }, [debouncedSearch, page, fetchPatients]);

  // ── Infinite scroll via IntersectionObserver ─────────────────────────
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoading) {
          setPage((prev) => prev + 1);
        }
      },
      { root: scrollRef.current, threshold: 0.1 }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, isLoading]);

  return (
    <div className="flex flex-col h-full">
      {/* ── Header ───────────────────────────────────────────────────── */}
      <div className="px-3 py-2 border-b border-[#d6dfeb] bg-[#f8fbff] shrink-0">
        <label className="t-micro font-semibold t-secondary uppercase tracking-wider flex items-center gap-1 mb-2">
          <User className="w-3.5 h-3.5" />
          Patient Select
        </label>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 t-tertiary" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or ID..."
            className="w-full bg-white border border-[#d6dfeb] t-primary text-xs rounded-lg pl-8 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-fordham-maroon/40 focus:border-fordham-maroon/60 placeholder:t-tertiary transition-colors"
          />
        </div>
      </div>

      {/* ── Patient list ─────────────────────────────────────────────── */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {initialLoad ? (
          <div className="space-y-2 p-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="h-14 animate-pulse rounded-lg bg-gray-100"
              />
            ))}
          </div>
        ) : patients.length === 0 && !isLoading ? (
          <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
            <Search className="w-8 h-8 t-tertiary mb-2 opacity-40" />
            <p className="t-small t-secondary">No patients found</p>
            {debouncedSearch && (
              <p className="t-caption t-tertiary mt-1">
                Try a different search term
              </p>
            )}
          </div>
        ) : (
          <div className="p-1.5 space-y-1">
            {patients.map((p) => {
              const isSelected = p.id === selectedPatientId;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onSelectPatient(p)}
                  className={`w-full text-left rounded-lg px-2.5 py-2 transition-all ${
                    isSelected
                      ? "border-2 border-fordham-maroon bg-fordham-maroon/5 shadow-sm"
                      : "border border-transparent hover:border-[#d6dfeb] hover:bg-[#f8fbff]"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <p
                      className={`t-small font-medium truncate ${
                        isSelected ? "t-maroon" : "t-primary"
                      }`}
                    >
                      {p.name}
                    </p>
                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                      {p.isComplex && (
                        <span className="flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-semibold">
                          <AlertTriangle className="w-2.5 h-2.5" />
                          Complex
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="t-micro t-mono t-secondary">{p.id}</span>
                    <span className="t-micro t-tertiary">
                      {p.age}y {p.gender}
                    </span>
                    <span className="t-micro t-tertiary">
                      last visit {p.lastVisit}
                    </span>
                  </div>
                </button>
              );
            })}

            {/* Sentinel for infinite scroll */}
            <div ref={sentinelRef} className="h-1" />

            {/* Loading more indicator */}
            {isLoading && !initialLoad && (
              <div className="flex justify-center py-3">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full border-2 border-fordham-maroon/40 border-t-fordham-maroon animate-spin" />
                  <span className="t-micro t-secondary">
                    Loading more patients...
                  </span>
                </div>
              </div>
            )}

            {/* End of list */}
            {!hasMore && patients.length > 0 && (
              <p className="text-center t-micro t-tertiary py-2">
                {patients.length} patient{patients.length !== 1 ? "s" : ""}{" "}
                loaded
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
