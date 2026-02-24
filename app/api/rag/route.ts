import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { readFile } from "fs/promises";
import path from "path";
import { retrieveChunks } from "@/lib/rag-retrieval";
import type { RAGChunk } from "@/lib/types";

const GUIDELINE_FILES = [
  "diabetes.json",
  "hypertension.json",
  "cholesterol.json",
  "immunizations.json",
  "heart_failure.json",
];

let guidelineChunksPromise: Promise<RAGChunk[]> | null = null;

async function loadAllChunks(): Promise<RAGChunk[]> {
  const chunks: RAGChunk[] = [];
  const guidelinesDir = path.join(process.cwd(), "public", "data", "guidelines");

  for (const file of GUIDELINE_FILES) {
    try {
      const content = await readFile(path.join(guidelinesDir, file), "utf-8");
      const fileChunks = JSON.parse(content) as RAGChunk[];
      chunks.push(...fileChunks);
    } catch {
      console.warn(`Could not load guideline file: ${file}`);
    }
  }
  return chunks;
}

async function loadAllChunksCached(): Promise<RAGChunk[]> {
  if (!guidelineChunksPromise) {
    guidelineChunksPromise = loadAllChunks();
  }
  return guidelineChunksPromise;
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { query, patientKeywords, patientConditions } = await req.json();

    const allChunks = await loadAllChunksCached();
    if (allChunks.length === 0) {
      return NextResponse.json({
        chunks: [],
        message: "No guideline files found in public/data/guidelines/",
      });
    }

    const supplementalKeywords = Array.isArray(patientKeywords)
      ? patientKeywords
      : Array.isArray(patientConditions)
      ? patientConditions
      : [];

    const scored = retrieveChunks(
      allChunks,
      typeof query === "string" ? query : "",
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
