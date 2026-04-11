import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  normalizeStringArray,
  readJsonBodyWithLimit,
  trimString,
} from "@/lib/api-request";
import { errorResponse, routeErrorResponse } from "@/lib/api-response";
import { getSessionContext } from "@/lib/server-context";
import type { NotebookEntry } from "@/lib/types";

interface NotebookBody {
  category: NotebookEntry["category"];
  title: string;
  content: string;
  linkedExperimentId?: string;
  tags?: string[];
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return errorResponse("Unauthorized", 401, "unauthorized");
  }
  const supabase = createAdminClient();
  let ctx;
  try {
    ctx = await getSessionContext(supabase, session);
  } catch (error) {
    return routeErrorResponse(error, "Failed to load notebook entries.");
  }
  if (!ctx.team) return NextResponse.json([]);

  const { data, error } = await supabase
    .from("notebook_entries")
    .select("*")
    .eq("team_id", ctx.team.teamId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return routeErrorResponse(error, "Failed to load notebook entries.");
  }

  return NextResponse.json(
    (data ?? []).map((entry) => ({
      id: entry.id,
      teamId: entry.team_id,
      userId: entry.user_id,
      category: entry.category,
      title: entry.title,
      content: entry.content,
      linkedExperimentId: entry.linked_experiment_id,
      tags: entry.tags ?? [],
      createdAt: entry.created_at,
    }))
  );
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return errorResponse("Unauthorized", 401, "unauthorized");
  }
  const body = await readJsonBodyWithLimit<NotebookBody>(req);
  if (!body.ok) {
    return NextResponse.json({ error: body.error }, { status: body.status });
  }

  const supabase = createAdminClient();
  let ctx;
  try {
    ctx = await getSessionContext(supabase, session);
  } catch (error) {
    return routeErrorResponse(error, "Failed to save notebook entry.");
  }
  if (!ctx.team) {
    return errorResponse(
      "You must be on a team to save notebook entries.",
      403,
      "no_team"
    );
  }

  const { data, error } = await supabase
    .from("notebook_entries")
    .insert({
      team_id: ctx.team.teamId,
      user_id: ctx.user.id,
      category: body.data.category,
      title: trimString(body.data.title, 200) || "Untitled note",
      content: trimString(body.data.content, 10_000),
      linked_experiment_id: body.data.linkedExperimentId ?? null,
      tags: normalizeStringArray(body.data.tags, {
        maxItems: 8,
        maxItemChars: 40,
      }),
    })
    .select("*")
    .single();

  if (error) {
    return routeErrorResponse(error, "Failed to save notebook entry.");
  }

  return NextResponse.json(data, { status: 201 });
}
