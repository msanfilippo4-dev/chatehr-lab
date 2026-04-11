import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessionContext } from "@/lib/server-context";
import {
  getPublicPopulationCohort,
  getPopulationCohortById,
  loadPopulationCohortMembers,
} from "@/lib/population";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const ctx = await getSessionContext(supabase, session);
  if (!ctx.team) {
    return NextResponse.json({ error: "Team access required." }, { status: 403 });
  }

  const cohort = getPopulationCohortById(params.id);
  if (!cohort) {
    return NextResponse.json({ error: "Cohort not found." }, { status: 404 });
  }

  const members = await loadPopulationCohortMembers(supabase, cohort);
  const publicCohort = getPublicPopulationCohort(cohort);

  return NextResponse.json({
    ...publicCohort,
    members: members.map((member) => ({
      id: member.id,
      name: member.name,
      age: member.age,
      gender: member.gender,
      language: member.language,
      insuranceType: member.insuranceType,
      conditions: member.conditions.map((condition) => condition.display),
      topLabs: member.labs.slice(0, 3),
      socialHistory: member.socialHistory ?? null,
      lastVisit: member.lastVisit,
    })),
  });
}
