import type { Session } from "next-auth";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import {
  ApiRouteError,
  instructorRequiredError,
  isSupabaseNoRowsError,
  toApiRouteError,
} from "@/lib/api-error";

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
  joinedAt: string;
}

export interface SessionContext {
  user: SessionUserRecord;
  team: TeamMembershipRecord | null;
}

const INSTRUCTOR_EMAIL_OVERRIDES = new Set(["msanfilippo4@fordham.edu"]);
const ACTIVE_TEAM_COOKIE_NAME = "chartehr_active_team_id";

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function normalizeCookieValue(value: string | null | undefined) {
  const nextValue = value?.trim();
  return nextValue ? nextValue : null;
}

export function readActiveTeamCookie() {
  try {
    return normalizeCookieValue(
      cookies().get(ACTIVE_TEAM_COOKIE_NAME)?.value ?? null
    );
  } catch {
    return null;
  }
}

export function applyActiveTeamCookie(
  response: NextResponse,
  teamId: string | null
) {
  if (!teamId) {
    response.cookies.delete(ACTIVE_TEAM_COOKIE_NAME);
    return response;
  }

  response.cookies.set({
    name: ACTIVE_TEAM_COOKIE_NAME,
    value: teamId,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}

export async function ensureUserRecord(
  supabase: SupabaseClient,
  user: SessionUserInput
): Promise<SessionUserRecord> {
  const rawEmail = user.email?.trim();
  if (!rawEmail) {
    throw new ApiRouteError(
      "Authenticated session is missing an email address.",
      401,
      "unauthorized"
    );
  }

  const email = normalizeEmail(rawEmail);

  const { data: existing, error: existingError } = await supabase
    .from("users")
    .select("id, email, name, image, role")
    .eq("email", email)
    .single();

  if (existingError && !isSupabaseNoRowsError(existingError)) {
    throw toApiRouteError(existingError, "Failed to load user record.");
  }

  if (existing) {
    const updates: Record<string, string | null> = {};
    if (user.name && user.name !== existing.name) updates.name = user.name;
    if (user.image !== undefined && user.image !== existing.image) {
      updates.image = user.image ?? null;
    }
    if (
      INSTRUCTOR_EMAIL_OVERRIDES.has(email) &&
      existing.role !== "instructor"
    ) {
      updates.role = "instructor";
    }

    if (Object.keys(updates).length > 0) {
      const { error: updateError } = await supabase
        .from("users")
        .update(updates)
        .eq("id", existing.id);

      if (updateError) {
        throw toApiRouteError(updateError, "Failed to update user record.");
      }
    }

    const resolvedRole =
      (updates.role as SessionUserRecord["role"] | undefined) ?? existing.role;

    return {
      id: existing.id,
      email: existing.email,
      name: (updates.name as string | null | undefined) ?? existing.name,
      image: (updates.image as string | null | undefined) ?? existing.image,
      role: resolvedRole,
    };
  }

  const inferredRole =
    email === "demo@fordham.edu" || INSTRUCTOR_EMAIL_OVERRIDES.has(email)
      ? "instructor"
      : ("student" as const);

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
    throw toApiRouteError(insertError, "Failed to create user record.");
  }

  return {
    id: inserted.id,
    email: inserted.email,
    name: inserted.name,
    image: inserted.image,
    role: inserted.role,
  };
}

export async function listTeamMemberships(
  supabase: SupabaseClient,
  userId: string
): Promise<TeamMembershipRecord[]> {
  const { data: memberships, error } = await supabase
    .from("team_members")
    .select("team_id, role, joined_at, teams!inner(id, name, join_code)")
    .eq("user_id", userId)
    .order("joined_at", { ascending: false });

  if (error) {
    if (isSupabaseNoRowsError(error)) return [];
    throw toApiRouteError(error, "Failed to load team membership.");
  }

  if (!memberships?.length) {
    return [];
  }

  const teamIds = memberships.map((membership) => membership.team_id);
  const { data: memberRows, error: countError } = await supabase
    .from("team_members")
    .select("team_id")
    .in("team_id", teamIds);

  if (countError) {
    throw toApiRouteError(countError, "Failed to count team members.");
  }

  const memberCountByTeamId = new Map<string, number>();
  for (const row of memberRows ?? []) {
    memberCountByTeamId.set(
      row.team_id,
      (memberCountByTeamId.get(row.team_id) ?? 0) + 1
    );
  }

  return memberships.map((membership) => {
    const teamData = Array.isArray(membership.teams)
      ? membership.teams[0]
      : membership.teams;

    return {
      teamId: membership.team_id,
      teamName: teamData.name,
      joinCode: teamData.join_code,
      role: membership.role,
      memberCount: memberCountByTeamId.get(membership.team_id) ?? 0,
      joinedAt: membership.joined_at,
    };
  });
}

export async function getTeamMembership(
  supabase: SupabaseClient,
  userId: string,
  activeTeamId: string | null = null
): Promise<TeamMembershipRecord | null> {
  const memberships = await listTeamMemberships(supabase, userId);
  if (!memberships.length) return null;

  const activeMembership =
    memberships.find((membership) => membership.teamId === activeTeamId) ??
    memberships[0];

  return activeMembership;
}

export async function getSessionContext(
  supabase: SupabaseClient,
  session: Session
): Promise<SessionContext> {
  if (!session.user) {
    throw new ApiRouteError(
      "Authenticated session is missing a user payload.",
      401,
      "unauthorized"
    );
  }
  const user = await ensureUserRecord(supabase, session.user);
  const team = await getTeamMembership(supabase, user.id, readActiveTeamCookie());
  return { user, team };
}

export async function requireInstructor(
  supabase: SupabaseClient,
  session: Session
): Promise<SessionContext> {
  const ctx = await getSessionContext(supabase, session);
  if (!["instructor", "admin"].includes(ctx.user.role)) {
    throw instructorRequiredError();
  }
  return ctx;
}
