import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessionContext } from "@/lib/server-context";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const ctx = await getSessionContext(supabase, session);
  if (!ctx.team) return NextResponse.json([]);

  const { data, error } = await supabase
    .from("experiment_runs")
    .select("*")
    .eq("team_id", ctx.team.teamId)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    return NextResponse.json(
      { error: "Failed to load experiments." },
      { status: 500 }
    );
  }

  return NextResponse.json(
    (data ?? []).map((row) => ({
      id: row.id,
      teamId: row.team_id,
      userId: row.user_id,
      patientId: row.patient_id,
      patientName: row.patient_name,
      prompt: row.prompt,
      recipeId: row.recipe_id,
      variableFocus: row.variable_focus,
      slots: row.slots,
      createdAt: row.created_at,
    }))
  );
}
