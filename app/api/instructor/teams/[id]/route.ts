import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadInstructorTeamDetail } from "@/lib/instructor-data";
import { errorResponse, routeErrorResponse } from "@/lib/api-response";
import { requireInstructor } from "@/lib/server-context";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return errorResponse("Unauthorized", 401, "unauthorized");
  }

  const supabase = createAdminClient();
  try {
    await requireInstructor(supabase, session);
  } catch (error) {
    return routeErrorResponse(error, "Failed to load team detail.");
  }

  try {
    const detail = await loadInstructorTeamDetail(supabase, params.id);
    return NextResponse.json(detail);
  } catch (error) {
    return routeErrorResponse(error, "Failed to load team detail.");
  }
}
