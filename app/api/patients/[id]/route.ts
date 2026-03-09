import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadPatientRecord } from "@/lib/patient-loader";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const patientId = params.id;
  if (!patientId) {
    return NextResponse.json(
      { error: "Patient id is required." },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();
  const patient = await loadPatientRecord(supabase, patientId);

  if (!patient) {
    return NextResponse.json({ error: "Patient not found." }, { status: 404 });
  }

  return NextResponse.json(patient);
}
