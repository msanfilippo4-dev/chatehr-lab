"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LabResultsLockButton() {
  const router = useRouter();
  const [isLocking, setIsLocking] = useState(false);

  const handleLock = async () => {
    setIsLocking(true);
    try {
      await fetch("/api/labresults-auth", { method: "DELETE" });
    } finally {
      router.refresh();
      setIsLocking(false);
    }
  };

  return (
    <button
      onClick={handleLock}
      disabled={isLocking}
      className="rounded-lg px-3 py-2 t-caption font-semibold border border-[#d6dfeb] bg-white text-[#122033] hover:bg-[#f7f9fc] disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {isLocking ? "Locking..." : "Lock Results"}
    </button>
  );
}
