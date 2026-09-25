"use client";

import { useState } from "react";
import { KpiRow, PageHeader, Panel, SimpleTable, SimulationBadge, Tip } from "@/components/ui/primitives";
import type { CourseConfig } from "@/lib/config/types";
import { SIMULATION_DATE } from "@/lib/seed";
import { alertStats, fallReassessment, FALL_REPORT_DEFINITION, type FallWeek } from "@/lib/seeds/quality";
import type { EHRState } from "@/lib/types";
import type { ViewProps } from "./shared";

const pct = (numerator: number, denominator: number) => (denominator ? Math.round((numerator / denominator) * 100) : 0);

function fallRate(week: FallWeek, includeNewRow: boolean) {
  const numerator = week.oldRow + (includeNewRow ? week.newRow : 0);
  return { numerator, rate: pct(numerator, week.eligiblePatientDays) };
}

function unownedMessages(state: EHRState, config: CourseConfig) {
  return state.messages.filter((message) => {
    if (message.status !== "New") return false;
    const text = `${message.subject} ${message.body}`;
    return !config.routingRules.some((rule) => {
      try { return new RegExp(rule.keywordPattern, "i").test(text); } catch { return false; }
    });
  }).length;
}

export function Analytics({ state, config }: ViewProps) {
  const [includeNewRow, setIncludeNewRow] = useState(false);
  const noShows = state.appointments.filter((item) => item.status === "No-show").length;
  const scheduled = state.appointments.filter((item) => item.date <= SIMULATION_DATE && item.status !== "Canceled").length;
  const potassium = alertStats.find((item) => item.rule === "ALR-K");
  const sep14 = fallReassessment.find((week) => week.week === "Sep 14") ?? fallReassessment[0];

  return (
    <div className="analytics-view">
      <PageHeader
        eyebrow="Operational and quality reporting"
        title="Analytics"
        subtitle={`Synthetic operational data for Fordham Health · snapshot ${SIMULATION_DATE}. Every rate shows its numerator and denominator.`}
        actions={<SimulationBadge />}
      />
      <KpiRow
        items={[
          { label: "No-show rate (to date)", value: `${pct(noShows, scheduled)}%`, note: `${noShows} of ${scheduled} visits`, tone: "warn" },
          { label: "Potassium alert override rate", value: `${potassium?.overriddenPct ?? 0}%`, note: `${potassium?.fired ?? 0} firings in 7 days (ALR-K)`, tone: "danger" },
          { label: "Portal messages with no routing match", value: unownedMessages(state, config), note: "New messages no rule would route", tone: "warn" },
          { label: "Fall reassessment, week of Sep 14", value: `${fallRate(sep14, false).rate}% → ${fallRate(sep14, true).rate}%`, note: "Report definition vs. recalculated with FS-2203", tone: "info" },
        ]}
      />
      <div className="grid two-one">
        <div className="stack">
          <FallPanel includeNewRow={includeNewRow} onToggle={setIncludeNewRow} />
          <AlertPanel />
        </div>
        <div className="stack">
          <AccessPanel state={state} config={config} />
          <CohortPanel state={state} />
          <Panel title="Data quality checks">
            <ul className="checklist">
              <li>Define the denominator</li>
              <li>Confirm units, dates, and the data element the report reads</li>
              <li>Look for missing results and moved documentation</li>
              <li>Stratify by access and patient characteristics</li>
              <li>Validate before outreach or corrective action</li>
            </ul>
            <Tip>Prove a number before anyone acts on it. When a measure moves sharply the same week a build changed, check the definition and the data element first.</Tip>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function FallPanel({ includeNewRow, onToggle }: { includeNewRow: boolean; onToggle: (value: boolean) => void }) {
  return (
    <Panel title="Fall-risk reassessment · 4 West" subtitle="Quality measure behind ticket TKT-1045. The flowsheet build changed on 9/14.">
      <p className="help analytics-definition"><strong>Report definition:</strong> {FALL_REPORT_DEFINITION}</p>
      <label className="analytics-toggle">
        <input type="checkbox" checked={includeNewRow} onChange={(event) => onToggle(event.target.checked)} />
        Include new flowsheet row FS-2203
      </label>
      <div className="fall-chart" role="img" aria-label={`Weekly fall-risk reassessment rate ${includeNewRow ? "including" : "excluding"} row FS-2203`}>
        {fallReassessment.map((week) => {
          const { rate } = fallRate(week, includeNewRow);
          return (
            <div key={week.week} className="fall-bar">
              <span className="fall-rate">{rate}%</span>
              <div className="fall-track">
                {includeNewRow && <i className="new-row" style={{ height: `${pct(week.newRow, week.eligiblePatientDays)}%` }} />}
                <i className={rate < 75 ? "low" : ""} style={{ height: `${pct(week.oldRow, week.eligiblePatientDays)}%` }} />
              </div>
              <span className="fall-week">{week.week}</span>
            </div>
          );
        })}
      </div>
      <p className="fall-legend"><i /> Row FS-1180 (retired) {includeNewRow && <><i className="new-row" /> Row FS-2203 (new, live 9/14)</>}</p>
      <SimpleTable
        caption="Fall-risk reassessment by week"
        heads={["Week", "Row FS-1180", "Row FS-2203", "Counted", "Eligible patient-days", "Rate"]}
        rows={fallReassessment.map((week) => {
          const { numerator, rate } = fallRate(week, includeNewRow);
          return [week.week, String(week.oldRow), includeNewRow ? String(week.newRow) : <span className="muted-cell">{week.newRow} (not counted)</span>, String(numerator), String(week.eligiblePatientDays), <strong className={rate < 75 ? "abnormal" : ""}>{rate}%</strong>];
        })}
      />
    </Panel>
  );
}

function AlertPanel() {
  return (
    <Panel title="Top interruptive alerts (7 days)" subtitle="Firing volume and override rate by rule. High override rates usually mean a poorly targeted rule.">
      <table className="alert-table">
        <thead>
          <tr><th>Alert</th><th>Rule</th><th>Fired</th><th>Overridden</th><th>Latest value normal</th><th>Note</th></tr>
        </thead>
        <tbody>
          {alertStats.map((stat) => (
            <tr key={stat.rule} className={stat.rule === "ALR-K" ? "highlight-row" : ""}>
              <td><strong>{stat.alert}</strong></td>
              <td>{stat.rule}</td>
              <td>{stat.fired.toLocaleString()}</td>
              <td className={stat.overriddenPct >= 90 ? "abnormal" : ""}>{stat.overriddenPct}%</td>
              <td>{stat.latestValueNormalPct !== undefined ? `${stat.latestValueNormalPct}%` : "—"}</td>
              <td><small>{stat.note}</small></td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );
}

function AccessPanel({ state, config }: { state: EHRState; config: CourseConfig }) {
  const providers = config.providers.slice(0, 2);
  const first = providers[0]?.name ?? "Dr. Chen";
  const second = providers[1]?.name ?? "Dr. Patel";
  const slots = [
    [first, "2026-09-22", "1 day"], [first, "2026-09-25", "4 days"], [first, "2026-09-30", "9 days"],
    [second, "2026-09-21", "0 days"], [second, "2026-09-24", "3 days"], [second, "2026-10-02", "11 days"],
  ];
  const noShows = state.appointments.filter((item) => item.status === "No-show").length;
  const scheduled = state.appointments.filter((item) => item.date <= SIMULATION_DATE && item.status !== "Canceled").length;
  return (
    <Panel title="Appointment access" subtitle={`Snapshot date: ${SIMULATION_DATE}`}>
      <div className="metric-row">
        <div><span>{first}</span><strong>9 days</strong><small>third next routine opening</small></div>
        <div><span>{second}</span><strong>11 days</strong><small>third next routine opening</small></div>
        <div><span>No-show rate</span><strong>{pct(noShows, scheduled)}%</strong><small>{noShows} of {scheduled} visits through the snapshot date</small></div>
      </div>
      <SimpleTable heads={["Provider", "Open date", "Days from snapshot"]} rows={slots} />
      <p className="help">The first opening may reflect a cancellation. The third opening is a steadier access signal. Stratify by provider and visit type before making a scheduling decision.</p>
    </Panel>
  );
}

function CohortPanel({ state }: { state: EHRState }) {
  const highA1c = state.patients.filter((patient) => patient.results.some((result) => result.name === "Hemoglobin A1c" && result.status === "Final" && parseFloat(result.value) >= 8));
  const missing = state.patients.filter((patient) => patient.results.some((result) => result.name === "Hemoglobin A1c" && result.status !== "Final"));
  return (
    <Panel title="Population cohort" subtitle="Deterministic synthetic data">
      <div className="big-number">
        {highA1c.length}
        <small>patients with a final A1c ≥ 8.0% (denominator {state.patients.length})</small>
      </div>
      <ul>{highA1c.map((patient) => <li key={patient.id}>{patient.name} · {patient.mrn}</li>)}</ul>
      {missing.length > 0 && (
        <p className="help">{missing.length} patient(s) have an A1c ordered without a final result. They are not in the numerator or the denominator of a result-based measure until the value arrives.</p>
      )}
    </Panel>
  );
}
