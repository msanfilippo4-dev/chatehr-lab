import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { buildBenchAnalytics, readBenchSubmissions } from "../_lib";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const records = await readBenchSubmissions();
    const analytics = buildBenchAnalytics(records, session.user.email);
    return NextResponse.json({ analytics });
  } catch (error: unknown) {
    const err = error as { message?: string };
    return NextResponse.json(
      { error: "Failed to load analytics.", details: err.message },
      { status: 500 }
    );
  }
}

