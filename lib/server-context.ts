import type { Session } from "next-auth";
import type { SupabaseClient } from "@supabase/supabase-js";

interface SessionUserInput {
  email?: string | null;
  name?: string | null;
  image?: string | null;
}

export interface SessionUserRecord {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  role: "student" | "instructor" | "admin";
}

export interface TeamMembershipRecord {
  teamId: string;
  teamName: string;
  joinCode: string;
  role: "lead" | "member";
  memberCount: number;
}

export interface SessionContext {
  user: SessionUserRecord;
  team: TeamMembershipRecord | null;
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export async function ensureUserRecord(
  supabase: SupabaseClient,
  user: SessionUserInput
): Promise<SessionUserRecord> {
  const rawEmail = user.email?.trim();
  if (!rawEmail) {
    throw new Error("Authenticated session is missing an email address.");
  }

  const email = normalizeEmail(rawEmail);

  const { data: existing, error: existingError } = await supabase
    .from("users")
    .select("id, email, name, image, role")
    .eq("email", email)
    .single();

  if (existingError && existingError.code !== "PGRST116") {
    throw new Error(`Failed to load user record: ${existingError.message}`);
  }

  if (existing) {
    const updates: Record<string, string | null> = {};
    if (user.name && user.name !== existing.name) updates.name = user.name;
    if (user.image !== undefined && user.image !== existing.image) {
      updates.image = user.image ?? null;
    }

    if (Object.keys(updates).length > 0) {
      await supabase.from("users").update(updates).eq("id", existing.id);
    }

    return {
      id: existing.id,
      email: existing.email,
      name: existing.name,
      image: existing.image,
      role: existing.role,
    };
  }

  const inferredRole =
    email === "demo@fordham.edu" ? "instructor" : ("student" as const);

  const { data: inserted, error: insertError } = await supabase
    .from("users")
    .insert({
      email,
      name: user.name ?? null,
      image: user.image ?? null,
      role: inferredRole,
    })
    .select("id, email, name, image, role")
    .single();

  if (insertError || !inserted) {
    throw new Error(
      `Failed to create user record: ${insertError?.message ?? "unknown error"}`
    );
  }

  return {
    id: inserted.id,
    email: inserted.email,
    name: inserted.name,
    image: inserted.image,
    role: inserted.role,
  };
}

export async function getTeamMembership(
  supabase: SupabaseClient,
  userId: string
): Promise<TeamMembershipRecord | null> {
  const { data: membership, error } = await supabase
    .from("team_members")
    .select("team_id, role, teams!inner(id, name, join_code)")
    .eq("user_id", userId)
    .limit(1)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error(`Failed to load team membership: ${error.message}`);
  }

  const teamData = Array.isArray(membership.teams)
    ? membership.teams[0]
    : membership.teams;

  const { count, error: countError } = await supabase
    .from("team_members")
    .select("user_id", { count: "exact", head: true })
    .eq("team_id", membership.team_id);

  if (countError) {
    throw new Error(`Failed to count team members: ${countError.message}`);
  }

  return {
    teamId: membership.team_id,
    teamName: teamData.name,
    joinCode: teamData.join_code,
    role: membership.role,
    memberCount: count ?? 0,
  };
}

export async function getSessionContext(
  supabase: SupabaseClient,
  session: Session
): Promise<SessionContext> {
  if (!session.user) {
    throw new Error("Authenticated session is missing a user payload.");
  }
  const user = await ensureUserRecord(supabase, session.user);
  const team = await getTeamMembership(supabase, user.id);
  return { user, team };
}

export async function requireInstructor(
  supabase: SupabaseClient,
  session: Session
): Promise<SessionContext> {
  const ctx = await getSessionContext(supabase, session);
  if (!["instructor", "admin"].includes(ctx.user.role)) {
    throw new Error("Instructor access is required.");
  }
  return ctx;
}
