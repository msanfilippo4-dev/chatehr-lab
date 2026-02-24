"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LabResultsGate() {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/labresults-auth", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ pin }),
      });

      if (!res.ok) {
        setError("Incorrect PIN.");
        setIsSubmitting(false);
        return;
      }

      router.refresh();
    } catch {
      setError("Unable to verify PIN right now.");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-8">
      <section className="ehr-shell p-5 md:p-6">
        <h1 className="text-xl font-semibold text-[#122033]">Instructor Lab Results</h1>
        <p className="t-body t-secondary mt-2">
          Enter PIN to view the guided walkthrough and sample answers for the
          directed cases.
        </p>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <div>
            <label className="block t-caption font-semibold text-[#122033] mb-1.5">
              PIN
            </label>
            <input
              type="password"
              inputMode="numeric"
              autoComplete="off"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              className="w-full bg-white border border-[#d6dfeb] rounded-lg px-3 py-2.5 text-[#122033] focus:outline-none focus:ring-2 focus:ring-[#8C1515]/60"
              placeholder="Enter instructor PIN"
            />
          </div>

          {error && <p className="t-caption text-[#8C1515]">{error}</p>}

          <button
            type="submit"
            disabled={!pin.trim() || isSubmitting}
            className="w-full rounded-lg px-3 py-2.5 bg-[#8C1515] text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#6B1010] transition-colors"
          >
            {isSubmitting ? "Checking..." : "Unlock Results"}
          </button>
        </form>
      </section>
    </div>
  );
}
