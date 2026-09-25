"use client";

import { useState, type FormEvent } from "react";
import { Field, InlineAlert, KpiRow, PageHeader, Panel, SimulationBadge, Status, Tip } from "@/components/ui/primitives";
import { SIMULATION_DATE } from "@/lib/seed";
import type { Appointment } from "@/lib/types";
import { nowIso, type ViewProps } from "./shared";

type Message = { text: string; tone: "error" | "success" | "info" };
interface FormState { patientId: string; date: string; time: string; providerId: string; visitTypeId: string }

function statusTone(status: Appointment["status"]) {
  if (status === "Canceled" || status === "No-show") return "danger" as const;
  if (status === "Checked in") return "good" as const;
  if (status === "Completed") return "info" as const;
  return "neutral" as const;
}

export function Schedule(props: ViewProps) {
  const { state, dispatch, config, selectPatient, makeId, readOnly } = props;
  const providers = config.providers;
  const visitTypes = config.visitTypes;
  const [form, setForm] = useState<FormState>({ patientId: "PT-001", date: "2026-09-28", time: "09:00", providerId: providers[0]?.id ?? "", visitTypeId: visitTypes[0]?.id ?? "" });
  const [message, setMessage] = useState<Message>({ text: "", tone: "info" });
  const [rescheduleId, setRescheduleId] = useState<string | null>(null);
  const [cancelId, setCancelId] = useState<string | null>(null);

  const provider = providers.find((item) => item.id === form.providerId) ?? providers[0];
  const visitType = visitTypes.find((item) => item.id === form.visitTypeId) ?? visitTypes[0];

  function availabilityProblem(): string | null {
    if (!provider) return "Choose a provider.";
    const day = new Date(`${form.date}T12:00:00`).getDay();
    const slot = provider.availability.find((item) => item.day === day);
    if (!slot) return `${provider.name} does not have clinic hours on that day.`;
    if (form.time < slot.start || form.time >= slot.end) return `${provider.name} sees patients from ${slot.start} to ${slot.end} on that day.`;
    return null;
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!provider || !visitType) return;
    const keys = config.appointmentRules.conflictKeys;
    const conflict = state.appointments.find((a) =>
      a.id !== rescheduleId
      && a.status !== "Canceled"
      && a.status !== "No-show"
      && (!keys.includes("date") || a.date === form.date)
      && (!keys.includes("time") || a.time === form.time)
      && (!keys.includes("provider") || a.provider === provider.name));
    if (conflict) {
      setMessage({ text: `Conflict: ${provider.name} already has ${conflict.visitType} at ${form.time} on ${form.date}. Choose another time or provider.`, tone: "error" });
      return;
    }
    const availability = availabilityProblem();
    if (availability) {
      setMessage({ text: `Availability: ${availability}`, tone: "error" });
      return;
    }
    const dailyLoad = state.appointments.filter((a) => a.provider === provider.name && a.date === form.date && a.status !== "Canceled").length;
    if (dailyLoad >= config.appointmentRules.maxDailyPerProvider) {
      setMessage({ text: `${provider.name} has reached the daily template limit of ${config.appointmentRules.maxDailyPerProvider} visits.`, tone: "error" });
      return;
    }
    const changes = {
      patientId: form.patientId,
      date: form.date,
      time: form.time,
      provider: provider.name,
      providerId: provider.id,
      visitType: visitType.label,
      visitTypeId: visitType.id,
      duration: visitType.durationMinutes,
    };
    if (rescheduleId) {
      dispatch({ type: "rescheduleAppointment", id: rescheduleId, changes });
      setMessage({ text: "Appointment rescheduled. The original identifier and its change history are preserved.", tone: "success" });
      setRescheduleId(null);
    } else {
      const appointment: Appointment = { id: makeId("APT"), ...changes, status: "Scheduled" };
      dispatch({ type: "createAppointment", appointment });
      setMessage({ text: "Appointment created. The schedule and patient record now show the new visit.", tone: "success" });
    }
    selectPatient(form.patientId);
  }

  function beginReschedule(appointment: Appointment) {
    setForm({
      patientId: appointment.patientId,
      date: appointment.date,
      time: appointment.time,
      providerId: appointment.providerId ?? providers.find((p) => p.name === appointment.provider)?.id ?? providers[0].id,
      visitTypeId: appointment.visitTypeId ?? visitTypes.find((v) => v.label === appointment.visitType)?.id ?? visitTypes[0].id,
    });
    setRescheduleId(appointment.id);
    setMessage({ text: "Choose a new date, time, provider, or visit type, then save the reschedule.", tone: "info" });
    selectPatient(appointment.patientId);
  }

  const todays = state.appointments.filter((a) => a.date === SIMULATION_DATE);
  const kpis = [
    { label: "Visits today", value: todays.filter((a) => a.status !== "Canceled").length, note: "Simulated date 2026-09-21" },
    { label: "Checked in", value: todays.filter((a) => a.status === "Checked in").length, tone: "good" as const },
    { label: "No-shows (all dates)", value: state.appointments.filter((a) => a.status === "No-show").length, tone: "danger" as const },
    { label: "On wait-list", value: state.waitlist.filter((w) => w.status === "Waiting").length, tone: "warn" as const },
  ];

  return (
    <div className="schedule-view">
      <PageHeader
        eyebrow="Front office"
        title="Schedule"
        subtitle={`Conflicts are checked by ${config.appointmentRules.conflictKeys.join(", ")}; provider hours and daily template limits also apply.`}
        actions={<SimulationBadge />}
      />
      <KpiRow items={kpis} />
      <div className="grid two-one">
        <div className="stack">
          <AppointmentTable
            {...props}
            onReschedule={beginReschedule}
            cancelId={cancelId}
            setCancelId={setCancelId}
          />
          {config.appointmentRules.waitlistEnabled && <WaitlistPanel {...props} />}
        </div>
        <Panel
          title={rescheduleId ? `Reschedule ${rescheduleId}` : "Create appointment"}
          subtitle="Provider hours, visit durations, and conflict rules come from the course configuration"
        >
          <form className="form-stack panel-pad" onSubmit={submit}>
            <Field label="Patient">
              <select value={form.patientId} onChange={(e) => setForm({ ...form, patientId: e.target.value })} disabled={readOnly}>
                {state.patients.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.mrn}</option>)}
              </select>
            </Field>
            <div className="registration-grid">
              <Field label="Date">
                <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} disabled={readOnly} />
              </Field>
              <Field label="Time">
                <input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} disabled={readOnly} />
              </Field>
            </div>
            <Field
              label="Provider"
              hint={provider ? `${provider.credentials} · ${config.specialties.find((s) => s.id === provider.specialtyId)?.name ?? ""} · hours ${provider.availability[0]?.start ?? ""}–${provider.availability[0]?.end ?? ""}` : undefined}
            >
              <select value={form.providerId} onChange={(e) => setForm({ ...form, providerId: e.target.value })} disabled={readOnly}>
                {providers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </Field>
            <Field label="Visit type" hint={visitType ? `${visitType.durationMinutes} minutes · ${visitType.resources.join(", ")}` : undefined}>
              <select value={form.visitTypeId} onChange={(e) => setForm({ ...form, visitTypeId: e.target.value })} disabled={readOnly}>
                {visitTypes.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
              </select>
            </Field>
            <button className="primary" type="submit" disabled={readOnly}>{rescheduleId ? "Save reschedule" : "Create appointment"}</button>
            {rescheduleId && (
              <button
                type="button"
                onClick={() => { setRescheduleId(null); setMessage({ text: "Reschedule canceled. No appointment data changed.", tone: "info" }); }}
              >
                Cancel reschedule
              </button>
            )}
            {message.text && <p className={`form-message ${message.tone === "error" ? "error" : "success"}`} role="status">{message.text}</p>}
          </form>
          <InlineAlert tone="info" title="Access measure">
            <p>The third next available appointment is a steadier access signal than the first opening, which often reflects a cancellation.</p>
          </InlineAlert>
          <Tip>Reschedule instead of cancel-and-rebook: one appointment ID with a change history keeps no-show and access measures honest.</Tip>
        </Panel>
      </div>
    </div>
  );
}

function AppointmentTable({ state, dispatch, config, readOnly, onReschedule, cancelId, setCancelId }: ViewProps & {
  onReschedule: (appointment: Appointment) => void;
  cancelId: string | null;
  setCancelId: (id: string | null) => void;
}) {
  const [cancelReason, setCancelReason] = useState(config.appointmentRules.cancellationReasons[0] ?? "Patient request");
  const sorted = [...state.appointments].sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
  const reminderDue = (a: Appointment) => !a.reminderSentAt && a.status === "Scheduled" && a.date >= SIMULATION_DATE;

  return (
    <Panel title="Appointments" subtitle={`${sorted.length} appointments in this workspace`}>
      <table className="schedule-table">
        <thead>
          <tr><th>Date</th><th>Time</th><th>Patient</th><th>Provider</th><th>Visit</th><th>Actions</th></tr>
        </thead>
        <tbody>
          {sorted.map((a) => {
            const patient = state.patients.find((p) => p.id === a.patientId);
            return (
              <tr key={a.id} className={a.date === SIMULATION_DATE ? "today-row" : ""}>
                <td>{a.date}</td>
                <td><strong>{a.time}</strong></td>
                <td>
                  {patient?.name}
                  {patient && patient.pronouns === "they/them" && <small>{patient.pronouns}</small>}
                </td>
                <td>{a.provider}</td>
                <td>
                  {a.visitType}
                  <small>
                    {a.duration} min · <Status tone={statusTone(a.status)}>{a.status}</Status>
                    {a.reminderSentAt && " · reminder sent"}
                  </small>
                  {a.history && a.history.length > 1 && <small className="appointment-history">{a.history.length - 1} change(s) recorded</small>}
                </td>
                <td>
                  <div className="button-row">
                  {a.status === "Scheduled" && (
                    <>
                      <button disabled={readOnly} onClick={() => onReschedule(a)}>Reschedule</button>
                      <button disabled={readOnly} onClick={() => dispatch({ type: "updateAppointmentStatus", id: a.id, status: "Checked in" })}>Check in</button>
                      {reminderDue(a) && <button disabled={readOnly} onClick={() => dispatch({ type: "sendReminder", id: a.id })}>Send reminder</button>}
                      <button
                        disabled={readOnly}
                        onClick={() => dispatch({ type: "updateAppointmentStatus", id: a.id, status: "No-show", reason: `No arrival within ${config.appointmentRules.noShowAfterMinutes} minutes` })}
                      >
                        No-show
                      </button>
                      <button disabled={readOnly} onClick={() => setCancelId(a.id)}>Cancel</button>
                    </>
                  )}
                  {a.status === "Checked in" && (
                    <button disabled={readOnly} onClick={() => dispatch({ type: "updateAppointmentStatus", id: a.id, status: "Completed" })}>Complete</button>
                  )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {cancelId && (
        <div className="decision-box">
          <Field label={`Cancellation reason for ${cancelId}`}>
            <select value={cancelReason} onChange={(e) => setCancelReason(e.target.value)}>
              {config.appointmentRules.cancellationReasons.map((reason) => <option key={reason}>{reason}</option>)}
            </select>
          </Field>
          <div className="button-row">
            <button
              className="danger-button"
              onClick={() => { dispatch({ type: "updateAppointmentStatus", id: cancelId, status: "Canceled", reason: cancelReason }); setCancelId(null); }}
            >
              Confirm cancellation
            </button>
            <button onClick={() => setCancelId(null)}>Keep appointment</button>
          </div>
        </div>
      )}
    </Panel>
  );
}

function WaitlistPanel({ state, dispatch, config, makeId, readOnly }: ViewProps) {
  const visitTypes = config.visitTypes;
  const [waitlistForm, setWaitlistForm] = useState({ patientId: "PT-006", visitTypeId: visitTypes[0]?.id ?? "", window: "Weekday evenings after 5 p.m." });

  function add() {
    dispatch({
      type: "addWaitlist",
      entry: {
        id: makeId("WL"),
        patientId: waitlistForm.patientId,
        visitType: visitTypes.find((v) => v.id === waitlistForm.visitTypeId)?.label ?? "",
        preferredWindow: waitlistForm.window,
        createdAt: nowIso(),
        status: "Waiting",
      },
    });
  }

  return (
    <Panel title="Wait-list" subtitle="Offer earlier openings when a slot frees up">
      <div className="form-stack panel-pad">
        <div className="registration-grid">
          <Field label="Wait-list patient">
            <select value={waitlistForm.patientId} onChange={(e) => setWaitlistForm({ ...waitlistForm, patientId: e.target.value })}>
              {state.patients.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.mrn}</option>)}
            </select>
          </Field>
          <Field label="Wait-list visit type">
            <select value={waitlistForm.visitTypeId} onChange={(e) => setWaitlistForm({ ...waitlistForm, visitTypeId: e.target.value })}>
              {visitTypes.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
            </select>
          </Field>
          <Field label="Preferred window">
            <input value={waitlistForm.window} onChange={(e) => setWaitlistForm({ ...waitlistForm, window: e.target.value })} />
          </Field>
        </div>
        <div><button disabled={readOnly} onClick={add}>Add to wait-list</button></div>
      </div>
      <ul className="waitlist-list panel-pad">
        {state.waitlist.map((entry) => (
          <li key={entry.id}>
            <span>{state.patients.find((p) => p.id === entry.patientId)?.name} · {entry.visitType} · {entry.preferredWindow}</span>
            <Status tone={entry.status === "Waiting" ? "warn" : "good"}>{entry.status}</Status>
          </li>
        ))}
        {!state.waitlist.length && <li className="empty">No one is waiting.</li>}
      </ul>
    </Panel>
  );
}
