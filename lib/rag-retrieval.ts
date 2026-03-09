/**
 * RAG Retrieval — Keyword-based and semantic chunk retrieval.
 * Ported from chatehr-lab and extended with semantic retrieval stub.
 */

import { RAGChunk } from "./types";

// ─── Stop words to filter from queries ────────────────────────────────────────

const STOP_WORDS = new Set([
  "a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
  "have", "has", "had", "do", "does", "did", "will", "would", "could",
  "should", "may", "might", "shall", "can", "need", "dare", "ought",
  "used", "to", "of", "in", "for", "on", "with", "at", "by", "from",
  "as", "into", "through", "during", "before", "after", "above", "below",
  "between", "out", "off", "over", "under", "again", "further", "then",
  "once", "here", "there", "when", "where", "why", "how", "all", "both",
  "each", "few", "more", "most", "other", "some", "such", "no", "nor",
  "not", "only", "own", "same", "so", "than", "too", "very", "just",
  "don", "now", "and", "but", "or", "if", "while", "what", "which",
  "who", "whom", "this", "that", "these", "those", "am", "it", "its",
  "i", "me", "my", "myself", "we", "our", "ours", "ourselves", "you",
  "your", "yours", "yourself", "yourselves", "he", "him", "his", "himself",
  "she", "her", "hers", "herself", "they", "them", "their", "theirs",
  "themselves", "patient", "please", "tell", "about", "what",
]);

// ─── Keyword scoring ──────────────────────────────────────────────────────────

export function extractTerms(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOP_WORDS.has(t));
}

function scoreChunk(chunk: RAGChunk, queryTerms: string[]): number {
  let score = 0;
  const lowerKeywords = chunk.keywords.map((k) => k.toLowerCase());
  const lowerTitle = chunk.title.toLowerCase();
  const lowerText = chunk.text.toLowerCase();

  for (const term of queryTerms) {
    // Keyword match: +5 points
    if (lowerKeywords.some((kw) => kw.includes(term) || term.includes(kw))) {
      score += 5;
    }
    // Title match: +3 points
    if (lowerTitle.includes(term)) {
      score += 3;
    }
    // Body match: +1 per occurrence (max 3)
    const bodyMatches = (lowerText.match(new RegExp(term, "g")) || []).length;
    score += Math.min(bodyMatches, 3);
  }

  return score;
}

/**
 * Retrieve top-K relevant guideline chunks using keyword scoring.
 */
export function retrieveChunksByKeyword(
  allChunks: RAGChunk[],
  userQuery: string,
  patientConditions: string[],
  topK: number = 3
): Array<RAGChunk & { score: number }> {
  const queryTerms = extractTerms(
    userQuery + " " + patientConditions.join(" ")
  );

  if (queryTerms.length === 0) return [];

  const scored = allChunks
    .map((chunk) => ({
      ...chunk,
      score: scoreChunk(chunk, queryTerms),
    }))
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, topK);
}

/**
 * Retrieve top-K relevant guideline chunks using semantic similarity.
 * Requires pgvector embeddings in the guideline_chunks table.
 *
 * This is a placeholder — actual implementation calls Supabase RPC.
 */
export async function retrieveChunksBySemantic(
  query: string,
  topK: number = 3,
  _supabaseClient?: unknown
): Promise<Array<RAGChunk & { score: number }>> {
  // TODO: Phase 4 implementation
  // 1. Generate embedding for query using model's embedding API
  // 2. Call Supabase RPC: match_guideline_chunks(query_embedding, match_count)
  // 3. Return scored results
  console.warn("Semantic retrieval not yet implemented. Falling back to empty results.");
  void query;
  void topK;
  return [];
}

/**
 * Unified retrieval function that dispatches to keyword or semantic.
 */
export async function retrieveChunks(
  allChunks: RAGChunk[],
  userQuery: string,
  patientConditions: string[],
  method: "keyword" | "semantic",
  topK: number = 3,
  supabaseClient?: unknown
): Promise<Array<RAGChunk & { score: number }>> {
  if (method === "semantic") {
    return retrieveChunksBySemantic(userQuery, topK, supabaseClient);
  }
  return retrieveChunksByKeyword(allChunks, userQuery, patientConditions, topK);
}
