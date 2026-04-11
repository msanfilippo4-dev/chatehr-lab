// ---------------------------------------------------------------------------
// /api/patients — Paginated patient list (GET)
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { errorResponse, routeErrorResponse } from "@/lib/api-response";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return errorResponse("Unauthorized", 401, "unauthorized");
  }

  const url = new URL(req.url);
  const page = Math.max(0, parseInt(url.searchParams.get("page") ?? "0", 10) || 0);
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") ?? "50", 10) || 50));
  const search = (url.searchParams.get("search") ?? "").trim();

  const supabase = createAdminClient();

  // Build query
  let query = supabase
    .from("patients")
    .select("id, name, dob, age, gender, race, ethnicity, language, insurance_type, is_complex, last_visit", { count: "exact" });

  // Optional name search (case-insensitive)
  if (search) {
    query = query.ilike("name", `%${search}%`);
  }

  // Apply pagination
  const from = page * limit;
  const to = from + limit - 1;

  const { data: patients, error, count } = await query
    .order("name", { ascending: true })
    .range(from, to);

  if (error) {
    return routeErrorResponse(error, "Failed to load patients.");
  }

  // Map snake_case to camelCase for the list view
  const mapped = (patients ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    dob: p.dob,
    age: p.age,
    gender: p.gender,
    race: p.race,
    ethnicity: p.ethnicity,
    language: p.language,
    maritalStatus: undefined,
    addressZip: undefined,
    insuranceType: p.insurance_type,
    isComplex: p.is_complex,
    lastVisit: p.last_visit,
    conditions: [],
    labs: [],
    immunizations: [],
    medications: [],
    allergies: [],
    visits: [],
  }));

  return NextResponse.json({
    patients: mapped,
    total: count ?? 0,
    page,
  });
}
