// ---------------------------------------------------------------------------
// /api/teams — List all teams (GET) and create a new team (POST)
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { readJsonBodyWithLimit, trimString } from "@/lib/api-request";
import { noTeamError, toApiRouteError } from "@/lib/api-error";
import { errorResponse, routeErrorResponse } from "@/lib/api-response";
import {
  applyActiveTeamCookie,
  getSessionContext,
  listTeamMemberships,
} from "@/lib/server-context";

// ── GET — List all teams (for join-team page) ───────────────────────────────

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return errorResponse("Unauthorized", 401, "unauthorized");
  }

  const supabase = createAdminClient();
  const url = new URL(req.url);
  const scope = url.searchParams.get("scope");
  const includeMembers = url.searchParams.get("include") === "members";

  if (scope === "mine") {
    try {
      const ctx = await getSessionContext(supabase, session);
      const memberships = await listTeamMemberships(supabase, ctx.user.id);

      return NextResponse.json(
        memberships.map((membership) => ({
          id: membership.teamId,
          name: membership.teamName,
          joinCode: membership.joinCode,
          role: membership.role,
          memberCount: membership.memberCount,
          joinedAt: membership.joinedAt,
          isActive: membership.teamId === ctx.team?.teamId,
        }))
      );
    } catch (error) {
      return routeErrorResponse(error, "Failed to load your teams.");
    }
  }

  if (scope === "current") {
    try {
      const ctx = await getSessionContext(supabase, session);
      if (!ctx.team) {
        return routeErrorResponse(
          noTeamError("No team found for current user.", 404)
        );
      }

      if (!includeMembers) {
        const response = NextResponse.json({
          id: ctx.team.teamId,
          name: ctx.team.teamName,
          joinCode: ctx.team.joinCode,
          role: ctx.team.role,
          memberCount: ctx.team.memberCount,
        });
        return applyActiveTeamCookie(response, ctx.team.teamId);
      }

      const { data: members, error: membersError } = await supabase
        .from("team_members")
        .select("role, joined_at, users!inner(id, email, name, role)")
        .eq("team_id", ctx.team.teamId)
        .order("joined_at", { ascending: true });

      if (membersError) {
        throw toApiRouteError(membersError, "Failed to load team members.");
      }

      const response = NextResponse.json({
        id: ctx.team.teamId,
        name: ctx.team.teamName,
        joinCode: ctx.team.joinCode,
        role: ctx.team.role,
        memberCount: ctx.team.memberCount,
        members: (members ?? []).map((member) => {
          const user = Array.isArray(member.users) ? member.users[0] : member.users;
          return {
            userId: user?.id ?? "",
            name: user?.name ?? "Unknown user",
            email: user?.email ?? "",
            role: member.role,
            platformRole: user?.role ?? "student",
            joinedAt: member.joined_at,
          };
        }),
      });
      return applyActiveTeamCookie(response, ctx.team.teamId);
    } catch (error) {
      return routeErrorResponse(error, "Failed to load current team.");
    }
  }

  // Fetch all teams with member counts
  const { data: teams, error } = await supabase
    .from("teams")
    .select("id, name, created_at")
    .order("created_at", { ascending: true });

  if (error) {
    return routeErrorResponse(error, "Failed to load teams.");
  }

  // Get member counts per team in a separate query
  const { data: memberCounts, error: countError } = await supabase
    .from("team_members")
    .select("team_id");

  if (countError) {
    return routeErrorResponse(countError, "Failed to load teams.");
  }

  // Build a map of team_id -> member count
  const countMap: Record<string, number> = {};
  for (const row of memberCounts ?? []) {
    countMap[row.team_id] = (countMap[row.team_id] ?? 0) + 1;
  }

  const result = (teams ?? [])
    .map((t) => ({
      id: t.id,
      name: t.name,
      memberCount: countMap[t.id] ?? 0,
    }))
    .filter((team) => team.memberCount > 0);

  return NextResponse.json(result);
}

// ── POST — Create a new team ────────────────────────────────────────────────

interface CreateTeamBody {
  name: string;
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return errorResponse("Unauthorized", 401, "unauthorized");
  }

  const body = await readJsonBodyWithLimit<CreateTeamBody>(req);
  if (!body.ok) {
    return NextResponse.json({ error: body.error }, { status: body.status });
  }

  const teamName = trimString(body.data.name, 100);
  if (!teamName || teamName.length < 2) {
    return NextResponse.json(
      { error: "Team name must be at least 2 characters." },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();
  let ctx;
  try {
    ctx = await getSessionContext(supabase, session);
  } catch (error) {
    return routeErrorResponse(error, "Failed to create user record.");
  }

  const userId = ctx.user.id;
  try {
    const memberships = await listTeamMemberships(supabase, userId);
    if (memberships.length > 0) {
      return NextResponse.json(
        {
          error:
            "You are already on a team. Switch teams from Settings instead of creating a new one.",
        },
        { status: 409 }
      );
    }
  } catch (error) {
    return routeErrorResponse(error, "Failed to check your team membership.");
  }

  // Create team
  const { data: team, error: teamErr } = await supabase
    .from("teams")
    .insert({
      name: teamName,
      created_by: userId,
    })
    .select("id, name, join_code, created_at")
    .single();

  if (teamErr) {
    if (teamErr.code === "23505") {
      return NextResponse.json(
        { error: "A team with that name already exists.", code: "bad_request" },
        { status: 409 }
      );
    }
    return routeErrorResponse(teamErr, "Failed to create team.");
  }

  // Add creator as team lead
  const { error: memberErr } = await supabase
    .from("team_members")
    .insert({
      team_id: team.id,
      user_id: userId,
      role: "lead",
    });

  if (memberErr) {
    // Clean up: delete the team we just created
    await supabase.from("teams").delete().eq("id", team.id);
    return routeErrorResponse(memberErr, "Failed to add you as team lead.");
  }

  // Log audit event
  await supabase.from("audit_events").insert({
    team_id: team.id,
    user_id: userId,
    event_type: "team.created",
    details: { team_name: teamName },
  });

  const response = NextResponse.json(
    {
      id: team.id,
      name: team.name,
      joinCode: team.join_code,
      createdAt: team.created_at,
    },
    { status: 201 }
  );
  return applyActiveTeamCookie(response, team.id);
}

interface SetActiveTeamBody {
  teamId: string;
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return errorResponse("Unauthorized", 401, "unauthorized");
  }

  const body = await readJsonBodyWithLimit<SetActiveTeamBody>(req);
  if (!body.ok) {
    return NextResponse.json({ error: body.error }, { status: body.status });
  }

  const teamId = trimString(body.data.teamId, 100);
  if (!teamId) {
    return NextResponse.json(
      { error: "teamId is required." },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();
  let ctx;
  try {
    ctx = await getSessionContext(supabase, session);
  } catch (error) {
    return routeErrorResponse(error, "Failed to switch teams.");
  }

  let memberships;
  try {
    memberships = await listTeamMemberships(supabase, ctx.user.id);
  } catch (error) {
    return routeErrorResponse(error, "Failed to switch teams.");
  }
  const nextTeam = memberships.find((membership) => membership.teamId === teamId);

  if (!nextTeam) {
    return NextResponse.json(
      { error: "You are not a member of that team." },
      { status: 403 }
    );
  }

  const response = NextResponse.json({
    id: nextTeam.teamId,
    name: nextTeam.teamName,
    joinCode: nextTeam.joinCode,
    role: nextTeam.role,
    memberCount: nextTeam.memberCount,
    joinedAt: nextTeam.joinedAt,
  });
  return applyActiveTeamCookie(response, teamId);
}
