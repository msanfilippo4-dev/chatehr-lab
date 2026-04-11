import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { errorResponse, routeErrorResponse } from "@/lib/api-response";
import { loadPatientRecord } from "@/lib/patient-loader";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return errorResponse("Unauthorized", 401, "unauthorized");
  }

  const patientId = params.id;
  if (!patientId) {
    return NextResponse.json(
      { error: "Patient id is required." },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();
  let patient;
  try {
    patient = await loadPatientRecord(supabase, patientId);
  } catch (error) {
    return routeErrorResponse(error, "Failed to load patient.");
  }

  if (!patient) {
    return errorResponse("Patient not found.", 404, "not_found");
  }

  return NextResponse.json(patient);
}
