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

interface TeamInfo {
  id: string;
  name: string;
  joinCode: string;
  role: "lead" | "member";
}

interface TeamContextValue {
  team: TeamInfo | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const TeamContext = createContext<TeamContextValue>({
  team: null,
  loading: true,
  error: null,
  refresh: async () => {},
});

export function TeamProvider({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession();
  const [team, setTeam] = useState<TeamInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTeam = useCallback(async () => {
    if (status !== "authenticated" || !session?.user) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const res = await fetch("/api/teams?scope=current");
      if (res.status === 404) {
        // User has no team yet
        setTeam(null);
        return;
      }

      if (!res.ok) {
        throw new Error("Failed to fetch team");
      }

      const data = await res.json();
      setTeam({
        id: data.id,
        name: data.name,
        joinCode: data.joinCode,
        role: data.role,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load team");
    } finally {
      setLoading(false);
    }
  }, [session, status]);

  useEffect(() => {
    fetchTeam();
  }, [fetchTeam]);

  return (
    <TeamContext.Provider value={{ team, loading, error, refresh: fetchTeam }}>
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
