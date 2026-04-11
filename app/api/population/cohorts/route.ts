import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { errorResponse, routeErrorResponse } from "@/lib/api-response";
import { getSessionContext } from "@/lib/server-context";
import {
  POPULATION_COHORTS,
  getPublicPopulationCohort,
  loadPopulationCohortMembers,
} from "@/lib/population";

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
    return routeErrorResponse(error, "Failed to load cohorts.");
  }
  if (!ctx.team) {
    return NextResponse.json([]);
  }

  try {
    const cohorts = await Promise.all(
      POPULATION_COHORTS.map(async (cohort) => {
        const members = await loadPopulationCohortMembers(supabase, cohort);
        const publicCohort = getPublicPopulationCohort(cohort);
        return {
          ...publicCohort,
          memberCount: cohort.memberPatientIds.length,
          sampleMembers: members.map((member) => ({
            id: member.id,
            name: member.name,
            language: member.language,
            insuranceType: member.insuranceType,
            conditions: member.conditions
              .slice(0, 3)
              .map((condition) => condition.display),
          })),
        };
      })
    );

    return NextResponse.json(cohorts);
  } catch (error) {
    return routeErrorResponse(error, "Failed to load cohorts.");
  }
}
