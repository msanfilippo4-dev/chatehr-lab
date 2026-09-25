"use client";

import { useMemo, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { InlineAlert, KpiRow, PageHeader, SimulationBadge, Status, Tip, type Tone } from "@/components/ui/primitives";
import {
  fiveRightsCheck, HOLD_REASONS, OVERRIDE_REASONS, SIM_CLOCK, slotState, toMinutes, type FiveRightsResult, type SlotState,
} from "@/lib/clinical/mar";
import { SIMULATION_DATE } from "@/lib/seed";
import { drawerItems, INPATIENT_IDS, unitWristbands } from "@/lib/seeds/inpatient";
import type { MarAdministration, MarOrder, Patient } from "@/lib/types";
import { nowIso, type ViewProps } from "./shared";

interface Dose { orderId: string; slot: string }

const STATE_CLASS: Record<SlotState, string> = {
  Given: "cell-given",
  "Given late": "cell-late",
  Held: "cell-held",
  Override: "cell-override",
  Overdue: "cell-overdue",
  Due: "cell-due",
  Future: "cell-future",
};

const COMPLETED: SlotState[] = ["Given", "Given late", "Held", "Override"];

export function EMar(props: ViewProps) {
  const { state, patient, selectPatient } = props;
  const inpatients = INPATIENT_IDS.map((id) => state.patients.find((item) => item.id === id)).filter(Boolean) as Patient[];

  if (!INPATIENT_IDS.includes(patient.id)) {
    return (
      <div>
        <PageHeader title="eMAR" eyebrow="4 West · Medication administration" subtitle="The eMAR is for inpatients. Choose a patient admitted to 4 West." />
        <div className="card emar-pick">
          <p>{patient.name} is not admitted. Open an inpatient MAR:</p>
          <div className="button-row">
            {inpatients.map((item) => (
              <button key={item.id} className="primary" onClick={() => selectPatient(item.id)}>{`Open ${item.name}'s MAR`}</button>
            ))}
          </div>
        </div>
      </div>
    );
  }
  return <EMarForPatient key={patient.id} {...props} inpatients={inpatients} />;
}

function EMarForPatient({ state, dispatch, patient, role, selectPatient, makeId, readOnly, inpatients }: ViewProps & { inpatients: Patient[] }) {
  const orders = state.marOrders.filter((order) => order.patientId === patient.id);
  const administrations = state.marAdministrations.filter((item) => item.patientId === patient.id);
  const todays = administrations.filter((item) => !item.date || item.date === SIMULATION_DATE);
  const slots = useMemo(() => [...new Set(orders.flatMap((order) => order.times))].sort((a, b) => toMinutes(a) - toMinutes(b)), [orders]);
  const nowSlot = nearestSlot(slots);

  const firstOpen = useMemo(() => {
    for (const wanted of ["Overdue", "Due"] as SlotState[]) {
      for (const order of orders) {
        const slot = order.times.find((time) => slotState(order, time, todays) === wanted);
        if (slot) return { orderId: order.id, slot };
      }
    }
    return null;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [dose, setDose] = useState<Dose | null>(firstOpen);
  const [message, setMessage] = useState("");

  const counts = useMemo(() => {
    let overdue = 0;
    let due = 0;
    for (const order of orders) {
      for (const slot of order.times) {
        const value = slotState(order, slot, todays);
        if (value === "Overdue") overdue += 1;
        if (value === "Due") due += 1;
      }
    }
    const overrides = administrations.filter((item) => item.outcome === "Given with override").length;
    return { overdue, due, overrides };
  }, [orders, todays, administrations]);

  function choose(next: Dose) {
    setDose(next);
    setMessage("");
  }

  const order = dose ? orders.find((item) => item.id === dose.orderId) : undefined;

  return (
    <div className="emar">
      <PageHeader
        title="eMAR"
        eyebrow="4 West · Medication administration record"
        subtitle="Scan the wristband, then the medication. The five rights are checked before anything can be given."
        actions={(
          <>
            <label className="emar-inpatient">
              <span>Inpatient</span>
              <select aria-label="Inpatient" value={patient.id} onChange={(event) => selectPatient(event.target.value)}>
                {inpatients.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.location}</option>)}
              </select>
            </label>
            <span className="sim-clock"><Icon name="clock" size={15} /> {formatDate(SIMULATION_DATE)} · {SIM_CLOCK}</span>
            <SimulationBadge />
          </>
        )}
      />
      <KpiRow
        items={[
          { label: "Overdue doses", value: counts.overdue, tone: counts.overdue ? "danger" : "good", note: "More than 60 min past the scheduled time" },
          { label: "Due now", value: counts.due, tone: counts.due ? "info" : "neutral", note: "Within ±60 min of the clock" },
          { label: "Overrides in 48 h", value: counts.overrides, tone: counts.overrides ? "warn" : "good", note: "Warnings bypassed with a reason" },
        ]}
      />
      {order && dose && (
        <ScanPanel
          key={`${dose.orderId}@${dose.slot}`}
          order={order}
          slot={dose.slot}
          patient={patient}
          administrations={todays}
          readOnly={readOnly}
          onScan={(result, wristbandId, itemId) => dispatch({
            type: "marScan",
            scan: { id: makeId("SCAN"), orderId: order.id, patientId: patient.id, slot: dose.slot, wristbandId, itemId, scannedAt: nowIso(), warnings: result.warnings, blocking: result.blocking },
          })}
          onRecord={(record, kind) => {
            const administration: MarAdministration = {
              id: makeId("MADM"),
              orderId: order.id,
              patientId: patient.id,
              slot: dose.slot,
              recordedAt: nowIso(),
              simTime: SIM_CLOCK,
              performer: `${role} learner`,
              ...record,
            };
            dispatch(kind === "hold" ? { type: "holdMedication", administration } : { type: "administerMedication", administration });
            const label = `${order.drug} @ ${dose.slot}`;
            setMessage(kind === "hold"
              ? `Dose held: ${label}. The reason is on the MAR and in the audit trail.`
              : record.outcome === "Given with override"
                ? `Dose given with override: ${label}. The warning and your reason are in the audit trail.`
                : `Dose given: ${label}${record.late ? " (flagged late)" : ""}.`);
            setDose(null);
          }}
          onCancel={() => setDose(null)}
        />
      )}
      {message && <p className="form-message success" role="status">{message}</p>}
      <MarGrid orders={orders} slots={slots} nowSlot={nowSlot} administrations={todays} selected={dose} readOnly={readOnly} onChoose={choose} />
      <Legend />
      <AdministrationHistory records={administrations} orders={state.marOrders} />
      <Tip>
        When the same warning is overridden shift after shift, the scanner is usually right and the process around it is broken.
        Before blaming the device or the nurses, check what pharmacy stocked in the drawer and how the product was built (TKT-1041).
      </Tip>
    </div>
  );
}

function nearestSlot(slots: string[]): string | undefined {
  const now = toMinutes(SIM_CLOCK);
  let best: string | undefined;
  for (const slot of slots) {
    if (Math.abs(toMinutes(slot) - now) <= 60 && (!best || Math.abs(toMinutes(slot) - now) < Math.abs(toMinutes(best) - now))) best = slot;
  }
  return best;
}

function formatDate(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${m}/${d}/${y}`;
}

/* ------------------------------------------------------------------ grid */

function MarGrid({ orders, slots, nowSlot, administrations, selected, readOnly, onChoose }: {
  orders: MarOrder[];
  slots: string[];
  nowSlot?: string;
  administrations: MarAdministration[];
  selected: Dose | null;
  readOnly: boolean;
  onChoose: (dose: Dose) => void;
}) {
  return (
    <div className="grid-table-wrap mar-grid-wrap">
      <table className="grid-table mar-grid">
        <caption className="sr-only">Medication administration record by scheduled time</caption>
        <thead>
          <tr>
            <th scope="col">Medication / order</th>
            {slots.map((slot) => (
              <th scope="col" key={slot} className={slot === nowSlot ? "now-col" : ""}>
                {slot}
                {slot === nowSlot && <small className="now-label">now</small>}
              </th>
            ))}
            <th scope="col">PRN</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <tr key={order.id} className={selected?.orderId === order.id ? "highlight" : ""}>
              <th scope="row" className="mar-order">
                <strong>{order.drug}</strong>
                <small>{order.doseLabel} · {order.route} · {order.frequency}</small>
                {order.parameters && <small className="mar-param">{order.parameters}</small>}
                {order.prn && <small className="mar-param">PRN: {order.prn.indication}</small>}
                {order.notes && <small>{order.notes}</small>}
              </th>
              {slots.map((slot) => (
                <td key={slot} className={slot === nowSlot ? "now-col" : ""}>
                  {order.times.includes(slot) && (
                    <SlotCell order={order} slot={slot} administrations={administrations} selected={selected?.orderId === order.id && selected.slot === slot} readOnly={readOnly} onChoose={onChoose} />
                  )}
                </td>
              ))}
              <td>
                {order.prn && <PrnCell order={order} administrations={administrations} readOnly={readOnly} onChoose={onChoose} selected={selected?.orderId === order.id} />}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SlotCell({ order, slot, administrations, selected, readOnly, onChoose }: {
  order: MarOrder;
  slot: string;
  administrations: MarAdministration[];
  selected: boolean;
  readOnly: boolean;
  onChoose: (dose: Dose) => void;
}) {
  const value = slotState(order, slot, administrations);
  const record = administrations.find((item) => item.orderId === order.id && item.slot === slot);
  if (COMPLETED.includes(value)) {
    return (
      <span className={`cell-button ${STATE_CLASS[value]}`} title={record ? `${record.outcome} ${record.simTime} by ${record.performer}${record.reason ? ` · ${record.reason}` : ""}` : value}>
        {value}
        {record && <small className="cell-time">{record.simTime}</small>}
      </span>
    );
  }
  return (
    <button
      type="button"
      className={`cell-button ${STATE_CLASS[value]}${selected ? " cell-selected" : ""}`}
      aria-label={`Scan ${order.drug} at ${slot}`}
      disabled={readOnly}
      onClick={() => onChoose({ orderId: order.id, slot })}
    >
      {value === "Future" ? "Scheduled" : value}
      <Icon name="scan" size={13} />
    </button>
  );
}

function PrnCell({ order, administrations, readOnly, onChoose, selected }: {
  order: MarOrder;
  administrations: MarAdministration[];
  readOnly: boolean;
  onChoose: (dose: Dose) => void;
  selected: boolean;
}) {
  const last = administrations
    .filter((item) => item.orderId === order.id && item.outcome !== "Held")
    .sort((a, b) => toMinutes(b.simTime) - toMinutes(a.simTime))[0];
  return (
    <div className="prn-cell">
      <button
        type="button"
        className={`cell-button cell-prn${selected ? " cell-selected" : ""}`}
        aria-label={`Scan ${order.drug} PRN dose`}
        disabled={readOnly}
        onClick={() => onChoose({ orderId: order.id, slot: "PRN" })}
      >
        PRN <Icon name="scan" size={13} />
      </button>
      {last && <small>Last {last.simTime}{last.painScore !== undefined ? ` · pain ${last.painScore}` : ""}</small>}
    </div>
  );
}

function Legend() {
  const items: [string, string][] = [
    ["cell-given", "Given"], ["cell-late", "Given late"], ["cell-due", "Due (±60 min)"], ["cell-overdue", "Overdue"],
    ["cell-held", "Held"], ["cell-override", "Given with override"], ["cell-future", "Scheduled"], ["cell-prn", "PRN"],
  ];
  return (
    <ul className="mar-legend" aria-label="Legend">
      {items.map(([cls, label]) => <li key={label}><span className={`cell-button ${cls}`}>{label}</span></li>)}
    </ul>
  );
}

/* ------------------------------------------------------------------ scanning */

type RecordInput = Omit<MarAdministration, "id" | "orderId" | "patientId" | "slot" | "recordedAt" | "simTime" | "performer">;

function ScanPanel({ order, slot, patient, administrations, readOnly, onScan, onRecord, onCancel }: {
  order: MarOrder;
  slot: string;
  patient: Patient;
  administrations: MarAdministration[];
  readOnly: boolean;
  onScan: (result: FiveRightsResult, wristbandId: string, itemId: string) => void;
  onRecord: (record: RecordInput, kind: "give" | "hold") => void;
  onCancel: () => void;
}) {
  const items = drawerItems.filter((item) => item.patientId === patient.id);
  const [wristbandChoice, setWristbandChoice] = useState(unitWristbands[0]?.id ?? "");
  const [itemChoice, setItemChoice] = useState(items[0]?.id ?? "");
  const [wristbandId, setWristbandId] = useState<string | null>(null);
  const [result, setResult] = useState<{ check: FiveRightsResult; itemId: string } | null>(null);
  const [holdReason, setHoldReason] = useState<string>(HOLD_REASONS[0]);
  const [overrideReason, setOverrideReason] = useState<string>(OVERRIDE_REASONS[0]);
  const [overrideDetails, setOverrideDetails] = useState("");
  const [painScore, setPainScore] = useState("");
  const [error, setError] = useState("");

  const wristband = unitWristbands.find((item) => item.id === wristbandId);
  const wrongPatient = Boolean(wristband && wristband.mrn !== patient.mrn);
  const needsPain = slot === "PRN" && Boolean(order.prn?.requiresPainScore);

  function scanWristband() {
    setWristbandId(wristbandChoice);
    setResult(null);
    setError("");
  }

  function scanMedication() {
    const band = unitWristbands.find((item) => item.id === wristbandId);
    const item = items.find((row) => row.id === itemChoice);
    if (!band || !item) return;
    const check = fiveRightsCheck({ order, slot, patient, wristband: band, item, administrations });
    setResult({ check, itemId: item.id });
    setError("");
    onScan(check, band.id, item.id);
  }

  function base(): Pick<MarAdministration, "itemId" | "wristbandMrn" | "late"> {
    return { itemId: result?.itemId, wristbandMrn: wristband?.mrn, late: result?.check.late };
  }

  function administer() {
    if (needsPain && painScore === "") { setError("Record a pain score before giving a PRN pain medication."); return; }
    onRecord({ ...base(), outcome: "Given", painScore: painScore === "" ? undefined : Number(painScore) }, "give");
  }

  function administerOverride() {
    if (overrideDetails.trim().length < 15) { setError("Explain the override in at least 15 characters: what you verified and who approved it."); return; }
    if (needsPain && painScore === "") { setError("Record a pain score before giving a PRN pain medication."); return; }
    onRecord({
      ...base(),
      outcome: "Given with override",
      warnings: result?.check.warnings,
      reason: `${overrideReason}: ${overrideDetails.trim()}`,
      painScore: painScore === "" ? undefined : Number(painScore),
    }, "give");
  }

  function hold() {
    onRecord({ ...base(), outcome: "Held", reason: holdReason, warnings: result?.check.warnings }, "hold");
  }

  const blocking = wrongPatient || Boolean(result?.check.blocking);

  return (
    <section className="card scan-panel" aria-label="Barcode scan">
      <header className="scan-head">
        <div>
          <span className="page-eyebrow">Barcode scan</span>
          <h2>{order.drug} · {slot === "PRN" ? "PRN dose" : `scheduled ${slot}`}</h2>
          <p>{order.doseLabel} {order.route} {order.frequency}{order.parameters ? ` · ${order.parameters}` : ""} · ordered by {order.orderedBy}</p>
        </div>
        <button type="button" onClick={onCancel}>Close</button>
      </header>

      {wrongPatient && wristband && (
        <ScanBanner tone="stop" title="WRONG PATIENT · hard stop">
          Wristband is {wristband.label} (MRN {wristband.mrn}); this MAR belongs to {patient.name} (MRN {patient.mrn}). Stop and rescan the correct wristband.
        </ScanBanner>
      )}
      {!wrongPatient && result && <ResultBanner check={result.check} />}

      <div className="scan-steps">
        <div className={`scan-step${wristbandId && !wrongPatient ? " done" : ""}`}>
          <span className="scan-step-number">1</span>
          <label>
            <span>Scan wristband</span>
            <select aria-label="Scan wristband" value={wristbandChoice} onChange={(event) => setWristbandChoice(event.target.value)} disabled={readOnly}>
              {unitWristbands.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
          </label>
          <button type="button" onClick={scanWristband} disabled={readOnly}><Icon name="scan" size={15} /> Scan wristband</button>
          {wristband && !wrongPatient && <small className="scan-ok">✓ {wristband.label} · MRN {wristband.mrn}</small>}
        </div>
        <div className={`scan-step${result && !result.check.blocking ? " done" : ""}`}>
          <span className="scan-step-number">2</span>
          <label>
            <span>Scan medication</span>
            <select aria-label="Scan medication" value={itemChoice} onChange={(event) => setItemChoice(event.target.value)} disabled={readOnly || !wristbandId || wrongPatient}>
              {items.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
          </label>
          <button type="button" onClick={scanMedication} disabled={readOnly || !wristbandId || wrongPatient}><Icon name="scan" size={15} /> Scan medication</button>
        </div>
      </div>

      {result && !wrongPatient && <RightsList check={result.check} />}

      {blocking && <p className="scan-rescan"><strong>Rescan.</strong> Nothing can be given or held until the wristband and the medication match the order.</p>}

      {result && !blocking && (
        <div className="decision-grid">
          {needsPain && (
            <label className="field">
              <span>Pain score (0–10)</span>
              <select aria-label="Pain score (0–10)" value={painScore} onChange={(event) => setPainScore(event.target.value)} disabled={readOnly}>
                <option value="">Choose</option>
                {Array.from({ length: 11 }, (_, index) => <option key={index} value={index}>{index}</option>)}
              </select>
            </label>
          )}
          {!result.check.needsOverride ? (
            <div className="decision-card give">
              <h3>All rights verified</h3>
              <p>Give the dose and document it now.</p>
              <button type="button" className="primary" onClick={administer} disabled={readOnly}>Administer</button>
            </div>
          ) : (
            <div className="decision-card override">
              <h3>Override the warning</h3>
              <p>Only with a specific, defensible reason. The warning and your reason go to the audit trail.</p>
              <label className="field">
                <span>Override reason</span>
                <select aria-label="Override reason" value={overrideReason} onChange={(event) => setOverrideReason(event.target.value)} disabled={readOnly}>
                  {OVERRIDE_REASONS.map((reason) => <option key={reason}>{reason}</option>)}
                </select>
              </label>
              <label className="field">
                <span>Override details</span>
                <textarea aria-label="Override details" rows={2} value={overrideDetails} onChange={(event) => setOverrideDetails(event.target.value)} placeholder="What you verified, and who approved it" disabled={readOnly} />
              </label>
              <button type="button" className="danger-button" onClick={administerOverride} disabled={readOnly}>Administer with override</button>
            </div>
          )}
          <div className="decision-card hold">
            <h3>Hold the dose</h3>
            <p>Document why it was not given; the next nurse and pharmacy will see it.</p>
            <label className="field">
              <span>Hold reason</span>
              <select aria-label="Hold reason" value={holdReason} onChange={(event) => setHoldReason(event.target.value)} disabled={readOnly}>
                {HOLD_REASONS.map((reason) => <option key={reason}>{reason}</option>)}
              </select>
            </label>
            <button type="button" onClick={hold} disabled={readOnly}>Hold dose</button>
          </div>
        </div>
      )}
      {error && <p className="form-message error" role="alert">{error}</p>}
    </section>
  );
}

function ScanBanner({ tone, title, children }: { tone: "ok" | "warning" | "stop"; title: string; children: React.ReactNode }) {
  return (
    <div className={`scan-banner ${tone}`} role={tone === "stop" ? "alert" : "status"}>
      <Icon name={tone === "ok" ? "check" : tone === "stop" ? "scan" : "alert"} size={28} />
      <div>
        <strong>{title}</strong>
        <p>{children}</p>
      </div>
    </div>
  );
}

function ResultBanner({ check }: { check: FiveRightsResult }) {
  if (check.blocking) {
    const stop = check.checks.find((item) => item.severity === "stop");
    return <ScanBanner tone="stop" title="Hard stop · do not administer">{stop?.message}</ScanBanner>;
  }
  if (check.needsOverride) {
    return (
      <ScanBanner tone="warning" title={`${check.warnings.length} warning${check.warnings.length === 1 ? "" : "s"} · hold, or override with a reason`}>
        {check.warnings.join(" ")}
      </ScanBanner>
    );
  }
  return <ScanBanner tone="ok" title="All five rights verified">Right patient, medication, dose, route, and time. No allergy conflict.</ScanBanner>;
}

function RightsList({ check }: { check: FiveRightsResult }) {
  return (
    <ul className="rights-list" aria-label="Five rights check">
      {check.checks.map((item) => (
        <li key={item.right} className={item.severity}>
          <b>{item.ok ? "✓" : item.severity === "stop" ? "✕" : "!"} {item.right}</b>
          <span>{item.message}</span>
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------------ history */

function outcomeTone(outcome: MarAdministration["outcome"]): Tone {
  if (outcome === "Given") return "good";
  if (outcome === "Held") return "warn";
  return "danger";
}

function AdministrationHistory({ records, orders }: { records: MarAdministration[]; orders: MarOrder[] }) {
  const sorted = [...records].sort((a, b) => `${b.date ?? SIMULATION_DATE} ${b.simTime}`.localeCompare(`${a.date ?? SIMULATION_DATE} ${a.simTime}`));
  const overrides = records.filter((item) => item.outcome === "Given with override");
  return (
    <section className="panel mar-history">
      <div className="panel-head">
        <div>
          <h2>Administration history</h2>
          <p>Last 48 hours, newest first. Overrides show the warning that was bypassed and the reason given.</p>
        </div>
      </div>
      {overrides.length >= 2 && (
        <div className="mar-history-alert">
          <InlineAlert tone="warn" title={`${overrides.length} overrides of scanner warnings in 48 hours`}>
            <p>Repeated overrides of the same warning are a signal to investigate the process, not a routine workaround.</p>
          </InlineAlert>
        </div>
      )}
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Time</th>
            <th>Medication</th>
            <th>Outcome</th>
            <th>Performed by</th>
            <th>Reason and warnings</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((record) => {
            const order = orders.find((item) => item.id === record.orderId);
            return (
              <tr key={record.id} className={record.outcome === "Given with override" ? "override-row" : ""}>
                <td>{formatDate(record.date ?? SIMULATION_DATE)}</td>
                <td>{record.simTime}<small>{record.slot === "PRN" ? "PRN" : `sched. ${record.slot}`}</small></td>
                <td>{order?.drug ?? record.orderId}{record.painScore !== undefined && <small>Pain score {record.painScore}/10</small>}</td>
                <td>
                  <Status tone={outcomeTone(record.outcome)}>{record.outcome}</Status>
                  {record.late && <small className="danger-text">Late</small>}
                </td>
                <td>{record.performer}</td>
                <td>
                  {record.reason ?? "—"}
                  {record.warnings?.map((warning) => <small key={warning} className="danger-text">{warning}</small>)}
                </td>
              </tr>
            );
          })}
          {!sorted.length && <tr><td colSpan={6} className="empty">No administrations recorded.</td></tr>}
        </tbody>
      </table>
    </section>
  );
}
