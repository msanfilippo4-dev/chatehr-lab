"use client";
import React, { useState, useMemo, useEffect, useRef } from "react";
import { Search, User } from "lucide-react";
import { Patient } from "@/lib/types";

interface PatientSelectorProps {
  patients: Patient[];
  selectedPatientId: string;
  onSelect: (patientId: string) => void;
  isLoading: boolean;
}

export default function PatientSelector({
  patients,
  selectedPatientId,
  onSelect,
  isLoading,
}: PatientSelectorProps) {
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerButtonRef = useRef<HTMLButtonElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const frame = requestAnimationFrame(() => {
      searchInputRef.current?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [isOpen]);

  const filtered = useMemo(() => {
    if (!search.trim()) return patients.slice(0, 50);
    const q = search.toLowerCase();
    return patients
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q)
      )
      .slice(0, 50);
  }, [patients, search]);

  const selected = patients.find((p) => p.id === selectedPatientId);

  const handleSelect = (patientId: string) => {
    onSelect(patientId);
    setIsOpen(false);
    setSearch("");
    requestAnimationFrame(() => {
      triggerButtonRef.current?.focus({ preventScroll: true });
    });
  };

  return (
    <div className="relative" ref={containerRef}>
      <label className="t-micro font-semibold t-secondary uppercase tracking-wider flex items-center gap-1 mb-2">
        <User className="w-3.5 h-3.5" />
        Patient Select
      </label>

      {isLoading ? (
        <div className="h-10 animate-pulse bg-gray-700 rounded-lg w-full" />
      ) : (
        <div className="relative">
          <button
            type="button"
            ref={triggerButtonRef}
            onClick={() => setIsOpen(!isOpen)}
            aria-expanded={isOpen}
            aria-haspopup="listbox"
            className="w-full bg-white border border-[#d6dfeb] text-left text-sm rounded-lg p-2.5 flex items-center justify-between focus:outline-none focus:ring-2 focus:ring-[#8C1515]/60 hover:border-[#bfcde0] transition-colors"
          >
            <span className={`truncate pr-2 ${selected ? "text-[#122033]" : "text-gray-500"}`}>
              {selected
                ? `${selected.name} (${selected.id})`
                : "Select a patient..."}
            </span>
            <svg
              className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
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

          {isOpen && (
            <div className="absolute z-50 w-full mt-1 bg-white border border-[#d6dfeb] rounded-lg shadow-xl overflow-hidden">
              <div className="p-2 border-b border-gray-700">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by name or ID..."
                    className="w-full bg-[#f8fbff] border border-[#d6dfeb] text-[#122033] text-xs rounded pl-8 pr-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#8C1515]/60"
                  />
                </div>
              </div>
              <div className="max-h-72 overflow-y-auto" role="listbox">
                {filtered.length === 0 ? (
                  <div className="p-3 text-center t-small t-secondary">
                    No patients found
                  </div>
                ) : (
                  filtered.map((p) => (
                    <button
                      type="button"
                      key={p.id}
                      onClick={() => handleSelect(p.id)}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-800 transition-colors flex items-center justify-between ${
                        p.id === selectedPatientId
                          ? "bg-[#8C1515]/12 text-[#6B1010]"
                          : "text-gray-300"
                      }`}
                    >
                      <span>{p.name}</span>
                      <span className="t-micro t-secondary t-mono">
                        {p.id}
                      </span>
                    </button>
                  ))
                )}
              </div>
              <div className="px-3 py-1.5 border-t border-gray-700 bg-gray-800/50">
                <span className="t-micro t-secondary">
                  {patients.length.toLocaleString()} patients · showing first 50
                  matches
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
