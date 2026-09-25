"use client";

import { useMemo, useState } from "react";
import { Field, InlineAlert, PageHeader, Panel, SimulationBadge, Tip } from "@/components/ui/primitives";
import { resultValue } from "@/lib/patient";
import type { EHRState, Patient } from "@/lib/types";
import { nowIso, type ViewProps } from "./shared";

interface QueryDefinition {
  name: string;
  definition: string;
  sql: string;
  /** Returns true if the patient is in the numerator; null when the required data element is missing. */
  test: (patient: Patient, state: EHRState) => boolean | null;
  evidence: (patient: Patient, state: EHRState) => string;
}

const queryDefinitions: QueryDefinition[] = [
  {
    name: "A1c ≥ 8%",
    definition: "Final Hemoglobin A1c result ≥ 8.0% in the displayed longitudinal record",
    sql: "SELECT DISTINCT patient_id\nFROM results\nWHERE test_name = 'Hemoglobin A1c'\n  AND status = 'Final'\n  AND numeric_value >= 8.0;",
    test: (p) => {
      const r = p.results.find((item) => item.name === "Hemoglobin A1c");
      if (!r) return null;
      if (r.status !== "Final" || !r.value) return null;
      return parseFloat(r.value) >= 8;
    },
    evidence: (p) => {
      const r = p.results.find((item) => item.name === "Hemoglobin A1c");
      return r ? `${r.value ? resultValue(r) : "no value"} · ${r.status}` : "no A1c on record";
    },
  },
  {
    name: "Systolic BP ≥ 140",
    definition: "Most recent systolic blood pressure ≥ 140 mmHg",
    sql: "SELECT patient_id\nFROM latest_vitals\nWHERE systolic_bp >= 140;",
    test: (p) => (p.vitals[0] ? parseInt(p.vitals[0].bp) >= 140 : null),
    evidence: (p) => p.vitals[0]?.bp ?? "no vitals",
  },
  {
    name: "Abnormal potassium",
    definition: "Final potassium result flagged High",
    sql: "SELECT DISTINCT patient_id\nFROM results\nWHERE test_name = 'Potassium'\n  AND status = 'Final'\n  AND flag = 'High';",
    test: (p) => {
      const r = p.results.find((item) => item.name === "Potassium");
      return r ? r.flag === "High" && r.status === "Final" : null;
    },
    evidence: (p) => {
      const r = p.results.find((item) => item.name === "Potassium");
      return r ? resultValue(r) : "no potassium on record";
    },
  },
  {
    name: "Open portal messages",
    definition: "At least one portal message with status New",
    sql: "SELECT DISTINCT patient_id\nFROM portal_messages\nWHERE status = 'New';",
    test: (p, state) => state.messages.some((m) => m.patientId === p.id && m.status === "New"),
    evidence: (p, state) => state.messages.find((m) => m.patientId === p.id && m.status === "New")?.subject ?? "no open messages",
  },
];

type Stratum = "insurance" | "language" | "sex";

export function QueryStudio({ state, dispatch, makeId, readOnly }: ViewProps) {
  const [queryName, setQueryName] = useState(queryDefinitions[0].name);
  const [latest, setLatest] = useState<{ ids: string[]; missing: string[] } | null>(null);
  const [stratifyBy, setStratifyBy] = useState<Stratum>("insurance");
  const [validationNote, setValidationNote] = useState("");
  const [saveNote, setSaveNote] = useState("");
  const [status, setStatus] = useState("");
  const query = queryDefinitions.find((item) => item.name === queryName) ?? queryDefinitions[0];

  const evaluated = useMemo(() => state.patients.map((patient) => ({ patient, result: query.test(patient, state) })), [query, state]);
  const matches = evaluated.filter((row) => row.result === true).map((row) => row.patient);
  const missing = evaluated.filter((row) => row.result === null).map((row) => row.patient);
  const displayed = latest ? state.patients.filter((p) => latest.ids.includes(p.id)) : [];
  const groups = useMemo(() => {
    const keyOf = (p: Patient) => (stratifyBy === "insurance" ? p.insurance : stratifyBy === "language" ? p.language : p.sex);
    const present = [...new Set(state.patients.map(keyOf))];
    return present.map((label) => ({
      label,
      numerator: displayed.filter((p) => keyOf(p) === label).length,
      denominator: state.patients.filter((p) => keyOf(p) === label).length,
    }));
  }, [stratifyBy, displayed, state.patients]);

  function runQuery() {
    const ids = matches.map((p) => p.id);
    setLatest({ ids, missing: missing.map((p) => p.id) });
    dispatch({
      type: "runQuery",
      run: {
        id: makeId("QRY"),
        name: query.name,
        definition: query.definition,
        executedAt: nowIso(),
        rowCount: ids.length,
        patientIds: ids,
        denominator: state.patients.length,
        missing: missing.length,
        stratification: groups.map((g) => ({ label: g.label, count: g.numerator })),
      },
    });
    setStatus(`Ran "${query.name}": ${ids.length} of ${state.patients.length} patients matched; ${missing.length} could not be evaluated because the data element is missing or not final.`);
  }

  function saveDefinition() {
    if (saveNote.trim().length < 20) {
      setStatus("Write a definition note of at least 20 characters before saving.");
      return;
    }
    dispatch({ type: "saveQuery", definition: { id: makeId("QDEF"), name: query.name, baseQuery: query.sql, note: saveNote.trim(), createdAt: nowIso() } });
    setSaveNote("");
    setStatus(`Saved a reusable definition for "${query.name}".`);
  }

  function recordValidation() {
    if (!latest || validationNote.trim().length < 80) {
      setStatus("Run a query and enter a validation note of at least 80 characters.");
      return;
    }
    dispatch({ type: "validateQuery", name: query.name, rowCount: displayed.length, note: validationNote.trim() });
    setStatus("Validation evidence recorded.");
  }

  return (
    <div className="query-view">
      <PageHeader
        eyebrow="Analytics"
        title="Population Query Studio"
        subtitle="Define → preview logic → run → validate → stratify. Every run keeps its denominator and the patients who could not be evaluated."
        actions={<SimulationBadge />}
      />
      <div className="grid two-one">
        <div className="stack">
          <Panel title="Cohort definition" subtitle="Choose a definition and read its logic before running">
            <div className="query-builder">
              <Field label="Cohort definition">
                <select aria-label="Cohort definition" value={queryName} onChange={(e) => { setQueryName(e.target.value); setLatest(null); }}>
                  {queryDefinitions.map((item) => <option key={item.name}>{item.name}</option>)}
                </select>
              </Field>
              <p><b>Operational definition:</b> {query.definition}</p>
              <p><b>Denominator:</b> all {state.patients.length} patients in this workspace with a usable value for the data element. Patients with a missing or non-final value are reported separately, never silently dropped.</p>
              <pre className="query-preview" aria-label="Query logic preview">{query.sql}</pre>
              <div><button className="primary" onClick={runQuery} disabled={readOnly}>Run cohort query</button></div>
              {status && <p className="form-message success" role="status">{status}</p>}
            </div>
          </Panel>
          {latest && (
            <Panel title="Query result" subtitle={`${displayed.length} matched · ${latest.missing.length} missing · denominator ${state.patients.length}`}>
              <table>
                <thead><tr><th>Patient</th><th>MRN</th><th>Coverage</th><th>Evidence</th></tr></thead>
                <tbody>
                  {displayed.map((p) => (
                    <tr key={p.id}><td>{p.name}</td><td>{p.mrn}</td><td>{p.insurance}</td><td>{query.evidence(p, state)}</td></tr>
                  ))}
                  {latest.missing.map((id) => {
                    const p = state.patients.find((row) => row.id === id);
                    if (!p) return null;
                    return (
                      <tr key={id} className="missing-row"><td>{p.name}</td><td>{p.mrn}</td><td>{p.insurance}</td><td>Missing: {query.evidence(p, state)}</td></tr>
                    );
                  })}
                </tbody>
              </table>
            </Panel>
          )}
          <Panel title="Saved query definitions" subtitle="Reproducible definitions carry the exact denominator and status logic">
            <div className="form-stack panel-pad">
              <Field label="Definition note" hint="State the time window, status requirement, threshold, and denominator.">
                <input value={saveNote} onChange={(e) => setSaveNote(e.target.value)} placeholder={`Example: ${query.definition}; final results only; all active patients`} />
              </Field>
              <div><button onClick={saveDefinition} disabled={readOnly}>Save definition</button></div>
            </div>
            <div className="run-list">
              {state.savedQueries.slice(0, 5).map((item) => <p key={item.id}><strong>{item.name}</strong><span>{item.note}</span></p>)}
              {!state.savedQueries.length && <p className="empty">No saved definitions.</p>}
            </div>
          </Panel>
        </div>
        <div className="stack">
          <Panel title="Stratification" subtitle="A first stratification, not an equity conclusion">
            <div className="form-stack panel-pad">
              <Field label="Stratify by">
                <select value={stratifyBy} onChange={(e) => setStratifyBy(e.target.value as Stratum)}>
                  <option value="insurance">Coverage</option>
                  <option value="language">Preferred language</option>
                  <option value="sex">Sex</option>
                </select>
              </Field>
            </div>
            <table className="strat-table">
              <thead><tr><th>Group</th><th>In cohort</th><th>Group size</th><th>Rate</th></tr></thead>
              <tbody>
                {groups.map((g) => (
                  <tr key={g.label}>
                    <td>{g.label}</td>
                    <td>{g.numerator}</td>
                    <td>{g.denominator}</td>
                    <td>{g.denominator ? `${Math.round((g.numerator / g.denominator) * 100)}%` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="help panel-pad">Small groups produce unstable rates. Report counts with rates and say what the data cannot establish.</p>
          </Panel>
          <Panel title="Validation checklist" subtitle="Record what you checked before anyone acts on the number">
            <ul className="checklist">
              <li>Confirm the denominator and time window.</li>
              <li>Inspect units, status, and missing values.</li>
              <li>Test a sample against the source chart.</li>
              <li>Separate measurement from causal claims.</li>
              <li>Record the exact cohort definition.</li>
            </ul>
            <div className="form-stack panel-pad">
              <Field label="Validation note">
                <textarea rows={5} value={validationNote} onChange={(e) => setValidationNote(e.target.value)} placeholder="State the denominator, the patient-level check you performed, a data-quality limitation, and the interpretation boundary." />
              </Field>
              <div><button className="primary" onClick={recordValidation} disabled={readOnly}>Record validation</button></div>
            </div>
          </Panel>
          <Panel title="Saved query runs" subtitle="Reproducible evidence in this workspace">
            <div className="run-list">
              {state.queryRuns.length
                ? state.queryRuns.slice(0, 6).map((run) => (
                  <p key={run.id}><strong>{run.name}</strong><span>{run.rowCount}/{run.denominator ?? "?"} rows · {run.missing ?? 0} missing · {new Date(run.executedAt).toLocaleString()}</span></p>
                ))
                : <p className="empty">No queries have been run.</p>}
            </div>
          </Panel>
          <InlineAlert tone="info" title="Interpretation boundary">
            <p>A cohort count describes who meets a definition today. It does not establish cause, and it does not by itself justify an intervention.</p>
          </InlineAlert>
          <Tip>Prove the number before you present it: one patient-level spot check catches most unit, status, and missingness errors.</Tip>
        </div>
      </div>
    </div>
  );
}
