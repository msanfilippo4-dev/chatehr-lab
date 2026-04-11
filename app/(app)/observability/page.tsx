"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  BookOpen,
  Clock3,
  Coins,
  ExternalLink,
  Filter,
  Loader2,
  Search,
} from "lucide-react";
import StatusPanel from "@/components/feedback/StatusPanel";
import { fetchApiJson, getApiErrorMessage } from "@/lib/client-api";

interface ChatEvent {
  id: string;
  role: string;
  content: string;
  model_name: string;
  input_tokens: number;
  output_tokens: number;
  latency_ms: number;
  cost_usd: number;
  langfuse_trace_id: string | null;
  created_at: string;
}

interface SnapshotEvent {
  id: string;
  source_type: "chat" | "experiment" | "benchmark" | "population";
  source_id: string;
  model_name: string;
  provider: string;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  estimated_cost_usd: number;
  latency_ms: number;
  metadata: Record<string, unknown>;
  created_at: string;
}

interface SummaryResponse {
  summary: {
    totalTraces: number;
    totalTokens: number;
    totalCost: number;
    avgLatencyMs: number;
  } | null;
  ragSummary: {
    ragEnabledTraces: number;
    tracesWithRetrievedContext: number;
    averageRetrievedChunks: number;
    topRetrievedTitles: Array<{ title: string; hits: number }>;
  } | null;
  chatEvents: ChatEvent[];
  snapshots: SnapshotEvent[];
  langfuse: {
    configured: boolean;
    enabled: boolean;
    reason: string | null;
    baseUrl: string;
  };
}

interface RAGInsight {
  enabled: boolean;
  method?: string;
  topK?: number;
  query?: string;
  queryTerms?: string[];
  patientConditionTerms?: string[];
  retrievedChunkCount?: number;
  injectedContext?: string;
  retrievedChunks?: Array<{
    id: string;
    title: string;
    source: string;
    text?: string;
    score?: number;
    preview?: string;
    matchedTerms?: string[];
    matchedKeywords?: string[];
    rationale?: string;
  }>;
  casesWithRetrievedGuidelines?: number;
  totalRetrievedChunks?: number;
  topRetrievedChunks?: Array<{
    id: string;
    title: string;
    source: string;
    hits: number;
    bestScore?: number;
  }>;
  sampleCases?: Array<{
    caseId: string;
    promptPreview: string;
    retrievedChunkCount: number;
  }>;
  sampleInjectedContexts?: Array<{
    caseId: string;
    promptPreview: string;
    retrievedChunkCount: number;
    injectedContext: string;
  }>;
}

function formatDate(value: string) {
  return new Date(value).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatCurrency(value: number) {
  return `$${value.toFixed(4)}`;
}

function getRagInsight(metadata: Record<string, unknown>) {
  const value = metadata.rag;
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as RAGInsight;
}

function buildFallbackInjectedContext(rag: RAGInsight) {
  if (rag.injectedContext) {
    return { content: rag.injectedContext, exact: true };
  }

  if (!rag.retrievedChunks || rag.retrievedChunks.length === 0) {
    return null;
  }

  return {
    exact: false,
    content: `RETRIEVED GUIDELINES:\n${rag.retrievedChunks
      .map((chunk, index) => `[${index + 1}] ${chunk.title} (${chunk.source})\n${chunk.text ?? chunk.preview ?? ""}`)
      .join("\n\n")}`,
  };
}

export default function ObservabilityPage() {
  const [range, setRange] = useState("7d");
  const [query, setQuery] = useState("");
  const [data, setData] = useState<SummaryResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadSummary = async (nextRange: string) => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const json = await fetchApiJson<SummaryResponse>(
        `/api/observability/summary?range=${nextRange}`
      );
      setData(json);
    } catch (error) {
      setLoadError(
        getApiErrorMessage(error, {
          backendUnavailable:
            "Observability data is unavailable right now. Check the backend connection and try again.",
          default: "Failed to load observability data.",
        })
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadSummary(range);
  }, [range]);

  const filteredChatEvents = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return data?.chatEvents ?? [];
    return (data?.chatEvents ?? []).filter(
      (event) =>
        event.model_name.toLowerCase().includes(needle) ||
        event.content.toLowerCase().includes(needle)
    );
  }, [data?.chatEvents, query]);

  const filteredSnapshots = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return data?.snapshots ?? [];
    return (data?.snapshots ?? []).filter(
      (event) =>
        event.model_name.toLowerCase().includes(needle) ||
        event.source_type.toLowerCase().includes(needle)
    );
  }, [data?.snapshots, query]);

  if (loadError && !data) {
    return (
      <StatusPanel
        title="Observability unavailable"
        message={loadError}
        action={{ label: "Retry", onClick: () => void loadSummary(range) }}
        className="mx-auto max-w-5xl"
      />
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {loadError && (
        <StatusPanel
          title="Some observability data could not be refreshed"
          message={loadError}
          tone="info"
          action={{ label: "Retry", onClick: () => void loadSummary(range) }}
        />
      )}

      <section className="ehr-shell">
        <div className="ehr-shell-header flex items-center gap-2">
          <Activity size={12} />
          <span>Student Observability</span>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div>
            <h1 className="t-heading text-lg">Tokens, latency, cost, and retrieval in plain language</h1>
            <p className="mt-1 t-body t-secondary">
              Use this page to explain why one configuration is stronger than
              another, not just whether it scored well.
            </p>
          </div>

          <a
            href={data?.langfuse?.baseUrl ?? "https://us.cloud.langfuse.com"}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-[#d6dfeb] bg-white px-3 py-2 t-small font-semibold text-[#506680]"
          >
            <ExternalLink size={14} />
            Open Langfuse
          </a>
        </div>
      </section>

      <section className="ehr-shell p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="t-small font-semibold">Tracing status</p>
            <p className="mt-1 t-small t-secondary">
              {data?.langfuse?.enabled
                ? `Langfuse is enabled at ${data.langfuse.baseUrl}.`
                : data?.langfuse?.configured
                  ? `Langfuse is configured but currently disabled (${data.langfuse.reason ?? "unknown_reason"}).`
                  : "Langfuse credentials are not configured for this environment."}
            </p>
          </div>
          <span
            className={`rounded-full px-3 py-1 t-micro font-semibold ${
              data?.langfuse?.enabled
                ? "bg-emerald-50 text-emerald-700"
                : "bg-amber-50 text-amber-700"
            }`}
          >
            {data?.langfuse?.enabled ? "enabled" : "disabled"}
          </span>
        </div>
      </section>

      <section className="ehr-shell p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter size={14} className="text-fordham-maroon" />
            <span className="t-small font-semibold">Filters</span>
          </div>
          <select
            value={range}
            onChange={(event) => setRange(event.target.value)}
            className="rounded-lg border border-[#d6dfeb] bg-white px-3 py-2 t-small outline-none"
          >
            <option value="24h">Last 24 hours</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
          </select>
          <div className="relative ml-auto min-w-[240px]">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[#7b90a7]"
            />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Filter by model or text"
              className="w-full rounded-lg border border-[#d6dfeb] bg-white py-2 pl-9 pr-3 t-small outline-none"
            />
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        {[
          {
            label: "Total traces",
            value: String(data?.summary?.totalTraces ?? 0),
            icon: Activity,
          },
          {
            label: "Total tokens",
            value: `${data?.summary?.totalTokens ?? 0}`,
            icon: Activity,
          },
          {
            label: "Average latency",
            value: `${data?.summary?.avgLatencyMs ?? 0} ms`,
            icon: Clock3,
          },
          {
            label: "Estimated cost",
            value: formatCurrency(data?.summary?.totalCost ?? 0),
            icon: Coins,
          },
        ].map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="ehr-shell p-4">
              <div className="flex items-center justify-between">
                <span className="t-micro font-semibold uppercase tracking-wider t-secondary">
                  {card.label}
                </span>
                <Icon size={14} className="text-fordham-maroon" />
              </div>
              <p className="mt-2 text-xl font-semibold">{card.value}</p>
            </div>
          );
        })}
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {[
          {
            label: "RAG-enabled traces",
            value: String(data?.ragSummary?.ragEnabledTraces ?? 0),
            help: "How many saved traces had RAG turned on.",
          },
          {
            label: "Traces with retrieved context",
            value: String(data?.ragSummary?.tracesWithRetrievedContext ?? 0),
            help: "How often RAG actually found something relevant enough to include.",
          },
          {
            label: "Average retrieved chunks",
            value: `${data?.ragSummary?.averageRetrievedChunks ?? 0}`,
            help: "Typical amount of external context added when RAG retrieved something.",
          },
        ].map((card) => (
          <div key={card.label} className="ehr-shell p-4">
            <p className="t-micro font-semibold uppercase tracking-wider t-secondary">
              {card.label}
            </p>
            <p className="mt-2 text-xl font-semibold">{card.value}</p>
            <p className="mt-2 t-small t-secondary">{card.help}</p>
          </div>
        ))}
      </section>

      <section className="ehr-shell p-4">
        <div className="flex items-center gap-2">
          <BookOpen size={14} className="text-fordham-maroon" />
          <span className="t-small font-semibold">Top retrieved guideline titles</span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {(data?.ragSummary?.topRetrievedTitles ?? []).length > 0 ? (
            data?.ragSummary?.topRetrievedTitles.map((item) => (
              <div
                key={item.title}
                className="rounded-full border border-[#d6dfeb] bg-white px-3 py-1.5"
              >
                <span className="t-small font-medium">{item.title}</span>
                <span className="ml-2 t-micro t-tertiary">{item.hits} hits</span>
              </div>
            ))
          ) : (
            <p className="t-small t-secondary">
              No retrieved-context traces yet. Run a few RAG-on chats or experiments to see what the system actually pulls in.
            </p>
          )}
        </div>
      </section>

      {isLoading && !data ? (
        <div className="flex h-[40vh] items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-fordham-maroon" />
        </div>
      ) : (
        <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
          <div className="ehr-shell">
            <div className="ehr-shell-header">Assistant chat traces</div>
            <div className="space-y-3 p-4">
              {filteredChatEvents.length > 0 ? (
                filteredChatEvents.map((event) => (
                  <div
                    key={event.id}
                    className="rounded-xl border border-[#d6dfeb] bg-white p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="t-small font-semibold">{event.model_name}</p>
                      <span className="t-micro t-tertiary">
                        {formatDate(event.created_at)}
                      </span>
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-3">
                      <div className="rounded-lg bg-[#f7fafc] p-2">
                        <p className="t-micro t-secondary">Tokens</p>
                        <p className="t-small font-semibold">
                          {(event.input_tokens ?? 0) + (event.output_tokens ?? 0)}
                        </p>
                      </div>
                      <div className="rounded-lg bg-[#f7fafc] p-2">
                        <p className="t-micro t-secondary">Latency</p>
                        <p className="t-small font-semibold">
                          {event.latency_ms ?? 0} ms
                        </p>
                      </div>
                      <div className="rounded-lg bg-[#f7fafc] p-2">
                        <p className="t-micro t-secondary">Cost</p>
                        <p className="t-small font-semibold">
                          {formatCurrency(Number(event.cost_usd ?? 0))}
                        </p>
                      </div>
                    </div>
                    <p className="mt-3 line-clamp-3 t-small t-secondary">
                      {event.content}
                    </p>
                  </div>
                ))
              ) : (
                <div className="rounded-xl border border-dashed border-[#d6dfeb] p-6 text-center t-small t-secondary">
                  No assistant chat traces yet for this range.
                </div>
              )}
            </div>
          </div>

          <div className="ehr-shell">
            <div className="ehr-shell-header">Snapshots and RAG lens</div>
            <div className="space-y-3 p-4">
              {filteredSnapshots.length > 0 ? (
                filteredSnapshots.map((snapshot) => (
                  <div
                    key={snapshot.id}
                    className="rounded-xl border border-[#d6dfeb] bg-white p-4"
                  >
                    {(() => {
                      const rag = getRagInsight(snapshot.metadata);
                      const injectedContext = rag
                        ? buildFallbackInjectedContext(rag)
                        : null;
                      return (
                        <>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="t-small font-semibold">
                        {snapshot.source_type} · {snapshot.model_name}
                      </p>
                      <span className="t-micro t-tertiary">
                        {formatDate(snapshot.created_at)}
                      </span>
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-4">
                      <div className="rounded-lg bg-[#f7fafc] p-2">
                        <p className="t-micro t-secondary">Input</p>
                        <p className="t-small font-semibold">
                          {snapshot.input_tokens}
                        </p>
                      </div>
                      <div className="rounded-lg bg-[#f7fafc] p-2">
                        <p className="t-micro t-secondary">Output</p>
                        <p className="t-small font-semibold">
                          {snapshot.output_tokens}
                        </p>
                      </div>
                      <div className="rounded-lg bg-[#f7fafc] p-2">
                        <p className="t-micro t-secondary">Latency</p>
                        <p className="t-small font-semibold">
                          {snapshot.latency_ms} ms
                        </p>
                      </div>
                      <div className="rounded-lg bg-[#f7fafc] p-2">
                        <p className="t-micro t-secondary">Cost</p>
                        <p className="t-small font-semibold">
                          {formatCurrency(snapshot.estimated_cost_usd)}
                        </p>
                      </div>
                    </div>
                    <p className="mt-3 t-micro t-tertiary">
                      Source ID: {snapshot.source_id} · provider {snapshot.provider}
                    </p>
                    {rag && (
                      <div className="mt-4 rounded-xl border border-[#e4ebf3] bg-[#f9fbfe] p-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-fordham-maroon/10 px-2.5 py-1 t-micro font-semibold text-fordham-maroon">
                            RAG {rag.enabled ? "enabled" : "off"}
                          </span>
                          {rag.method && (
                            <span className="t-micro t-tertiary">
                              method {rag.method}
                            </span>
                          )}
                          {typeof rag.topK === "number" && (
                            <span className="t-micro t-tertiary">
                              topK {rag.topK}
                            </span>
                          )}
                          {typeof rag.retrievedChunkCount === "number" && (
                            <span className="t-micro t-tertiary">
                              {rag.retrievedChunkCount} retrieved
                            </span>
                          )}
                          {typeof rag.casesWithRetrievedGuidelines === "number" && (
                            <span className="t-micro t-tertiary">
                              {rag.casesWithRetrievedGuidelines} benchmark cases used retrieval
                            </span>
                          )}
                        </div>

                        {rag.queryTerms && rag.queryTerms.length > 0 && (
                          <div className="mt-3">
                            <p className="t-micro font-semibold uppercase tracking-wider t-secondary">
                              Terms driving retrieval
                            </p>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {rag.queryTerms.slice(0, 8).map((term) => (
                                <span
                                  key={term}
                                  className="rounded-full bg-white px-2 py-1 t-micro text-[#60768f]"
                                >
                                  {term}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {rag.retrievedChunks && rag.retrievedChunks.length > 0 && (
                          <div className="mt-3 space-y-2">
                            <p className="t-micro font-semibold uppercase tracking-wider t-secondary">
                              Retrieved chunks
                            </p>
                            {rag.retrievedChunks.map((chunk) => (
                              <div
                                key={chunk.id}
                                className="rounded-lg border border-[#dfe7ef] bg-white p-3"
                              >
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <p className="t-small font-semibold">
                                    {chunk.title}
                                  </p>
                                  <span className="t-micro t-tertiary">
                                    {chunk.source}
                                    {typeof chunk.score === "number"
                                      ? ` · score ${chunk.score.toFixed(1)}`
                                      : ""}
                                  </span>
                                </div>
                                {chunk.rationale && (
                                  <p className="mt-2 t-small t-secondary">
                                    {chunk.rationale}
                                  </p>
                                )}
                                {chunk.preview && (
                                  <p className="mt-2 t-small text-[#60768f]">
                                    {chunk.preview}
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        {injectedContext && (
                          <details className="mt-3 rounded-lg border border-[#dfe7ef] bg-white">
                            <summary className="cursor-pointer list-none px-3 py-2 t-small font-semibold text-[#223142]">
                              Show {injectedContext.exact ? "exact" : "reconstructed"} injected RAG context
                            </summary>
                            <div className="border-t border-[#eef3f8] px-3 py-3">
                              <p className="t-small t-secondary">
                                {injectedContext.exact
                                  ? "This is the literal retrieved-guideline block appended to the prompt."
                                  : "Older traces did not save the literal block, so this view is reconstructed from the saved chunks."}
                              </p>
                              <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap rounded-lg bg-[#f7fafc] p-3 text-[11px] leading-5 text-[#223142]">
                                {injectedContext.content}
                              </pre>
                            </div>
                          </details>
                        )}

                        {rag.topRetrievedChunks && rag.topRetrievedChunks.length > 0 && (
                          <div className="mt-3">
                            <p className="t-micro font-semibold uppercase tracking-wider t-secondary">
                              Most reused benchmark retrievals
                            </p>
                            <div className="mt-2 space-y-2">
                              {rag.topRetrievedChunks.map((chunk) => (
                                <div
                                  key={chunk.id}
                                  className="rounded-lg border border-[#dfe7ef] bg-white px-3 py-2"
                                >
                                  <p className="t-small font-semibold">
                                    {chunk.title}
                                  </p>
                                  <p className="mt-1 t-micro t-tertiary">
                                    {chunk.source} · {chunk.hits} hits
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {rag.sampleInjectedContexts &&
                          rag.sampleInjectedContexts.length > 0 && (
                            <div className="mt-3 space-y-2">
                              <p className="t-micro font-semibold uppercase tracking-wider t-secondary">
                                Sample exact injected benchmark contexts
                              </p>
                              {rag.sampleInjectedContexts.map((sample) => (
                                <details
                                  key={sample.caseId}
                                  className="rounded-lg border border-[#dfe7ef] bg-white"
                                >
                                  <summary className="cursor-pointer list-none px-3 py-2">
                                    <p className="t-small font-semibold">
                                      Case {sample.caseId}
                                    </p>
                                    <p className="mt-1 t-micro t-tertiary">
                                      {sample.retrievedChunkCount} retrieved · {sample.promptPreview}
                                    </p>
                                  </summary>
                                  <div className="border-t border-[#eef3f8] px-3 py-3">
                                    <p className="t-small t-secondary">
                                      This is the exact guideline block injected for that benchmark case.
                                    </p>
                                    <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap rounded-lg bg-[#f7fafc] p-3 text-[11px] leading-5 text-[#223142]">
                                      {sample.injectedContext}
                                    </pre>
                                  </div>
                                </details>
                              ))}
                            </div>
                          )}
                      </div>
                    )}
                        </>
                      );
                    })()}
                  </div>
                ))
              ) : (
                <div className="rounded-xl border border-dashed border-[#d6dfeb] p-6 text-center t-small t-secondary">
                  No experiment or benchmark snapshots yet for this range.
                </div>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
