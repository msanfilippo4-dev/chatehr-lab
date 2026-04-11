"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { useSession } from "next-auth/react";
import type { ApiErrorCode } from "@/lib/api-error";
import {
  ApiClientError,
  fetchApiJson,
  getApiErrorMessage,
} from "@/lib/client-api";

interface TeamInfo {
  id: string;
  name: string;
  joinCode: string;
  role: "lead" | "member";
  memberCount?: number;
  joinedAt?: string;
}

interface TeamMembershipInfo extends TeamInfo {
  memberCount: number;
  joinedAt: string;
  isActive: boolean;
}

type TeamStatus = "loading" | "ready" | "no_team" | "unavailable";

interface TeamContextValue {
  team: TeamInfo | null;
  memberships: TeamMembershipInfo[];
  loading: boolean;
  status: TeamStatus;
  error: string | null;
  errorCode?: ApiErrorCode;
  refresh: () => Promise<void>;
  switchTeam: (teamId: string) => Promise<boolean>;
  switchingTeamId: string | null;
}

const TeamContext = createContext<TeamContextValue>({
  team: null,
  memberships: [],
  loading: true,
  status: "loading",
  error: null,
  errorCode: undefined,
  refresh: async () => {},
  switchTeam: async () => false,
  switchingTeamId: null,
});

export function TeamProvider({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession();
  const [team, setTeam] = useState<TeamInfo | null>(null);
  const [memberships, setMemberships] = useState<TeamMembershipInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [teamStatus, setTeamStatus] = useState<TeamStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<ApiErrorCode | undefined>();
  const [switchingTeamId, setSwitchingTeamId] = useState<string | null>(null);

  const fetchTeam = useCallback(async () => {
    if (status !== "authenticated" || !session?.user) {
      setTeam(null);
      setMemberships([]);
      setError(null);
      setErrorCode(undefined);
      setTeamStatus(status === "loading" ? "loading" : "no_team");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setTeamStatus("loading");
      setError(null);
      setErrorCode(undefined);

      const data = await fetchApiJson<{
        id: string;
        name: string;
        joinCode: string;
        role: "lead" | "member";
        memberCount: number;
        joinedAt?: string;
      }>("/api/teams?scope=current");

      let membershipData: TeamMembershipInfo[] = [];
      try {
        membershipData = await fetchApiJson<TeamMembershipInfo[]>(
          "/api/teams?scope=mine"
        );
      } catch {
        membershipData = [];
      }

      setTeam({
        id: data.id,
        name: data.name,
        joinCode: data.joinCode,
        role: data.role,
        memberCount: data.memberCount,
        joinedAt: data.joinedAt,
      });
      setMemberships(
        membershipData.length > 0
          ? membershipData
          : [
              {
                id: data.id,
                name: data.name,
                joinCode: data.joinCode,
                role: data.role,
                memberCount: data.memberCount,
                joinedAt: data.joinedAt ?? "",
                isActive: true,
              },
            ]
      );
      setTeamStatus("ready");
    } catch (err) {
      if (
        err instanceof ApiClientError &&
        (err.code === "no_team" || err.status === 404)
      ) {
        setTeam(null);
        setMemberships([]);
        setTeamStatus("no_team");
        setError("No team found for the current user.");
        setErrorCode("no_team");
      } else {
        setTeam(null);
        setMemberships([]);
        setTeamStatus("unavailable");
        setError(
          getApiErrorMessage(err, {
            backendUnavailable:
              "Team data is unavailable right now. Check the backend connection and try again.",
            default: "Failed to load team.",
          })
        );
        setErrorCode(
          err instanceof ApiClientError ? err.code : "unknown_error"
        );
      }
    } finally {
      setLoading(false);
    }
  }, [session, status]);

  const switchTeam = useCallback(
    async (teamId: string) => {
      if (!teamId || team?.id === teamId) {
        return false;
      }

      setSwitchingTeamId(teamId);
      setError(null);
      setErrorCode(undefined);

      try {
        const data = await fetchApiJson<{
          id: string;
          name: string;
          joinCode: string;
          role: "lead" | "member";
          memberCount: number;
          joinedAt?: string;
        }>("/api/teams", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ teamId }),
        });

        setTeam({
          id: data.id,
          name: data.name,
          joinCode: data.joinCode,
          role: data.role,
          memberCount: data.memberCount,
          joinedAt: data.joinedAt,
        });
        setMemberships((current) =>
          current.map((membership) => ({
            ...membership,
            isActive: membership.id === teamId,
          }))
        );
        return true;
      } catch (err) {
        setError(
          getApiErrorMessage(err, {
            backendUnavailable:
              "Team switching is unavailable right now. Check the backend connection and try again.",
            default: "Failed to switch teams.",
          })
        );
        setErrorCode(err instanceof ApiClientError ? err.code : "unknown_error");
        return false;
      } finally {
        setSwitchingTeamId(null);
      }
    },
    [team?.id]
  );

  useEffect(() => {
    fetchTeam();
  }, [fetchTeam]);

  return (
    <TeamContext.Provider
      value={{
        team,
        memberships,
        loading,
        status: teamStatus,
        error,
        errorCode,
        refresh: fetchTeam,
        switchTeam,
        switchingTeamId,
      }}
    >
      {children}
    </TeamContext.Provider>
  );
}

export function useTeam() {
  const context = useContext(TeamContext);
  if (!context) {
    throw new Error("useTeam must be used within a TeamProvider");
  }
  return context;
}
