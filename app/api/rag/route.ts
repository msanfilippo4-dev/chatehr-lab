import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { retrieveChunks } from "@/lib/rag-retrieval";
import { loadRagCorpusCached } from "@/lib/rag-corpus";
import { normalizeStringArray, readJsonBodyWithLimit, trimString } from "@/lib/api-request";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const parsed = await readJsonBodyWithLimit<{
      query?: unknown;
      patientKeywords?: unknown;
      patientConditions?: unknown;
      topK?: unknown;
    }>(req, 40_000);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: parsed.status });
    }

    const query = trimString(parsed.data.query, 1000);

    const { chunks: allChunks } = await loadRagCorpusCached();
    if (allChunks.length === 0) {
      return NextResponse.json({
        chunks: [],
        message: "No guideline files found in public/data/guidelines/",
      });
    }

    const supplementalKeywords = normalizeStringArray(
      Array.isArray(parsed.data.patientKeywords)
        ? parsed.data.patientKeywords
        : parsed.data.patientConditions,
      { maxItems: 40, maxItemChars: 100 }
    );

    const scored = retrieveChunks(
      allChunks,
      query,
      supplementalKeywords,
      3
    );

    return NextResponse.json({ chunks: scored });
  } catch (error: unknown) {
    console.error("RAG API error:", error);
    const err = error as { message?: string };
    return NextResponse.json(
      { error: "Failed to retrieve guidelines", details: err.message },
      { status: 500 }
    );
  }
}
