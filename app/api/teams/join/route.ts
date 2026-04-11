// ---------------------------------------------------------------------------
// /api/teams/join — Join a team by invite code (POST)
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { readJsonBodyWithLimit, trimString } from "@/lib/api-request";
import { routeErrorResponse } from "@/lib/api-response";
import {
  applyActiveTeamCookie,
  getSessionContext,
  listTeamMemberships,
} from "@/lib/server-context";

interface JoinTeamBody {
  joinCode: string;
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await readJsonBodyWithLimit<JoinTeamBody>(req);
  if (!body.ok) {
    return NextResponse.json({ error: body.error }, { status: body.status });
  }

  const joinCode = trimString(body.data.joinCode, 20).toLowerCase();
  if (!joinCode) {
    return NextResponse.json(
      { error: "Join code is required." },
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
            "You are already on a team. Switch teams from Settings instead of joining a new one.",
        },
        { status: 409 }
      );
    }
  } catch (error) {
    return routeErrorResponse(error, "Failed to check your team membership.");
  }

  // Find team by join code
  const { data: team, error: teamErr } = await supabase
    .from("teams")
    .select("id, name, created_at")
    .eq("join_code", joinCode)
    .single();

  if (teamErr || !team) {
    return NextResponse.json(
      { error: "Invalid join code. No team found." },
      { status: 404 }
    );
  }

  // Add user as member
  const { error: memberErr } = await supabase
    .from("team_members")
    .insert({
      team_id: team.id,
      user_id: userId,
      role: "member",
    });

  if (memberErr) {
    if (memberErr.code === "23505") {
      return NextResponse.json(
        { error: "You are already a member of this team." },
        { status: 409 }
      );
    }
    return routeErrorResponse(memberErr, "Failed to join team.");
  }

  // Log audit event
  await supabase.from("audit_events").insert({
    team_id: team.id,
    user_id: userId,
    event_type: "team.member_joined",
    details: { user_email: session.user.email },
  });

  const response = NextResponse.json({
    id: team.id,
    name: team.name,
    createdAt: team.created_at,
    message: `Successfully joined team "${team.name}".`,
  });
  return applyActiveTeamCookie(response, team.id);
}
