"use client";

import { useEffect, useState } from "react";
import {
  Settings,
  Users,
  Copy,
  Check,
  Save,
  Trash2,
  Loader2,
} from "lucide-react";
import StatusPanel from "@/components/feedback/StatusPanel";
import { useTeam } from "@/components/providers/TeamProvider";
import { fetchApiJson, getApiErrorMessage } from "@/lib/client-api";

interface TeamMember {
  userId: string;
  name: string;
  email: string;
  role: "lead" | "member";
  platformRole: "student" | "instructor" | "admin";
  joinedAt: string;
}

interface TeamSettingsResponse {
  id: string;
  name: string;
  joinCode: string;
  role: "lead" | "member";
  memberCount: number;
  members: TeamMember[];
}

interface ConfigSummary {
  id: string;
  name?: string;
  modelName: string;
  isFrozen: boolean;
  version?: number;
}

function formatDate(value: string) {
  return new Date(value).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function SettingsPage() {
  const {
    team,
    memberships,
    status: teamStatus,
    loading: teamLoading,
    error: teamError,
    refresh: refreshTeam,
    switchTeam,
    switchingTeamId,
  } = useTeam();
  const [copied, setCopied] = useState(false);
  const [teamDetail, setTeamDetail] = useState<TeamSettingsResponse | null>(null);
  const [configs, setConfigs] = useState<ConfigSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadPage = async () => {
      if (teamStatus !== "ready") {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setLoadError(null);
      try {
        const [teamJson, configJson] = await Promise.all([
          fetchApiJson<TeamSettingsResponse>("/api/teams?scope=current&include=members"),
          fetchApiJson<ConfigSummary[]>("/api/configs"),
        ]);

        if (cancelled) return;
        setTeamDetail(teamJson);
        setConfigs(configJson);
      } catch (error) {
        if (cancelled) return;
        setLoadError(
          getApiErrorMessage(error, {
            backendUnavailable:
              "Settings data is unavailable right now. Check the backend connection and try again.",
            noTeam: "Join a team before using settings.",
            default: "Failed to load settings.",
          })
        );
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadPage();

    return () => {
      cancelled = true;
    };
  }, [team?.id, teamStatus]);

  const handleSwitchTeam = async (teamId: string) => {
    const switched = await switchTeam(teamId);
    if (!switched) return;
    await refreshTeam();
  };

  const handleCopyCode = async () => {
    if (!teamDetail?.joinCode) return;
    await navigator.clipboard.writeText(teamDetail.joinCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (teamLoading || teamStatus === "loading" || (isLoading && !teamDetail)) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-fordham-maroon" />
      </div>
    );
  }

  if (teamStatus === "unavailable") {
    return (
      <StatusPanel
        title="Settings unavailable"
        message={
          teamError ??
          "Team data could not be loaded, so settings are unavailable right now."
        }
        action={{ label: "Retry team lookup", onClick: () => void refreshTeam() }}
        className="mx-auto max-w-3xl"
      />
    );
  }

  if (teamStatus === "no_team" || !team) {
    return (
      <StatusPanel
        title="Join a team to use settings"
        message="Settings are only available once you have created or joined a team."
        action={{ label: "Create or join a team", href: "/join-team" }}
        secondaryAction={{ label: "View leaderboard", href: "/leaderboard" }}
        className="mx-auto max-w-3xl"
      />
    );
  }

  if (loadError && !teamDetail) {
    return (
      <StatusPanel
        title="Settings unavailable"
        message={loadError}
        action={{ label: "Retry", onClick: () => window.location.reload() }}
        className="mx-auto max-w-3xl"
      />
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <Settings size={20} className="text-fordham-maroon" />
          <h1 className="t-heading text-lg">Settings</h1>
        </div>
        <p className="t-caption t-secondary mt-1">
          Manage your team, members, and saved configurations
        </p>
      </div>

      {loadError && (
        <StatusPanel
          title="Some settings data could not be refreshed"
          message={loadError}
          tone="info"
          action={{ label: "Reload page", onClick: () => window.location.reload() }}
        />
      )}

      <div className="ehr-shell">
        <div className="ehr-shell-header">Your Teams</div>
        <div className="space-y-3 p-5">
          {memberships.map((membership) => {
            const isActive = membership.isActive;
            const isSwitching = switchingTeamId === membership.id;
            return (
              <div
                key={membership.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-100 px-4 py-3"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <p className="t-body font-medium">{membership.name}</p>
                    {isActive && (
                      <span className="rounded-full bg-fordham-maroon/10 px-2 py-0.5 t-micro font-medium text-fordham-maroon">
                        Active
                      </span>
                    )}
                  </div>
                  <p className="mt-1 t-caption t-secondary">
                    {membership.role} · {membership.memberCount} member
                    {membership.memberCount === 1 ? "" : "s"} · joined{" "}
                    {formatDate(membership.joinedAt)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void handleSwitchTeam(membership.id)}
                  disabled={isActive || Boolean(switchingTeamId)}
                  className="inline-flex items-center gap-2 rounded-lg border border-[#d6dfeb] bg-white px-3 py-2 t-small font-semibold text-fordham-maroon disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSwitching ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : null}
                  {isActive ? "Current team" : "Switch to team"}
                </button>
              </div>
            );
          })}
          <p className="t-caption t-tertiary">
            Switching teams changes which configs, runs, and notes the rest of the
            app loads. Existing work on your other teams stays untouched.
          </p>
        </div>
      </div>

      <div className="ehr-shell">
        <div className="ehr-shell-header">Team Information</div>
        <div className="space-y-4 p-5">
          <div>
            <label className="t-micro t-secondary uppercase tracking-wider font-medium block mb-1.5">
              Team Name
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={teamDetail?.name ?? team.name}
                readOnly
                className="flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 t-body outline-none"
              />
              <button
                disabled
                className="rounded-lg border border-gray-200 px-3 py-2 t-small font-medium text-gray-400 cursor-not-allowed"
                title="Renaming teams is not available yet."
              >
                <Save size={14} />
              </button>
            </div>
          </div>

          <div>
            <label className="t-micro t-secondary uppercase tracking-wider font-medium block mb-1.5">
              Join Code
            </label>
            <div className="flex items-center gap-2">
              <div className="flex-1 flex items-center justify-between rounded-lg border border-dashed border-fordham-maroon/30 bg-fordham-maroon/5 px-3 py-2">
                <code className="t-body t-mono font-bold tracking-widest text-fordham-maroon">
                  {teamDetail?.joinCode ?? team.joinCode}
                </code>
              </div>
              <button
                onClick={handleCopyCode}
                className="rounded-lg border border-gray-200 px-3 py-2 transition-colors hover:bg-gray-50"
              >
                {copied ? (
                  <Check size={14} className="text-green-600" />
                ) : (
                  <Copy size={14} className="t-secondary" />
                )}
              </button>
            </div>
            <p className="t-micro t-tertiary mt-1">
              Share this code with teammates so they can join
            </p>
          </div>
        </div>
      </div>

      <div className="ehr-shell">
        <div className="ehr-shell-header flex items-center gap-2">
          <Users size={12} />
          <span>Team Members</span>
        </div>
        <div className="p-5">
          <div className="space-y-3">
            {(teamDetail?.members ?? []).map((member) => (
              <div
                key={member.userId}
                className="flex items-center justify-between rounded-lg border border-gray-100 px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-fordham-maroon/10">
                    <span className="t-small font-semibold text-fordham-maroon">
                      {member.name.charAt(0)}
                    </span>
                  </div>
                  <div>
                    <p className="t-body font-medium">{member.name}</p>
                    <p className="t-caption t-secondary">{member.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="rounded-full bg-fordham-maroon/10 px-2.5 py-0.5 t-micro font-medium text-fordham-maroon">
                    {member.role}
                  </span>
                  <span className="t-caption t-tertiary">
                    {formatDate(member.joinedAt)}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <p className="t-caption t-tertiary mt-3">
            {teamDetail?.members.length
              ? "Teammates who join with the invite code will appear here."
              : "No members were returned for this team yet."}
          </p>
        </div>
      </div>

      <div className="ehr-shell">
        <div className="ehr-shell-header flex items-center justify-between">
          <span>Saved Configurations</span>
          <span className="rounded bg-gray-100 px-1.5 py-0.5 t-micro t-tertiary normal-case">
            {configs.length} config{configs.length === 1 ? "" : "s"}
          </span>
        </div>
        <div className="p-5">
          {configs.length > 0 ? (
            <div className="space-y-3">
              {configs.map((config) => (
                <div
                  key={config.id}
                  className="rounded-lg border border-gray-100 px-4 py-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="t-body font-medium">
                        {config.name ?? "Saved Config"}
                      </p>
                      <p className="t-caption t-secondary">{config.modelName}</p>
                    </div>
                    <span className="rounded-full bg-[#f7fafc] px-2.5 py-0.5 t-micro font-medium text-[#60768f]">
                      {config.isFrozen ? "Frozen" : "Editable"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex h-24 items-center justify-center rounded-lg border border-dashed border-gray-200">
              <div className="text-center">
                <p className="t-small t-tertiary">No saved configurations yet</p>
                <p className="t-caption t-tertiary mt-1">
                  Save a configuration from the Workspace to see it here
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="ehr-shell border-red-200">
        <div className="ehr-shell-header text-red-600 bg-red-50/50">
          Danger Zone
        </div>
        <div className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="t-body font-medium">Leave Team</p>
              <p className="t-caption t-secondary">
                Team leave/removal controls are not implemented yet.
              </p>
            </div>
            <button
              disabled
              className="flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 t-small font-medium text-red-500 cursor-not-allowed opacity-60"
            >
              <Trash2 size={14} />
              Leave
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
