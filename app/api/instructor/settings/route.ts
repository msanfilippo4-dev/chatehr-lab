import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { readJsonBodyWithLimit } from "@/lib/api-request";
import { errorResponse, routeErrorResponse } from "@/lib/api-response";
import { requireInstructor } from "@/lib/server-context";

interface SettingsBody {
  officialBenchmarkLocked?: boolean;
  checkpointBenchmarkLocked?: boolean;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return errorResponse("Unauthorized", 401, "unauthorized");
  }

  const supabase = createAdminClient();
  try {
    await requireInstructor(supabase, session);
  } catch (error) {
    return routeErrorResponse(error, "Failed to load course settings.");
  }

  const { data, error } = await supabase
    .from("course_settings")
    .select("*")
    .eq("id", "hinf6117")
    .single();

  if (error) {
    return routeErrorResponse(error, "Failed to load course settings.");
  }

  return NextResponse.json({
    officialBenchmarkLocked: data.official_benchmark_locked,
    checkpointBenchmarkLocked: data.checkpoint_benchmark_locked,
    updatedAt: data.updated_at,
  });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return errorResponse("Unauthorized", 401, "unauthorized");
  }

  const body = await readJsonBodyWithLimit<SettingsBody>(req);
  if (!body.ok) {
    return NextResponse.json({ error: body.error }, { status: body.status });
  }

  const supabase = createAdminClient();
  let ctx;
  try {
    ctx = await requireInstructor(supabase, session);
  } catch (error) {
    return routeErrorResponse(error, "Failed to update course settings.");
  }

  const payload = {
    id: "hinf6117",
    official_benchmark_locked: body.data.officialBenchmarkLocked ?? false,
    checkpoint_benchmark_locked: body.data.checkpointBenchmarkLocked ?? false,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("course_settings")
    .upsert(payload)
    .select("*")
    .single();

  if (error) {
    return routeErrorResponse(error, "Failed to update course settings.");
  }

  await supabase.from("audit_events").insert({
    user_id: ctx.user.id,
    event_type: "course_settings.updated",
    details: payload,
  });

  return NextResponse.json({
    officialBenchmarkLocked: data.official_benchmark_locked,
    checkpointBenchmarkLocked: data.checkpoint_benchmark_locked,
    updatedAt: data.updated_at,
  });
}
