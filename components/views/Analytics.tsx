"use client";

import { Panel, SimpleTable, SimulationBadge } from "@/components/ui/primitives";
import { SIMULATION_DATE } from "@/lib/seed";
import type { ViewProps } from "./shared";

export function Analytics({ state, config }: ViewProps) {
  const providers = config.providers.slice(0, 2);
  const slots = [
    [providers[0]?.name ?? "Dr. Chen", "2026-09-22", "1 day"], [providers[0]?.name ?? "Dr. Chen", "2026-09-25", "4 days"], [providers[0]?.name ?? "Dr. Chen", "2026-09-30", "9 days"],
    [providers[1]?.name ?? "Dr. Patel", "2026-09-21", "0 days"], [providers[1]?.name ?? "Dr. Patel", "2026-09-24", "3 days"], [providers[1]?.name ?? "Dr. Patel", "2026-10-02", "11 days"],
  ];
  const highA1c = state.patients.filter((p) => p.results.some((r) => r.name === "Hemoglobin A1c" && r.status === "Final" && parseFloat(r.value) >= 8));
  const a1cMissing = state.patients.filter((p) => p.results.some((r) => r.name === "Hemoglobin A1c" && r.status !== "Final"));
  const noShows = state.appointments.filter((a) => a.status === "No-show").length;
  const scheduled = state.appointments.filter((a) => a.date <= SIMULATION_DATE && a.status !== "Canceled").length;
  return <div className="grid two-one">
    <Panel title="Appointment access" subtitle={`Snapshot date: ${SIMULATION_DATE}`} actions={<SimulationBadge />}>
      <div className="metric-row"><div><span>{providers[0]?.name}</span><strong>9 days</strong><small>third next routine opening</small></div><div><span>{providers[1]?.name}</span><strong>11 days</strong><small>third next routine opening</small></div><div><span>No-show rate</span><strong>{scheduled ? Math.round((noShows / scheduled) * 100) : 0}%</strong><small>{noShows} of {scheduled} visits through the snapshot date</small></div></div>
      <SimpleTable heads={["Provider", "Open date", "Days from snapshot"]} rows={slots} />
      <p className="help">The first opening may reflect a cancellation. The third opening provides a more stable access signal. Stratify by provider and visit type before making a scheduling decision.</p>
    </Panel>
    <div className="stack">
      <Panel title="Population cohort" subtitle="Deterministic synthetic data"><div className="big-number">{highA1c.length}<small>patients with a final A1c ≥ 8.0% (denominator {state.patients.length})</small></div><ul>{highA1c.map((p) => <li key={p.id}>{p.name} · {p.mrn}</li>)}</ul>{a1cMissing.length > 0 && <p className="help">{a1cMissing.length} patient(s) have an A1c ordered without a final result. They are not in the numerator or the denominator of a result-based measure until the value arrives.</p>}</Panel>
      <Panel title="Data quality checks"><ul className="checklist"><li>Define the denominator</li><li>Confirm units and dates</li><li>Look for missing results</li><li>Stratify by access and patient characteristics</li><li>Validate before outreach</li></ul></Panel>
    </div>
  </div>;
}
