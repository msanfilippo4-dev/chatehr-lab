"use client";

import { useState, type FormEvent } from "react";
import { Field, InlineAlert, Panel, SimulationBadge, Status } from "@/components/ui/primitives";
import type { Appointment } from "@/lib/types";
import { nowIso, type ViewProps } from "./shared";

export function Schedule({ state, dispatch, config, selectPatient, makeId }: ViewProps) {
  const providers = config.providers;
  const visitTypes = config.visitTypes;
  const [form, setForm] = useState({ patientId: "PT-001", date: "2026-09-28", time: "09:00", providerId: providers[0]?.id ?? "", visitTypeId: visitTypes[0]?.id ?? "" });
  const [message, setMessage] = useState<{ text: string; tone: "error" | "success" | "info" }>({ text: "", tone: "info" });
  const [rescheduleId, setRescheduleId] = useState<string | null>(null);
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState(config.appointmentRules.cancellationReasons[0] ?? "Patient request");
  const [waitlistForm, setWaitlistForm] = useState({ patientId: "PT-006", visitTypeId: visitTypes[0]?.id ?? "", window: "Weekday evenings after 5 p.m." });

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

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!provider || !visitType) return;
    const keys = config.appointmentRules.conflictKeys;
    const conflict = state.appointments.find((a) => a.id !== rescheduleId && a.status !== "Canceled" && a.status !== "No-show" && (!keys.includes("date") || a.date === form.date) && (!keys.includes("time") || a.time === form.time) && (!keys.includes("provider") || a.provider === provider.name));
    if (conflict) { setMessage({ text: `Conflict: ${provider.name} already has ${conflict.visitType} at ${form.time} on ${form.date}. Choose another time or provider.`, tone: "error" }); return; }
    const availability = availabilityProblem();
    if (availability) { setMessage({ text: `Availability: ${availability}`, tone: "error" }); return; }
    const dailyLoad = state.appointments.filter((a) => a.provider === provider.name && a.date === form.date && a.status !== "Canceled").length;
    if (dailyLoad >= config.appointmentRules.maxDailyPerProvider) { setMessage({ text: `${provider.name} has reached the daily template limit of ${config.appointmentRules.maxDailyPerProvider} visits.`, tone: "error" }); return; }
    const changes = { patientId: form.patientId, date: form.date, time: form.time, provider: provider.name, providerId: provider.id, visitType: visitType.label, visitTypeId: visitType.id, duration: visitType.durationMinutes };
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
    setForm({ patientId: appointment.patientId, date: appointment.date, time: appointment.time, providerId: appointment.providerId ?? providers.find((p) => p.name === appointment.provider)?.id ?? providers[0].id, visitTypeId: appointment.visitTypeId ?? visitTypes.find((v) => v.label === appointment.visitType)?.id ?? visitTypes[0].id });
    setRescheduleId(appointment.id);
    setMessage({ text: "Choose a new date, time, provider, or visit type, then save the reschedule.", tone: "info" });
    selectPatient(appointment.patientId);
  }

  const sorted = [...state.appointments].sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
  const reminderDue = (a: Appointment) => !a.reminderSentAt && a.status === "Scheduled" && a.date >= "2026-09-21";

  return <div className="grid two-one">
    <div className="stack">
      <Panel title="Schedule" subtitle={`Conflicts are checked by ${config.appointmentRules.conflictKeys.join(", ")}; provider hours and daily template limits also apply`}>
        <table><thead><tr><th>Date</th><th>Time</th><th>Patient</th><th>Provider</th><th>Visit</th><th>Actions</th></tr></thead><tbody>{sorted.map((a) => <tr key={a.id}><td>{a.date}</td><td>{a.time}</td><td>{state.patients.find((p) => p.id === a.patientId)?.name}</td><td>{a.provider}</td><td>{a.visitType}<small>{a.duration} min · <Status tone={a.status === "Canceled" || a.status === "No-show" ? "danger" : a.status === "Checked in" ? "good" : "neutral"}>{a.status}</Status>{a.reminderSentAt && " · reminder sent"}</small>{a.history && a.history.length > 1 && <small className="appointment-history">{a.history.length - 1} change(s) recorded</small>}</td><td className="button-row">
          {a.status === "Scheduled" && <><button onClick={() => beginReschedule(a)}>Reschedule</button><button onClick={() => dispatch({ type: "updateAppointmentStatus", id: a.id, status: "Checked in" })}>Check in</button>{reminderDue(a) && <button onClick={() => dispatch({ type: "sendReminder", id: a.id })}>Send reminder</button>}<button onClick={() => dispatch({ type: "updateAppointmentStatus", id: a.id, status: "No-show", reason: `No arrival within ${config.appointmentRules.noShowAfterMinutes} minutes` })}>No-show</button><button onClick={() => setCancelId(a.id)}>Cancel</button></>}
          {a.status === "Checked in" && <button onClick={() => dispatch({ type: "updateAppointmentStatus", id: a.id, status: "Completed" })}>Complete</button>}
        </td></tr>)}</tbody></table>
        {cancelId && <div className="decision-box"><Field label={`Cancellation reason for ${cancelId}`}><select value={cancelReason} onChange={(e) => setCancelReason(e.target.value)}>{config.appointmentRules.cancellationReasons.map((reason) => <option key={reason}>{reason}</option>)}</select></Field><div className="button-row"><button className="danger-button" onClick={() => { dispatch({ type: "updateAppointmentStatus", id: cancelId, status: "Canceled", reason: cancelReason }); setCancelId(null); }}>Confirm cancellation</button><button onClick={() => setCancelId(null)}>Keep appointment</button></div></div>}
      </Panel>
      {config.appointmentRules.waitlistEnabled && <Panel title="Wait-list" subtitle="Offer earlier openings when a slot frees up">
        <div className="form-stack">
          <div className="registration-grid">
            <Field label="Patient"><select value={waitlistForm.patientId} onChange={(e) => setWaitlistForm({ ...waitlistForm, patientId: e.target.value })}>{state.patients.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.mrn}</option>)}</select></Field>
            <Field label="Visit type"><select value={waitlistForm.visitTypeId} onChange={(e) => setWaitlistForm({ ...waitlistForm, visitTypeId: e.target.value })}>{visitTypes.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}</select></Field>
            <Field label="Preferred window"><input value={waitlistForm.window} onChange={(e) => setWaitlistForm({ ...waitlistForm, window: e.target.value })} /></Field>
          </div>
          <button onClick={() => dispatch({ type: "addWaitlist", entry: { id: makeId("WL"), patientId: waitlistForm.patientId, visitType: visitTypes.find((v) => v.id === waitlistForm.visitTypeId)?.label ?? "", preferredWindow: waitlistForm.window, createdAt: nowIso(), status: "Waiting" } })}>Add to wait-list</button>
        </div>
        <ul className="waitlist-list">{state.waitlist.map((entry) => <li key={entry.id}><span>{state.patients.find((p) => p.id === entry.patientId)?.name} · {entry.visitType} · {entry.preferredWindow}</span><Status tone={entry.status === "Waiting" ? "warn" : "good"}>{entry.status}</Status></li>)}{!state.waitlist.length && <li className="empty">No one is waiting.</li>}</ul>
      </Panel>}
    </div>
    <Panel title={rescheduleId ? `Reschedule ${rescheduleId}` : "Create appointment"} subtitle="Provider hours, visit durations, and conflict rules come from the course configuration" actions={<SimulationBadge />}>
      <form className="form-stack" onSubmit={submit}>
        <Field label="Patient"><select value={form.patientId} onChange={(e) => setForm({ ...form, patientId: e.target.value })}>{state.patients.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.mrn}</option>)}</select></Field>
        <Field label="Date"><input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
        <Field label="Time"><input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} /></Field>
        <Field label="Provider" hint={provider ? `${provider.credentials} · ${config.specialties.find((s) => s.id === provider.specialtyId)?.name ?? ""} · hours ${provider.availability[0]?.start ?? ""}–${provider.availability[0]?.end ?? ""}` : undefined}><select value={form.providerId} onChange={(e) => setForm({ ...form, providerId: e.target.value })}>{providers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
        <Field label="Visit type" hint={visitType ? `${visitType.durationMinutes} minutes · ${visitType.resources.join(", ")}` : undefined}><select value={form.visitTypeId} onChange={(e) => setForm({ ...form, visitTypeId: e.target.value })}>{visitTypes.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}</select></Field>
        <button className="primary" type="submit">{rescheduleId ? "Save reschedule" : "Create appointment"}</button>
        {rescheduleId && <button type="button" onClick={() => { setRescheduleId(null); setMessage({ text: "Reschedule canceled. No appointment data changed.", tone: "info" }); }}>Cancel reschedule</button>}
        {message.text && <p className={`form-message ${message.tone === "error" ? "error" : "success"}`} role="status">{message.text}</p>}
      </form>
      <InlineAlert tone="info" title="Access measure"><p>The third next available appointment is a steadier access signal than the first opening, which often reflects a cancellation.</p></InlineAlert>
    </Panel>
  </div>;
}
