"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { useTeam } from "@/components/providers/TeamProvider";
import {
  LogOut,
  ChevronDown,
  Users,
  Copy,
  Check,
  AlertTriangle,
  Loader2,
} from "lucide-react";

export default function TopBar() {
  const router = useRouter();
  const { data: session } = useSession();
  const {
    team,
    memberships,
    loading: teamLoading,
    status: teamStatus,
    error,
    switchTeam,
    switchingTeamId,
  } = useTeam();
  const [menuOpen, setMenuOpen] = useState(false);
  const [teamMenuOpen, setTeamMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const teamMenuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
      if (
        teamMenuRef.current &&
        !teamMenuRef.current.contains(e.target as Node)
      ) {
        setTeamMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const userName = session?.user?.name ?? "User";
  const userEmail = session?.user?.email ?? "";
  const userInitial = userName.charAt(0).toUpperCase();

  const handleCopyJoinCode = async () => {
    if (!team?.joinCode) return;
    await navigator.clipboard.writeText(team.joinCode);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  const getAppUrl = (path: string) =>
    typeof window === "undefined"
      ? path
      : new URL(path, window.location.origin).toString();

  const hasMultipleTeams = memberships.length > 1;

  const handleSwitchTeam = async (teamId: string) => {
    const switched = await switchTeam(teamId);
    if (!switched) {
      return;
    }

    setTeamMenuOpen(false);
    router.refresh();
    window.location.reload();
  };

  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-gray-200 bg-white px-4">
      {/* Left: Title */}
      <div className="flex items-center gap-2">
        <span className="t-small font-semibold tracking-tight text-fordham-maroon">
          ChartEHR Project
        </span>
        <span className="t-micro t-tertiary">|</span>
        <span className="t-micro t-tertiary">HINF 6117</span>
      </div>

      {/* Center: Team name */}
      <div className="relative flex items-center gap-2" ref={teamMenuRef}>
        {teamLoading ? (
          <div className="h-4 w-24 animate-pulse rounded bg-gray-100" />
        ) : teamStatus === "ready" && team ? (
          <>
            {hasMultipleTeams ? (
              <button
                type="button"
                onClick={() => setTeamMenuOpen((current) => !current)}
                className="inline-flex items-center gap-1 rounded-full bg-fordham-maroon/10 px-3 py-1 t-caption font-medium text-fordham-maroon transition hover:bg-fordham-maroon/15"
              >
                <span>{team.name}</span>
                <ChevronDown size={12} />
              </button>
            ) : (
              <span className="rounded-full bg-fordham-maroon/10 px-3 py-1 t-caption font-medium text-fordham-maroon">
                {team.name}
              </span>
            )}
            <button
              onClick={handleCopyJoinCode}
              className="inline-flex items-center gap-1.5 rounded-full border border-[#d6dfeb] bg-white px-2.5 py-1 t-micro font-semibold text-[#60768f] transition hover:border-fordham-maroon/30 hover:text-fordham-maroon"
              title="Copy team join code"
            >
              {copied ? <Check size={12} className="text-green-600" /> : <Copy size={12} />}
              <span>{copied ? "Copied" : `Code ${team.joinCode}`}</span>
            </button>
            {teamMenuOpen && hasMultipleTeams && (
              <div className="absolute left-0 top-full z-50 mt-2 min-w-[240px] rounded-xl border border-gray-200 bg-white py-1 shadow-lg">
                <div className="border-b border-gray-100 px-4 py-2">
                  <p className="t-small font-medium">Switch Team</p>
                  <p className="t-caption t-secondary">
                    Pick which team’s configs and runs you want to view.
                  </p>
                </div>
                <div className="py-1">
                  {memberships.map((membership) => {
                    const isActive = membership.id === team.id;
                    const isSwitching = switchingTeamId === membership.id;
                    return (
                      <button
                        key={membership.id}
                        type="button"
                        onClick={() => void handleSwitchTeam(membership.id)}
                        disabled={isActive || Boolean(switchingTeamId)}
                        className="flex w-full items-center justify-between gap-3 px-4 py-2 text-left transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <div>
                          <p className="t-small font-medium">{membership.name}</p>
                          <p className="t-caption t-secondary">
                            {membership.role} · {membership.memberCount} member
                            {membership.memberCount === 1 ? "" : "s"}
                          </p>
                        </div>
                        {isSwitching ? (
                          <Loader2 size={14} className="animate-spin text-fordham-maroon" />
                        ) : isActive ? (
                          <span className="rounded-full bg-fordham-maroon/10 px-2 py-0.5 t-micro font-semibold text-fordham-maroon">
                            Active
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        ) : teamStatus === "unavailable" ? (
          <span
            className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 t-caption font-medium text-amber-700"
            title={error ?? undefined}
          >
            <AlertTriangle size={12} />
            <span>Team service unavailable</span>
          </span>
        ) : (
          <Link
            href="/join-team"
            className="inline-flex items-center gap-1.5 rounded-full bg-fordham-maroon px-3 py-1 t-caption font-medium text-white transition hover:bg-fordham-dark"
          >
            <Users size={12} />
            <span>Create or join a team</span>
          </Link>
        )}
      </div>

      {/* Right: User menu */}
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-gray-100"
        >
          {session?.user?.image ? (
            <img
              src={session.user.image}
              alt={userName}
              className="h-6 w-6 rounded-full"
            />
          ) : (
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-fordham-maroon/10">
              <span className="t-micro font-semibold text-fordham-maroon">
                {userInitial}
              </span>
            </div>
          )}
          <span className="t-small font-medium hidden sm:inline">
            {userName}
          </span>
          <ChevronDown size={12} className="t-tertiary" />
        </button>

        {/* Dropdown */}
        {menuOpen && (
          <div className="absolute right-0 top-full z-50 mt-1 w-56 rounded-xl border border-gray-200 bg-white py-1 shadow-lg">
            <div className="border-b border-gray-100 px-4 py-3">
              <p className="t-small font-medium truncate">{userName}</p>
              <p className="t-caption t-secondary truncate">{userEmail}</p>
            </div>

            <div className="py-1">
              <button
                onClick={() => {
                  setMenuOpen(false);
                  signOut({ callbackUrl: getAppUrl("/login") });
                }}
                className="flex w-full items-center gap-2.5 px-4 py-2 t-small text-red-600 transition-colors hover:bg-red-50"
              >
                <LogOut size={14} />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
