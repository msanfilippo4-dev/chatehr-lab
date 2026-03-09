// ---------------------------------------------------------------------------
// /api/teams/join — Join a team by invite code (POST)
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { readJsonBodyWithLimit, trimString } from "@/lib/api-request";

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

  // Look up or create user by email
  let userId: string;
  const { data: existingUser } = await supabase
    .from("users")
    .select("id")
    .eq("email", session.user.email)
    .single();

  if (existingUser) {
    userId = existingUser.id;
  } else {
    const { data: newUser, error: userErr } = await supabase
      .from("users")
      .insert({
        email: session.user.email,
        name: session.user.name ?? null,
        image: session.user.image ?? null,
      })
      .select("id")
      .single();

    if (userErr || !newUser) {
      console.error("Failed to create user:", userErr);
      return NextResponse.json({ error: "Failed to create user record" }, { status: 500 });
    }
    userId = newUser.id;
  }

  // Check if user is already on a team
  const { data: existingMembership } = await supabase
    .from("team_members")
    .select("team_id")
    .eq("user_id", userId)
    .limit(1)
    .single();

  if (existingMembership) {
    return NextResponse.json(
      { error: "You are already on a team. Leave your current team first." },
      { status: 409 }
    );
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
    console.error("Failed to join team:", memberErr);
    return NextResponse.json({ error: "Failed to join team" }, { status: 500 });
  }

  // Log audit event
  await supabase.from("audit_events").insert({
    team_id: team.id,
    user_id: userId,
    event_type: "team.member_joined",
    details: { user_email: session.user.email },
  });

  return NextResponse.json({
    id: team.id,
    name: team.name,
    createdAt: team.created_at,
    message: `Successfully joined team "${team.name}".`,
  });
}
