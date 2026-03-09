"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Users, Plus, ArrowRight, Copy, Check } from "lucide-react";

type Mode = "choose" | "create" | "join";

export default function JoinTeamPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("choose");
  const [teamName, setTeamName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [createdTeam, setCreatedTeam] = useState<{
    name: string;
    joinCode: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamName.trim()) return;
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: teamName.trim() }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to create team");
        return;
      }

      setCreatedTeam({ name: data.name, joinCode: data.joinCode });
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleJoinTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim()) return;
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/teams/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ joinCode: joinCode.trim().toUpperCase() }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to join team");
        return;
      }

      router.replace("/dashboard");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopyCode = async () => {
    if (!createdTeam) return;
    await navigator.clipboard.writeText(createdTeam.joinCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Team created success view
  if (createdTeam) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-4">
        <div className="ehr-shell w-full max-w-sm">
          <div className="ehr-shell-header text-center">Team Created</div>
          <div className="flex flex-col gap-4 p-6">
            <div className="flex items-center justify-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                <Check className="h-6 w-6 text-green-600" />
              </div>
            </div>

            <div className="text-center">
              <p className="t-body font-semibold">{createdTeam.name}</p>
              <p className="t-caption t-secondary mt-1">
                Share this code with your teammates
              </p>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-dashed border-fordham-maroon/30 bg-fordham-maroon/5 px-4 py-3">
              <code className="t-body t-mono font-bold tracking-widest text-fordham-maroon">
                {createdTeam.joinCode}
              </code>
              <button
                onClick={handleCopyCode}
                className="rounded p-1.5 transition-colors hover:bg-fordham-maroon/10"
              >
                {copied ? (
                  <Check size={14} className="text-green-600" />
                ) : (
                  <Copy size={14} className="text-fordham-maroon" />
                )}
              </button>
            </div>

            <button
              onClick={() => router.replace("/dashboard")}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-fordham-maroon px-4 py-2.5 t-body font-medium text-white transition-all hover:bg-fordham-dark"
            >
              <span>Go to Dashboard</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      {/* Header */}
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-fordham-maroon to-fordham-dark shadow-lg">
          <Users className="h-7 w-7 text-white" />
        </div>
        <h1 className="t-heading text-xl tracking-tight">Join a Team</h1>
        <p className="t-caption t-secondary mt-1">
          Create or join a team to start the competition
        </p>
      </div>

      {/* Card */}
      <div className="ehr-shell w-full max-w-sm">
        <div className="ehr-shell-header text-center">
          {mode === "choose"
            ? "Choose an Option"
            : mode === "create"
              ? "Create a Team"
              : "Join a Team"}
        </div>
        <div className="flex flex-col gap-4 p-6">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 t-small text-red-700">
              {error}
            </div>
          )}

          {mode === "choose" && (
            <>
              <button
                onClick={() => setMode("create")}
                className="flex w-full items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-4 text-left transition-all hover:border-fordham-maroon/30 hover:bg-fordham-maroon/5 hover:shadow-sm"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-fordham-maroon/10">
                  <Plus size={18} className="text-fordham-maroon" />
                </div>
                <div>
                  <p className="t-body font-semibold">Create a Team</p>
                  <p className="t-caption t-secondary">
                    Start a new team and invite members
                  </p>
                </div>
              </button>

              <button
                onClick={() => setMode("join")}
                className="flex w-full items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-4 text-left transition-all hover:border-fordham-maroon/30 hover:bg-fordham-maroon/5 hover:shadow-sm"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-fordham-maroon/10">
                  <ArrowRight size={18} className="text-fordham-maroon" />
                </div>
                <div>
                  <p className="t-body font-semibold">Join a Team</p>
                  <p className="t-caption t-secondary">
                    Enter an invite code from your teammate
                  </p>
                </div>
              </button>
            </>
          )}

          {mode === "create" && (
            <form onSubmit={handleCreateTeam} className="flex flex-col gap-4">
              <div>
                <label className="t-small t-secondary mb-1.5 block font-medium">
                  Team Name
                </label>
                <input
                  type="text"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  placeholder="e.g. Clinical Minds"
                  maxLength={40}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 t-body outline-none transition-colors focus:border-fordham-maroon focus:ring-1 focus:ring-fordham-maroon/20"
                  autoFocus
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setMode("choose");
                    setError("");
                  }}
                  className="flex-1 rounded-lg border border-gray-200 px-4 py-2.5 t-body font-medium transition-colors hover:bg-gray-50"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={loading || !teamName.trim()}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-fordham-maroon px-4 py-2.5 t-body font-medium text-white transition-all hover:bg-fordham-dark disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  ) : (
                    <>
                      <Plus size={16} />
                      <span>Create</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {mode === "join" && (
            <form onSubmit={handleJoinTeam} className="flex flex-col gap-4">
              <div>
                <label className="t-small t-secondary mb-1.5 block font-medium">
                  Invite Code
                </label>
                <input
                  type="text"
                  value={joinCode}
                  onChange={(e) =>
                    setJoinCode(e.target.value.toUpperCase().slice(0, 8))
                  }
                  placeholder="e.g. ABCD1234"
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 t-body t-mono text-center text-lg tracking-widest outline-none transition-colors focus:border-fordham-maroon focus:ring-1 focus:ring-fordham-maroon/20"
                  autoFocus
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setMode("choose");
                    setError("");
                  }}
                  className="flex-1 rounded-lg border border-gray-200 px-4 py-2.5 t-body font-medium transition-colors hover:bg-gray-50"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={loading || !joinCode.trim()}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-fordham-maroon px-4 py-2.5 t-body font-medium text-white transition-all hover:bg-fordham-dark disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  ) : (
                    <>
                      <ArrowRight size={16} />
                      <span>Join</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
