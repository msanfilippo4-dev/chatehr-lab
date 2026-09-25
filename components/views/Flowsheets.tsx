"use client";

import { useMemo, useState, type FormEvent } from "react";
import { NavLink } from "@/components/ui/NavLink";
import { InlineAlert, PageHeader, SimulationBadge, Status, Tip } from "@/components/ui/primitives";
import { computeEws, ewsTone, sepsisScreen, type EwsResult } from "@/lib/clinical/ews";
import { SIM_CLOCK } from "@/lib/clinical/mar";
import { SIMULATION_DATE } from "@/lib/seed";
import { bedsideMonitor, INPATIENT_IDS, suspectedInfection } from "@/lib/seeds/inpatient";
import type { FlowsheetEntry, Patient, Task } from "@/lib/types";
import type { ViewProps } from "./shared";

type Consciousness = NonNullable<FlowsheetEntry["consciousness"]>;
const CONSCIOUSNESS: Consciousness[] = ["Alert", "New confusion", "Voice", "Pain", "Unresponsive"];

interface FormState {
  temp: string;
  hr: string;
  sbp: string;
  dbp: string;
  rr: string;
  spo2: string;
  onOxygen: boolean;
  consciousness: Consciousness | "";
  pain: string;
  intake: string;
  output: string;
  fallRiskReassessed: boolean;
}

const EMPTY: FormState = { temp: "", hr: "", sbp: "", dbp: "", rr: "", spo2: "", onOxygen: false, consciousness: "", pain: "", intake: "", output: "", fallRiskReassessed: false };

const num = (value: string) => (value.trim() === "" ? undefined : Number(value));

function toVitals(form: FormState) {
  return {
    temp: num(form.temp),
    hr: num(form.hr),
    sbp: num(form.sbp),
    dbp: num(form.dbp),
    rr: num(form.rr),
    spo2: num(form.spo2),
    onOxygen: form.onOxygen,
    consciousness: form.consciousness || undefined,
    pain: num(form.pain),
    intake: num(form.intake),
    output: num(form.output),
  };
}

export function Flowsheets(props: ViewProps) {
  const { state, patient, selectPatient } = props;
  const inpatients = INPATIENT_IDS.map((id) => state.patients.find((item) => item.id === id)).filter(Boolean) as Patient[];
  if (!INPATIENT_IDS.includes(patient.id)) {
    return (
      <div>
        <PageHeader title="Flowsheets" eyebrow="4 West · Nursing documentation" subtitle="Flowsheets are documented for inpatients. Choose a patient admitted to 4 West." />
        <div className="card emar-pick">
          <p>{patient.name} is not admitted. Open an inpatient flowsheet:</p>
          <div className="button-row">
            {inpatients.map((item) => (
              <button key={item.id} className="primary" onClick={() => selectPatient(item.id)}>{`Open ${item.name}'s flowsheet`}</button>
            ))}
          </div>
        </div>
      </div>
    );
  }
  return <FlowsheetForPatient key={patient.id} {...props} inpatients={inpatients} />;
}

function FlowsheetForPatient({ state, dispatch, patient, role, selectPatient, makeId, readOnly, navigate, inpatients }: ViewProps & { inpatients: Patient[] }) {
  const entries = useMemo(
    () => state.flowsheets.filter((item) => item.patientId === patient.id).sort((a, b) => a.time.localeCompare(b.time)),
    [state.flowsheets, patient.id],
  );
  const scored = useMemo(() => entries.map((entry) => ({ entry, ews: computeEws(entry) })), [entries]);
  const latest = scored.at(-1);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [message, setMessage] = useState<{ text: string; tone: "success" | "error" } | null>(null);
  const [escalation, setEscalation] = useState("");

  const vitals = toVitals(form);
  const live = computeEws(vitals);
  const liveSepsis = sepsisScreen(vitals, Boolean(suspectedInfection[patient.id]));
  const hasValues = [form.temp, form.hr, form.sbp, form.rr, form.spo2].some((value) => value.trim() !== "");

  function pullMonitor() {
    const monitor = bedsideMonitor[patient.id];
    if (!monitor) return;
    setForm((current) => ({
      ...current,
      temp: monitor.temp !== undefined ? String(monitor.temp) : current.temp,
      hr: monitor.hr !== undefined ? String(monitor.hr) : current.hr,
      sbp: monitor.sbp !== undefined ? String(monitor.sbp) : current.sbp,
      dbp: monitor.dbp !== undefined ? String(monitor.dbp) : current.dbp,
      rr: monitor.rr !== undefined ? String(monitor.rr) : current.rr,
      spo2: monitor.spo2 !== undefined ? String(monitor.spo2) : current.spo2,
      onOxygen: monitor.onOxygen ?? current.onOxygen,
      consciousness: monitor.consciousness ?? current.consciousness,
      pain: monitor.pain !== undefined ? String(monitor.pain) : current.pain,
    }));
    setMessage(null);
  }

  function fileTime(): string {
    let [h, m] = SIM_CLOCK.split(":").map(Number);
    const taken = new Set(entries.map((item) => item.time));
    let time = `${SIMULATION_DATE}T${SIM_CLOCK}`;
    while (taken.has(time)) {
      m += 1;
      if (m === 60) { m = 0; h += 1; }
      time = `${SIMULATION_DATE}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    }
    return time;
  }

  function file(event: FormEvent) {
    event.preventDefault();
    if (!hasValues || live.missing.length > 3) {
      setMessage({ text: "Document at least temperature, heart rate, blood pressure, respiratory rate, and SpO2 before filing.", tone: "error" });
      return;
    }
    const time = fileTime();
    let text = "";
    let task: Task | undefined;
    if (live.risk === "High" || live.risk === "Medium") {
      const screen = sepsisScreen(vitals, Boolean(suspectedInfection[patient.id]));
      const high = live.risk === "High";
      const response = high ? "rapid response team called" : "charge nurse and provider notified";
      text = `EWS ${live.total} (${live.risk}) · sepsis screen ${screen.positive ? "positive" : "negative"} · ${response}`;
      task = {
        id: makeId("TASK"),
        patientId: patient.id,
        title: `${high ? "Rapid response" : "Urgent review"}: EWS ${live.total} (${live.risk}), sepsis screen ${screen.positive ? "positive" : "negative"} at ${time.slice(11, 16)}`,
        due: SIMULATION_DATE,
        complete: false,
        owner: high ? "Rapid response team" : "Charge nurse and provider",
      };
    }
    const entry: FlowsheetEntry = {
      id: makeId("FS"),
      patientId: patient.id,
      time,
      ...vitals,
      fallRiskReassessed: form.fallRiskReassessed,
      recordedBy: `${role} learner`,
      ews: live.total,
      escalation: text || undefined,
    };
    dispatch({ type: "documentFlowsheet", entry, task });
    setEscalation(text);
    setMessage({ text: `Vitals filed at ${time.slice(11, 16)}. EWS ${live.total} (${live.risk}).${task ? ` Task created for ${task.owner}.` : ""}`, tone: "success" });
    setForm(EMPTY);
  }

  const latestEscalation = [...entries].reverse().find((item) => item.escalation)?.escalation;

  return (
    <div className="flowsheets">
      <PageHeader
        title="Flowsheets"
        eyebrow="4 West · Vitals, I&O, and early warning score"
        subtitle="Every set of vitals is scored with a simplified NEWS2 early warning score. A medium or high score triggers the sepsis screen and escalation."
        actions={(
          <>
            <label className="emar-inpatient">
              <span>Inpatient</span>
              <select aria-label="Inpatient" value={patient.id} onChange={(event) => selectPatient(event.target.value)}>
                {inpatients.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.location}</option>)}
              </select>
            </label>
            <SimulationBadge />
          </>
        )}
      />
      <div className="flow-status">
        {latest && (
          <span className={`chip-pill ${ewsTone(latest.ews.risk) === "danger" ? "danger" : ewsTone(latest.ews.risk) === "warn" ? "warn" : "good"}`}>
            Latest EWS {latest.entry.ews ?? latest.ews.total} ({latest.ews.risk}) at {formatTime(latest.entry.time)}
          </span>
        )}
        <span className={`chip-pill ${latestEscalation ? "danger" : "neutral"}`}>
          {latestEscalation ? `Sepsis screen / escalation: ${latestEscalation}` : "Sepsis screen: not triggered"}
        </span>
      </div>
      <FlowGrid scored={scored} />
      <p className="flow-meta">Fall risk reassessment moved to row FS-2203 on 9/14 (replaces FS-1180).</p>

      <div className="flow-document">
        <form className="card flow-form" onSubmit={file} aria-label="Document vitals">
          <div className="flow-form-head">
            <h2>Document vitals</h2>
            <button type="button" onClick={pullMonitor} disabled={readOnly}>Pull bedside monitor values</button>
          </div>
          <p className="help">Simulated time {SIM_CLOCK}. Values from the bedside monitor still need your review before filing.</p>
          <div className="flow-fields">
            <NumberField label="Temperature (°C)" value={form.temp} step="0.1" onChange={(temp) => setForm({ ...form, temp })} />
            <NumberField label="Heart rate" value={form.hr} onChange={(hr) => setForm({ ...form, hr })} />
            <NumberField label="Systolic BP" value={form.sbp} onChange={(sbp) => setForm({ ...form, sbp })} />
            <NumberField label="Diastolic BP" value={form.dbp} onChange={(dbp) => setForm({ ...form, dbp })} />
            <NumberField label="Respiratory rate" value={form.rr} onChange={(rr) => setForm({ ...form, rr })} />
            <NumberField label="SpO2 (%)" value={form.spo2} onChange={(spo2) => setForm({ ...form, spo2 })} />
            <label className="field">
              <span>Consciousness</span>
              <select aria-label="Consciousness" value={form.consciousness} onChange={(event) => setForm({ ...form, consciousness: event.target.value as Consciousness | "" })}>
                <option value="">Choose</option>
                {CONSCIOUSNESS.map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>
            <NumberField label="Pain (0–10)" value={form.pain} onChange={(pain) => setForm({ ...form, pain })} />
            <NumberField label="Intake (mL)" value={form.intake} onChange={(intake) => setForm({ ...form, intake })} />
            <NumberField label="Output (mL)" value={form.output} onChange={(output) => setForm({ ...form, output })} />
          </div>
          <div className="flow-checks">
            <label><input type="checkbox" checked={form.onOxygen} onChange={(event) => setForm({ ...form, onOxygen: event.target.checked })} /> On supplemental oxygen</label>
            <label><input type="checkbox" checked={form.fallRiskReassessed} onChange={(event) => setForm({ ...form, fallRiskReassessed: event.target.checked })} /> Fall risk reassessed</label>
          </div>
          <div className="button-row">
            <button type="submit" className="primary" disabled={readOnly}>File vitals</button>
          </div>
          {message && <p className={`form-message ${message.tone}`} role="status">{message.text}</p>}
          {escalation && (
            <InlineAlert tone="danger" title="Escalation triggered">
              <p>{escalation}. A task is on the Worklist for the responding team.</p>
              <NavLink target={{ view: "Worklist" }} navigate={navigate}>Open the Worklist</NavLink>
            </InlineAlert>
          )}
        </form>
        <LiveEws result={live} hasValues={hasValues} sepsisPositive={liveSepsis.positive} criteria={liveSepsis.criteria} infection={Boolean(suspectedInfection[patient.id])} />
      </div>
      <Tip>
        An early warning score only helps if it is documented on time and someone owns the response. The same goes for measures:
        when Quality reported that fall-risk reassessment dropped after the 9/14 flowsheet change (TKT-1045), check which row
        the report reads (FS-1180 or FS-2203) before asking nurses to change practice.
      </Tip>
    </div>
  );
}

function NumberField({ label, value, onChange, step = "1" }: { label: string; value: string; onChange: (value: string) => void; step?: string }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input type="number" inputMode="decimal" step={step} aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function formatTime(time: string) {
  const [date, clock] = time.split("T");
  const [, m, d] = date.split("-");
  return `${Number(m)}/${Number(d)} ${clock}`;
}

/* ------------------------------------------------------------------ grid */

interface Scored { entry: FlowsheetEntry; ews: EwsResult }

interface RowDef {
  label: string;
  value: (entry: FlowsheetEntry) => string;
  /** EWS parameter names whose points mark this cell abnormal. */
  parameters?: string[];
}

const ROWS: RowDef[] = [
  { label: "Temp (°C)", value: (e) => (e.temp === undefined ? "" : e.temp.toFixed(1)), parameters: ["Temperature"] },
  { label: "Heart rate", value: (e) => fmt(e.hr), parameters: ["Heart rate"] },
  { label: "BP", value: (e) => (e.sbp !== undefined ? `${e.sbp}/${e.dbp ?? "—"}` : ""), parameters: ["Systolic BP"] },
  { label: "Resp rate", value: (e) => fmt(e.rr), parameters: ["Respiratory rate"] },
  { label: "SpO₂ (%)", value: (e) => fmt(e.spo2), parameters: ["SpO2"] },
  { label: "O₂ (RA / supplemental)", value: (e) => (e.onOxygen ? "Supplemental" : e.spo2 !== undefined ? "RA" : ""), parameters: ["Supplemental oxygen"] },
  { label: "Consciousness", value: (e) => e.consciousness ?? "", parameters: ["Consciousness"] },
  { label: "Pain (0–10)", value: (e) => fmt(e.pain) },
  { label: "Intake (mL)", value: (e) => fmt(e.intake) },
  { label: "Output (mL)", value: (e) => fmt(e.output) },
  { label: "Fall risk reassessment (FS-2203)", value: (e) => (e.fallRiskReassessed ? "✓" : "") },
];

function fmt(value: number | undefined) {
  return value === undefined || value === null ? "" : String(value);
}

function FlowGrid({ scored }: { scored: Scored[] }) {
  return (
    <div className="grid-table-wrap flow-grid-wrap">
      <table className="grid-table flow-grid">
        <caption className="sr-only">Flowsheet: rows are measures, columns are documentation times</caption>
        <thead>
          <tr>
            <th scope="col">Row</th>
            {scored.map(({ entry }) => (
              <th scope="col" key={entry.id}>
                {formatTime(entry.time)}
                <small>{entry.seeded ? entry.recordedBy.replace(", RN", " RN") : "you"}</small>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ROWS.map((row) => (
            <tr key={row.label}>
              <th scope="row">{row.label}</th>
              {scored.map(({ entry, ews }) => {
                const value = row.value(entry);
                const abnormal = row.parameters?.some((name) => (ews.parameters.find((item) => item.parameter === name)?.points ?? 0) > 0);
                return <td key={entry.id} className={abnormal && value ? "abnormal" : value ? "" : "muted-cell"}>{value || "—"}</td>;
              })}
            </tr>
          ))}
          <tr className="highlight ews-row">
            <th scope="row">Early warning score</th>
            {scored.map(({ entry, ews }) => {
              const tone = ewsTone(ews.risk);
              return (
                <td key={entry.id}>
                  <span className={`ews-pill ${tone}`}>{entry.ews ?? ews.total}</span>
                  <small>{ews.risk}</small>
                </td>
              );
            })}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------------ live score */

function LiveEws({ result, hasValues, sepsisPositive, criteria, infection }: { result: EwsResult; hasValues: boolean; sepsisPositive: boolean; criteria: string[]; infection: boolean }) {
  const tone = ewsTone(result.risk);
  const escalate = result.risk === "Medium" || result.risk === "High";
  return (
    <aside className={`card ews-live ${hasValues ? tone : "idle"}`} aria-live="polite" aria-label="Early warning score">
      <span className="page-eyebrow">Early warning score (live)</span>
      <div className="ews-total">
        <strong>{hasValues ? result.total : "—"}</strong>
        <Status tone={hasValues ? tone : "neutral"}>{hasValues ? `${result.risk} risk` : "Enter vitals"}</Status>
      </div>
      <p className="ews-response">{hasValues ? result.response : "The score updates as you type."}</p>
      <table className="ews-table">
        <thead>
          <tr><th>Parameter</th><th>Value</th><th>Points</th></tr>
        </thead>
        <tbody>
          {result.parameters.map((item) => (
            <tr key={item.parameter} className={item.points >= 3 ? "red" : item.points > 0 ? "amber" : ""}>
              <td>{item.parameter}</td>
              <td>{item.value}</td>
              <td>{item.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {result.missing.length > 0 && <p className="help">Not documented: {result.missing.join(", ")}.</p>}
      {hasValues && escalate && (
        <InlineAlert tone={sepsisPositive ? "danger" : "warn"} title={`Sepsis screen ${sepsisPositive ? "positive" : "negative"}`}>
          <p>{infection ? "Suspected infection on file (pneumonia). " : "No suspected infection on file. "}{criteria.length ? `Criteria met: ${criteria.join("; ")}.` : "No SIRS criteria met."}</p>
          <p>Filing these vitals creates an escalation task.</p>
        </InlineAlert>
      )}
    </aside>
  );
}
