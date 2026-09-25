"use client";

import { KpiRow, PageHeader, Panel, SimulationBadge, Status } from "@/components/ui/primitives";
import { NavLink } from "@/components/ui/NavLink";
import type { CourseData } from "@/hooks/useCourseData";
import { slotState } from "@/lib/clinical/mar";
import { computeProgress, toProgressEvent } from "@/lib/progress";
import { isAbnormal, resultValue } from "@/lib/patient";
import { SIMULATION_DATE } from "@/lib/seed";
import type { EHRState, Patient } from "@/lib/types";
import type { ViewProps } from "./shared";

/** Role-aware home: what needs attention today across the simulated organization. */
export function Worklist(props: ViewProps & { courseData?: CourseData | null }) {
  const { state, role, navigate } = props;
  return (
    <div className="worklist-view">
      <PageHeader
        eyebrow="Monday, September 21, 2026 · simulated date"
        title="Worklist"
        subtitle={`Working as ${role}. Fordham Health Lincoln Center Clinic and 4 West Medical-Surgical.`}
        actions={<SimulationBadge />}
      />
      <WelcomeCard {...props} />
      <KpiRow items={kpis(state)} />
      <div className="grid two-one">
        <div className="stack">
          <TodaySchedule state={state} navigate={navigate} />
          <ResultsNeedingAction state={state} navigate={navigate} />
        </div>
        <div className="stack">
          <TaskList {...props} />
          <PortalInbox state={state} navigate={navigate} />
          <PatientContext patient={props.patient} />
        </div>
      </div>
    </div>
  );
}

function kpis(state: EHRState) {
  const overdue = state.marOrders.reduce((sum, order) => sum + order.times.filter((slot) => slotState(order, slot, state.marAdministrations) === "Overdue").length, 0);
  const openTickets = state.tickets.filter((ticket) => ticket.status !== "Resolved").length;
  const inBasket = state.inBasket.filter((item) => item.status === "Open").length;
  const critical = state.inBasket.filter((item) => item.status === "Open" && item.priority === "Critical").length;
  const claims = state.claims.filter((claim) => claim.status === "Charge review" || claim.status === "Denied").length;
  return [
    { label: "Open analyst tickets", value: openTickets, note: "Service desk queue", tone: openTickets ? ("warn" as const) : ("good" as const) },
    { label: "Open In Basket items", value: inBasket, note: critical ? `${critical} critical result unacknowledged` : "No critical results", tone: critical ? ("danger" as const) : ("neutral" as const) },
    { label: "Overdue doses on 4 West", value: overdue, note: "eMAR, simulated clock 10:15", tone: overdue ? ("danger" as const) : ("good" as const) },
    { label: "Claims needing work", value: claims, note: "Charge review and denials", tone: claims ? ("warn" as const) : ("good" as const) },
  ];
}

function WelcomeCard({ state, courseData, navigate }: ViewProps & { courseData?: CourseData | null }) {
  const events = state.audit.map(toProgressEvent);
  const next = (courseData?.assignments ?? []).find((assignment) => {
    const submitted = courseData?.submissions.some((row) => row.assignment_id === assignment.id);
    return !submitted && assignment.releaseState === "released";
  });
  const progress = next ? computeProgress(next, events) : null;
  return (
    <section className="welcome-card" aria-label="Your role">
      <div>
        <h2>You are the clinical informatics analyst at Fordham Health.</h2>
        <p>
          Dana Okafor, the clinical informatics manager, routes EHR problems to you from nurses, physicians, the front desk, HIM, and billing.
          {next && progress ? ` Next up: ${next.id.replace("FORDMS-", "")} ${next.shortTitle} (${progress.percent}% done, due ${next.dueLabel}).` : " Open Assignments for step-by-step guides."}
        </p>
      </div>
      <NavLink target={{ view: "Assignments" }} navigate={navigate} className="cta" icon="book">Open assignment guide</NavLink>
    </section>
  );
}

function TodaySchedule({ state, navigate }: Pick<ViewProps, "state" | "navigate">) {
  const todays = state.appointments
    .filter((appointment) => appointment.date === SIMULATION_DATE && appointment.status !== "Canceled")
    .sort((a, b) => a.time.localeCompare(b.time));
  return (
    <Panel title="Today's clinic schedule" subtitle="Fordham Health Lincoln Center Clinic">
      <table>
        <thead><tr><th>Time</th><th>Patient</th><th>Visit</th><th>Provider</th><th>Status</th></tr></thead>
        <tbody>
          {todays.map((appointment) => {
            const patient = state.patients.find((item) => item.id === appointment.patientId);
            if (!patient) return null;
            const tone = appointment.status === "Checked in" ? "good" : appointment.status === "No-show" ? "danger" : "neutral";
            return (
              <tr key={appointment.id}>
                <td>{appointment.time}</td>
                <td>
                  <NavLink target={{ view: "Patients", patient: patient.id }} navigate={navigate} className="text-link" icon={null}>{patient.name}</NavLink>
                  <small>{patient.mrn}</small>
                </td>
                <td>{appointment.visitType}</td>
                <td>{appointment.provider}</td>
                <td><Status tone={tone}>{appointment.status}</Status></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Panel>
  );
}

function ResultsNeedingAction({ state, navigate }: Pick<ViewProps, "state" | "navigate">) {
  const openResults = state.inBasket.filter((item) => item.kind === "Result" && item.status === "Open");
  const finalOrders = state.orders.filter((order) => order.status === "Final");
  const flagged = state.patients
    .flatMap((patient) => patient.results.filter((result) => isAbnormal(result) || result.status === "Pending").map((result, index) => ({ patient, result, key: `${patient.id}-${result.name}-${result.date}-${index}` })))
    .sort((a, b) => b.result.date.localeCompare(a.result.date))
    .slice(0, 6);
  return (
    <Panel title="Results requiring action" subtitle="Acknowledgment and follow-up are tracked separately">
      <table>
        <thead><tr><th>Patient</th><th>Result</th><th>Value</th><th>State</th></tr></thead>
        <tbody>
          {openResults.map((item) => {
            const patient = state.patients.find((row) => row.id === item.patientId);
            return (
              <tr key={item.id} className={item.priority === "Critical" ? "row-critical" : ""}>
                <td>{patient?.name}</td>
                <td>{item.result?.name ?? item.subject}<small>{item.recipient}</small></td>
                <td className="danger-text">{item.result ? `${item.result.value} ${item.result.unit}` : "—"}</td>
                <td>
                  <Status tone={item.priority === "Critical" ? "danger" : "warn"}>{item.priority === "Critical" ? "Critical · unacknowledged" : "In Basket · open"}</Status>
                  <NavLink target={{ view: "In Basket" }} navigate={navigate} className="text-link small-link" icon={null}>Open In Basket</NavLink>
                </td>
              </tr>
            );
          })}
          {finalOrders.map((order) => {
            const patient = state.patients.find((row) => row.id === order.patientId);
            return (
              <tr key={order.id}>
                <td>{patient?.name}</td>
                <td>{order.name}</td>
                <td className="danger-text">{order.result}</td>
                <td><Status tone={order.acknowledgedAt ? "warn" : "danger"}>{order.acknowledgedAt ? "Acknowledged · follow-up open" : "Final · not acknowledged"}</Status></td>
              </tr>
            );
          })}
          {flagged.map(({ patient, result, key }) => (
            <tr key={key}>
              <td>{patient.name}</td>
              <td>{result.name}<small>{result.date}</small></td>
              <td className={isAbnormal(result) ? "danger-text" : ""}>{resultValue(result)}</td>
              <td><Status tone="neutral">{result.status === "Pending" ? "Ordered · no result" : `${result.flag} · in chart`}</Status></td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );
}

function TaskList({ state, dispatch, readOnly }: ViewProps) {
  const open = state.tasks.filter((task) => !task.complete).length;
  return (
    <Panel title="Team tasks" subtitle={`${open} open · close the loop after reviewing a result`}>
      <ul className="task-list">
        {state.tasks.map((task) => {
          const patient = state.patients.find((row) => row.id === task.patientId);
          return (
            <li key={task.id}>
              <label>
                <input type="checkbox" checked={task.complete} disabled={readOnly} onChange={() => dispatch({ type: "toggleTask", id: task.id })} />
                <span className={task.complete ? "done" : ""}>
                  {task.title}
                  <small>{patient?.name ?? task.patientId} · due {task.due}{task.owner ? ` · ${task.owner}` : ""}</small>
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

function PortalInbox({ state, navigate }: Pick<ViewProps, "state" | "navigate">) {
  const newMessages = state.messages.filter((message) => message.status === "New");
  return (
    <Panel title="Portal messages" subtitle={`${newMessages.length} new message(s) without an owner`}>
      <ul className="task-list">
        {newMessages.map((message) => {
          const patient = state.patients.find((row) => row.id === message.patientId);
          return (
            <li key={message.id}>
              <NavLink target={{ view: "Portal", patient: message.patientId }} navigate={navigate} className="text-link" icon={null}>{message.subject}</NavLink>
              <small>{patient?.name}{message.proxy ? " · proxy" : ""} · {message.date}</small>
            </li>
          );
        })}
        {!newMessages.length && <li className="empty">No new messages.</li>}
      </ul>
    </Panel>
  );
}

function PatientContext({ patient }: { patient: Patient }) {
  return (
    <Panel title="Selected patient" subtitle={`${patient.name} · MRN ${patient.mrn}`}>
      <dl className="facts">
        <div><dt>Active problems</dt><dd>{patient.problems.filter((item) => item.status !== "Resolved").map((item) => item.display).join("; ") || "None recorded"}</dd></div>
        <div><dt>Active medications</dt><dd>{patient.medications.map((item) => item.name).join("; ") || "None recorded"}</dd></div>
        <div><dt>Latest BP</dt><dd>{patient.vitals[0]?.bp ?? "Not recorded"}</dd></div>
      </dl>
    </Panel>
  );
}
