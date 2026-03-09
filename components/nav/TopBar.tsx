"use client";

import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { useTeam } from "@/components/providers/TeamProvider";
import { LogOut, ChevronDown, Users, Copy, Check } from "lucide-react";

export default function TopBar() {
  const { data: session } = useSession();
  const { team, loading: teamLoading } = useTeam();
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
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
      <div className="flex items-center gap-2">
        {teamLoading ? (
          <div className="h-4 w-24 animate-pulse rounded bg-gray-100" />
        ) : team ? (
          <>
            <span className="rounded-full bg-fordham-maroon/10 px-3 py-1 t-caption font-medium text-fordham-maroon">
              {team.name}
            </span>
            <button
              onClick={handleCopyJoinCode}
              className="inline-flex items-center gap-1.5 rounded-full border border-[#d6dfeb] bg-white px-2.5 py-1 t-micro font-semibold text-[#60768f] transition hover:border-fordham-maroon/30 hover:text-fordham-maroon"
              title="Copy team join code"
            >
              {copied ? <Check size={12} className="text-green-600" /> : <Copy size={12} />}
              <span>{copied ? "Copied" : `Code ${team.joinCode}`}</span>
            </button>
          </>
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
                  signOut({ callbackUrl: "/login" });
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
