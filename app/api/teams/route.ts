// ---------------------------------------------------------------------------
// /api/teams — List all teams (GET) and create a new team (POST)
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { readJsonBodyWithLimit, trimString } from "@/lib/api-request";
import { getSessionContext } from "@/lib/server-context";

// ── GET — List all teams (for join-team page) ───────────────────────────────

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const scope = new URL(req.url).searchParams.get("scope");

  if (scope === "current") {
    const ctx = await getSessionContext(supabase, session);
    if (!ctx.team) {
      return NextResponse.json({ error: "No team found for current user." }, { status: 404 });
    }

    return NextResponse.json({
      id: ctx.team.teamId,
      name: ctx.team.teamName,
      joinCode: ctx.team.joinCode,
      role: ctx.team.role,
      memberCount: ctx.team.memberCount,
    });
  }

  // Fetch all teams with member counts
  const { data: teams, error } = await supabase
    .from("teams")
    .select("id, name, created_at")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Failed to list teams:", error);
    return NextResponse.json({ error: "Failed to load teams" }, { status: 500 });
  }

  // Get member counts per team in a separate query
  const { data: memberCounts, error: countError } = await supabase
    .from("team_members")
    .select("team_id");

  if (countError) {
    console.error("Failed to count team members:", countError);
    return NextResponse.json({ error: "Failed to load teams" }, { status: 500 });
  }

  // Build a map of team_id -> member count
  const countMap: Record<string, number> = {};
  for (const row of memberCounts ?? []) {
    countMap[row.team_id] = (countMap[row.team_id] ?? 0) + 1;
  }

  const result = (teams ?? []).map((t) => ({
    id: t.id,
    name: t.name,
    memberCount: countMap[t.id] ?? 0,
  }));

  return NextResponse.json(result);
}

// ── POST — Create a new team ────────────────────────────────────────────────

interface CreateTeamBody {
  name: string;
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

  // Look up user by email, creating if not exists
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
        { error: "A team with that name already exists." },
        { status: 409 }
      );
    }
    console.error("Failed to create team:", teamErr);
    return NextResponse.json({ error: "Failed to create team" }, { status: 500 });
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
    console.error("Failed to add team lead:", memberErr);
    // Clean up: delete the team we just created
    await supabase.from("teams").delete().eq("id", team.id);
    return NextResponse.json({ error: "Failed to add you as team lead" }, { status: 500 });
  }

  // Log audit event
  await supabase.from("audit_events").insert({
    team_id: team.id,
    user_id: userId,
    event_type: "team.created",
    details: { team_name: teamName },
  });

  return NextResponse.json(
    {
      id: team.id,
      name: team.name,
      joinCode: team.join_code,
      createdAt: team.created_at,
    },
    { status: 201 }
  );
}
