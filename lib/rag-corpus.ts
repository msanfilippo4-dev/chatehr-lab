import { readFile } from "fs/promises";
import path from "path";
import { RAGChunk } from "./types";

export const GUIDELINE_FILES = [
  "diabetes.json",
  "hypertension.json",
  "cholesterol.json",
  "immunizations.json",
  "heart_failure.json",
] as const;

export type CorpusWarning = {
  file: string;
  message: string;
};

export type CorpusFileSummary = {
  file: string;
  chunkCount: number;
};

export type CorpusSourceSummary = {
  source: string;
  chunkCount: number;
};

export type RagCorpusLoadResult = {
  chunks: RAGChunk[];
  fileSummaries: CorpusFileSummary[];
  sourceSummaries: CorpusSourceSummary[];
  warnings: CorpusWarning[];
};

let ragCorpusPromise: Promise<RagCorpusLoadResult> | null = null;

const PREFERRED_EXAMPLE_IDS = [
  "dm-001",
  "hf-002",
  "htn-002",
  "chol-002",
  "imm-001",
  "dm-004",
  "hf-006",
];

function isValidChunk(value: unknown): value is RAGChunk {
  const chunk = value as Partial<RAGChunk>;
  return Boolean(
    chunk &&
      typeof chunk.id === "string" &&
      typeof chunk.source === "string" &&
      typeof chunk.title === "string" &&
      typeof chunk.text === "string" &&
      Array.isArray(chunk.keywords)
  );
}

function buildSourceSummaries(chunks: RAGChunk[]): CorpusSourceSummary[] {
  const counts = new Map<string, number>();
  for (const chunk of chunks) {
    counts.set(chunk.source, (counts.get(chunk.source) || 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([source, chunkCount]) => ({ source, chunkCount }))
    .sort((a, b) => a.source.localeCompare(b.source));
}

export async function loadRagCorpus(): Promise<RagCorpusLoadResult> {
  const guidelinesDir = path.join(process.cwd(), "public", "data", "guidelines");
  const warnings: CorpusWarning[] = [];
  const chunks: RAGChunk[] = [];
  const fileSummaries: CorpusFileSummary[] = [];

  for (const file of GUIDELINE_FILES) {
    try {
      const content = await readFile(path.join(guidelinesDir, file), "utf8");
      const parsed = JSON.parse(content) as unknown;
      if (!Array.isArray(parsed)) {
        warnings.push({ file, message: "Expected JSON array of chunks." });
        fileSummaries.push({ file, chunkCount: 0 });
        continue;
      }

      const valid = parsed.filter(isValidChunk);
      if (valid.length !== parsed.length) {
        warnings.push({
          file,
          message: `Skipped ${parsed.length - valid.length} malformed chunk(s).`,
        });
      }
      chunks.push(...valid);
      fileSummaries.push({ file, chunkCount: valid.length });
    } catch (error: unknown) {
      const err = error as { message?: string };
      warnings.push({ file, message: err.message || "Unable to read file." });
      fileSummaries.push({ file, chunkCount: 0 });
    }
  }

  return {
    chunks,
    fileSummaries,
    sourceSummaries: buildSourceSummaries(chunks),
    warnings,
  };
}

export async function loadRagCorpusCached(): Promise<RagCorpusLoadResult> {
  if (!ragCorpusPromise) {
    ragCorpusPromise = loadRagCorpus();
  }
  return ragCorpusPromise;
}

export function getRagExampleChunks(chunks: RAGChunk[], max = 7): RAGChunk[] {
  const byId = new Map(chunks.map((chunk) => [chunk.id, chunk] as const));
  const selected: RAGChunk[] = [];
  const seen = new Set<string>();

  for (const id of PREFERRED_EXAMPLE_IDS) {
    const chunk = byId.get(id);
    if (!chunk || seen.has(chunk.id)) continue;
    selected.push(chunk);
    seen.add(chunk.id);
    if (selected.length >= max) return selected;
  }

  const bySource = new Map<string, RAGChunk>();
  for (const chunk of chunks) {
    if (!bySource.has(chunk.source)) {
      bySource.set(chunk.source, chunk);
    }
  }
  for (const chunk of Array.from(bySource.values())) {
    if (seen.has(chunk.id)) continue;
    selected.push(chunk);
    seen.add(chunk.id);
    if (selected.length >= max) return selected;
  }

  for (const chunk of chunks) {
    if (seen.has(chunk.id)) continue;
    selected.push(chunk);
    seen.add(chunk.id);
    if (selected.length >= max) break;
  }

  return selected;
}
