"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  Clock3,
  Coins,
  ExternalLink,
  Filter,
  Loader2,
  Search,
} from "lucide-react";

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
  source_type: "chat" | "experiment" | "benchmark";
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
  chatEvents: ChatEvent[];
  snapshots: SnapshotEvent[];
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

export default function ObservabilityPage() {
  const [range, setRange] = useState("7d");
  const [query, setQuery] = useState("");
  const [data, setData] = useState<SummaryResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadSummary = async (nextRange: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/observability/summary?range=${nextRange}`);
      const json = await res.json();
      if (res.ok) setData(json);
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

  return (
    <div className="mx-auto max-w-7xl space-y-6">
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
            href="https://cloud.langfuse.com"
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
            <div className="ehr-shell-header">Experiment and benchmark snapshots</div>
            <div className="space-y-3 p-4">
              {filteredSnapshots.length > 0 ? (
                filteredSnapshots.map((snapshot) => (
                  <div
                    key={snapshot.id}
                    className="rounded-xl border border-[#d6dfeb] bg-white p-4"
                  >
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
