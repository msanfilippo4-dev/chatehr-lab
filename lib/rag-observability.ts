import {
  RAGChunk,
  RAGObservabilityMetadata,
  RAGRetrievalInsight,
} from "./types";
import { extractTerms } from "./rag-retrieval";

type RetrievedChunk = RAGChunk & { score: number };

function makePreview(text: string, maxLength = 180) {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength).trimEnd()}...`;
}

function summarizeMatchReason(chunk: RAGRetrievalInsight) {
  if (chunk.matchedKeywords?.length) {
    return `Matched guideline keywords: ${chunk.matchedKeywords.join(", ")}`;
  }

  if (chunk.matchedTerms?.length) {
    return `Matched query or condition terms in the title/body: ${chunk.matchedTerms.join(", ")}`;
  }

  return "Retrieved based on overall similarity to the prompt.";
}

function buildChunkInsight(
  chunk: RetrievedChunk,
  queryTerms: string[]
): RAGRetrievalInsight {
  const matchedTerms = queryTerms.filter((term) => {
    const lowerTerm = term.toLowerCase();
    return (
      chunk.title.toLowerCase().includes(lowerTerm) ||
      chunk.text.toLowerCase().includes(lowerTerm)
    );
  }).slice(0, 6);

  const matchedKeywords = chunk.keywords
    .filter((keyword) =>
      queryTerms.some((term) => {
        const lowerKeyword = keyword.toLowerCase();
        return lowerKeyword.includes(term) || term.includes(lowerKeyword);
      })
    )
    .slice(0, 6);

  const insight: RAGRetrievalInsight = {
    id: chunk.id,
    source: chunk.source,
    title: chunk.title,
    text: chunk.text,
    keywords: chunk.keywords,
    score: Number(chunk.score.toFixed(2)),
    preview: makePreview(chunk.text),
    matchedTerms,
    matchedKeywords,
  };

  insight.rationale = summarizeMatchReason(insight);
  return insight;
}

export function buildRagObservabilityMetadata(args: {
  enabled: boolean;
  method: "keyword" | "embedding" | "hybrid";
  topK: number;
  userQuery: string;
  patientConditions?: string[];
  retrievedChunks: RetrievedChunk[];
}): RAGObservabilityMetadata {
  const patientConditions = args.patientConditions ?? [];
  const queryTerms = extractTerms(
    `${args.userQuery} ${patientConditions.join(" ")}`
  ).slice(0, 10);
  const patientConditionTerms = extractTerms(patientConditions.join(" ")).slice(
    0,
    8
  );

  return {
    enabled: args.enabled,
    method: args.method,
    topK: args.topK,
    query: args.userQuery,
    queryTerms,
    patientConditionTerms,
    retrievedChunkCount: args.retrievedChunks.length,
    retrievedChunks: args.retrievedChunks.map((chunk) =>
      buildChunkInsight(chunk, queryTerms)
    ),
  };
}

export function summarizeBenchmarkRagUsage(args: {
  enabled: boolean;
  method: "keyword" | "embedding" | "hybrid";
  topK: number;
  caseCount: number;
  retrievedCases: Array<{
    caseId: string;
    prompt: string;
    chunks: RetrievedChunk[];
  }>;
}) {
  const chunkUsage = new Map<
    string,
    { id: string; title: string; source: string; hits: number; bestScore: number }
  >();

  for (const entry of args.retrievedCases) {
    for (const chunk of entry.chunks) {
      const current = chunkUsage.get(chunk.id);
      if (!current) {
        chunkUsage.set(chunk.id, {
          id: chunk.id,
          title: chunk.title,
          source: chunk.source,
          hits: 1,
          bestScore: chunk.score,
        });
        continue;
      }

      current.hits += 1;
      current.bestScore = Math.max(current.bestScore, chunk.score);
    }
  }

  return {
    enabled: args.enabled,
    method: args.method,
    topK: args.topK,
    caseCount: args.caseCount,
    casesWithRetrievedGuidelines: args.retrievedCases.length,
    totalRetrievedChunks: args.retrievedCases.reduce(
      (sum, entry) => sum + entry.chunks.length,
      0
    ),
    topRetrievedChunks: Array.from(chunkUsage.values())
      .sort((a, b) => {
        if (b.hits === a.hits) return b.bestScore - a.bestScore;
        return b.hits - a.hits;
      })
      .slice(0, 5),
    sampleCases: args.retrievedCases.slice(0, 5).map((entry) => ({
      caseId: entry.caseId,
      promptPreview: makePreview(entry.prompt, 120),
      retrievedChunkCount: entry.chunks.length,
    })),
  };
}
