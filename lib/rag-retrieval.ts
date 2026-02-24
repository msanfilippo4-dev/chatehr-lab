import { RAGChunk } from "./types";

const STOP_WORDS = new Set([
  "the", "a", "an", "is", "are", "was", "were", "for", "to", "of", "in",
  "this", "that", "and", "or", "but", "not", "with", "patient", "what",
  "how", "should", "does", "do", "has", "have", "had", "their", "they",
  "can", "will", "would", "could", "tell", "me", "about", "please", "help",
  "her", "his", "its", "our", "your", "my", "any", "all", "some",
]);

function extractTerms(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOP_WORDS.has(t));
}

function scoreChunk(chunk: RAGChunk, queryTerms: string[]): number {
  const chunkText = `${chunk.title} ${chunk.text}`.toLowerCase();
  let score = 0;

  for (const term of queryTerms) {
    // Keyword match = highest weight
    if (
      chunk.keywords.some(
        (k) =>
          k.toLowerCase().includes(term) || term.includes(k.toLowerCase())
      )
    ) {
      score += 5;
    }
    // Title match = medium weight
    if (chunk.title.toLowerCase().includes(term)) {
      score += 3;
    }
    // Body match = count occurrences
    const matches = chunkText.match(new RegExp(term, "g"));
    if (matches) score += matches.length;
  }

  return score;
}

/**
 * Keyword-based RAG retrieval (client-callable).
 * No embeddings or vector DB — demonstrates RAG concept without infrastructure.
 */
export function retrieveChunks(
  allChunks: RAGChunk[],
  userQuery: string,
  patientConditions: string[],
  topK = 3
): RAGChunk[] {
  const queryTerms = extractTerms(
    [userQuery, ...patientConditions].join(" ")
  );

  if (queryTerms.length === 0) return [];

  return allChunks
    .map((chunk) => ({ chunk, score: scoreChunk(chunk, queryTerms) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map(({ chunk }) => chunk);
}
