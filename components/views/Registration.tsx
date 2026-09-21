"use client";

import { useMemo, useState, type FormEvent } from "react";
import { Field, InlineAlert, Panel, SimulationBadge, Status } from "@/components/ui/primitives";
import type { EligibilityCheck, Patient, Referral } from "@/lib/types";
import { nowIso, type ViewProps } from "./shared";

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function Registration({ state, dispatch, config, patient, selectPatient, makeId }: ViewProps) {
  const [form, setForm] = useState({ name: "", dob: "", sex: "Female", pronouns: "she/her", language: "English", phone: "", address: "", insurerId: config.insurers[0]?.id ?? "", memberId: "" });
  const [message, setMessage] = useState("");
  const [eligibility, setEligibility] = useState({ planType: "", status: "Active", copay: "$30", deductibleMet: "$250 of $1,500", cobOrder: "Primary", source: config.coverageFields.verificationSources[0] ?? "" });
  const [referral, setReferral] = useState({ specialtyId: config.specialties[0]?.id ?? "", reason: "", priority: "Routine" as Referral["priority"], authorization: "Pending" as Referral["authorizationStatus"] });

  const candidates = useMemo(() => {
    if (!form.name.trim() && !form.dob) return [];
    const lastName = normalize(form.name.trim().split(/\s+/).at(-1) ?? "");
    return state.patients.filter((p) => {
      const sameDob = form.dob && p.dob === form.dob;
      const samePhone = form.phone && normalize(p.phone) === normalize(form.phone);
      const sameLast = lastName && normalize(p.name.split(/\s+/).at(-1) ?? "") === lastName;
      return (sameDob && sameLast) || samePhone || (sameDob && form.name.trim().length > 3 && normalize(p.name).startsWith(normalize(form.name.trim().slice(0, 4))));
    });
  }, [form.name, form.dob, form.phone, state.patients]);

  function register(e: FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.dob || !form.phone.trim()) { setMessage("Name, date of birth, and phone are required before a record can be created."); return; }
    const insurer = config.insurers.find((item) => item.id === form.insurerId);
    const nextIndex = state.patients.length + 1;
    const newPatient: Patient = {
      id: `PT-${String(nextIndex).padStart(3, "0")}-${Date.now().toString(36).slice(-3)}`,
      mrn: `6105${String(100 + nextIndex)}${Math.floor(Math.random() * 9)}`,
      name: form.name.trim(), dob: form.dob, sex: form.sex, pronouns: form.pronouns, language: form.language,
      address: form.address.trim() || "Address not provided", phone: form.phone.trim(),
      insurance: insurer?.name ?? "Self-pay", insurerId: form.insurerId, memberId: form.memberId.trim() || undefined,
      problems: [], medications: [], allergies: [{ allergen: "Not yet reviewed", reaction: "", severity: "Unknown" }], vitals: [], results: [], notes: [],
      duplicateCandidate: candidates[0]?.id,
    };
    dispatch({ type: "registerPatient", patient: newPatient, duplicateCandidates: candidates.map((c) => c.id) });
    if (candidates.length) dispatch({ type: "escalateIdentity", patientId: newPatient.id, candidateId: candidates[0].id });
    setMessage(candidates.length ? `Record ${newPatient.mrn} created and flagged for HIM identity review because ${candidates.length} possible match(es) exist.` : `Record ${newPatient.mrn} created. No existing match was found on name, date of birth, or phone.`);
    setForm({ ...form, name: "", dob: "", phone: "", address: "", memberId: "" });
    selectPatient(newPatient.id);
  }

  function verify() {
    const insurer = config.insurers.find((item) => item.id === (patient.insurerId ?? config.insurers[0]?.id));
    const check: EligibilityCheck = {
      id: makeId("ELG"), patientId: patient.id, insurerId: insurer?.id ?? "", planType: eligibility.planType || insurer?.planTypes[0] || "Unknown",
      memberId: patient.memberId ?? "Not on file", coverageStart: "2026-01-01", coverageEnd: "2026-12-31",
      status: eligibility.status as EligibilityCheck["status"], copay: eligibility.copay, deductibleMet: eligibility.deductibleMet, cobOrder: eligibility.cobOrder, source: eligibility.source, checkedAt: nowIso(),
    };
    dispatch({ type: "verifyEligibility", check });
  }

  const patientChecks = state.eligibilityChecks.filter((check) => check.patientId === patient.id);
  const patientReferrals = state.referrals.filter((item) => item.patientId === patient.id);
  const patientInsurer = config.insurers.find((item) => item.id === patient.insurerId);

  return <div className="grid two-one">
    <Panel title="Register a new patient" subtitle="Search before you create. Every field you enter is compared with existing records." actions={<SimulationBadge />}>
      <form className="form-stack" onSubmit={register}>
        <div className="registration-grid">
          <Field label="Legal name"><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="First Last" /></Field>
          <Field label="Date of birth"><input type="date" value={form.dob} onChange={(e) => setForm({ ...form, dob: e.target.value })} /></Field>
          <Field label="Sex"><select value={form.sex} onChange={(e) => setForm({ ...form, sex: e.target.value })}><option>Female</option><option>Male</option><option>Other</option><option>Unknown</option></select></Field>
          <Field label="Pronouns"><input value={form.pronouns} onChange={(e) => setForm({ ...form, pronouns: e.target.value })} /></Field>
          <Field label="Preferred language"><input value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })} /></Field>
          <Field label="Phone"><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="(212) 555-0100" /></Field>
          <Field label="Address"><input className="wide" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></Field>
          <Field label="Insurer"><select value={form.insurerId} onChange={(e) => setForm({ ...form, insurerId: e.target.value })}>{config.insurers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
          <Field label="Member ID"><input value={form.memberId} onChange={(e) => setForm({ ...form, memberId: e.target.value })} /></Field>
        </div>
        {candidates.length > 0 && <div className="match-panel" role="status"><strong>Possible existing record{candidates.length > 1 ? "s" : ""}</strong><p>Compare identifiers before creating a new chart. Registering anyway sends the pair to the HIM identity queue.</p>
          <table><thead><tr><th>Name</th><th>MRN</th><th>DOB</th><th>Phone</th><th></th></tr></thead><tbody>{candidates.map((c) => <tr key={c.id}><td>{c.name}</td><td>{c.mrn}</td><td>{c.dob}</td><td>{c.phone}</td><td><button type="button" onClick={() => { selectPatient(c.id, "Patients"); dispatch({ type: "openChart", patientId: c.id }); }}>Open existing</button></td></tr>)}</tbody></table></div>}
        <div className="button-row"><button className="primary" type="submit">{candidates.length ? "Register anyway and flag for review" : "Create record"}</button></div>
        {message && <p className="form-message success" role="status">{message}</p>}
      </form>
    </Panel>
    <div className="stack">
      <Panel title="Insurance and eligibility" subtitle={`${patient.name} · ${patient.insurance}`}>
        <dl className="kv"><dt>Payer type</dt><dd>{patientInsurer?.payerType ?? "Unknown"}</dd><dt>Member ID</dt><dd>{patient.memberId ?? "Not on file"}</dd><dt>Payer note</dt><dd>{patientInsurer?.eligibilityNote ?? "—"}</dd></dl>
        <div className="form-stack">
          <div className="registration-grid">
            <Field label="Plan type"><select value={eligibility.planType} onChange={(e) => setEligibility({ ...eligibility, planType: e.target.value })}>{(patientInsurer?.planTypes ?? ["Unknown"]).map((plan) => <option key={plan}>{plan}</option>)}</select></Field>
            <Field label="Eligibility response"><select value={eligibility.status} onChange={(e) => setEligibility({ ...eligibility, status: e.target.value })}>{config.coverageFields.eligibilityStatuses.map((status) => <option key={status}>{status}</option>)}</select></Field>
            <Field label="Copay"><input value={eligibility.copay} onChange={(e) => setEligibility({ ...eligibility, copay: e.target.value })} /></Field>
            <Field label="Deductible met"><input value={eligibility.deductibleMet} onChange={(e) => setEligibility({ ...eligibility, deductibleMet: e.target.value })} /></Field>
            <Field label="Coordination of benefits"><select value={eligibility.cobOrder} onChange={(e) => setEligibility({ ...eligibility, cobOrder: e.target.value })}>{config.coverageFields.cobOrders.map((order) => <option key={order}>{order}</option>)}</select></Field>
            <Field label="Verification source"><select value={eligibility.source} onChange={(e) => setEligibility({ ...eligibility, source: e.target.value })}>{config.coverageFields.verificationSources.map((source) => <option key={source}>{source}</option>)}</select></Field>
          </div>
          <button onClick={verify}>Record eligibility verification</button>
        </div>
        {patientChecks.map((check) => <article className="eligibility-card" key={check.id}><header><strong>{check.planType}</strong><Status tone={check.status === "Active" ? "good" : check.status === "Inactive" ? "danger" : "warn"}>{check.status}</Status></header><small>{check.source} · {new Date(check.checkedAt).toLocaleString()}</small><dl className="kv"><dt>Copay</dt><dd>{check.copay}</dd><dt>Deductible</dt><dd>{check.deductibleMet}</dd><dt>COB</dt><dd>{check.cobOrder}</dd><dt>Coverage</dt><dd>{check.coverageStart} to {check.coverageEnd}</dd></dl></article>)}
        <InlineAlert tone="info" title="Why this matters"><p>Eligibility is checked on the date of service. A card on file is not verification.</p></InlineAlert>
      </Panel>
      <Panel title="Referrals and authorizations" subtitle="Some plans require authorization before the visit can be scheduled">
        <div className="form-stack">
          <Field label="Specialty"><select value={referral.specialtyId} onChange={(e) => setReferral({ ...referral, specialtyId: e.target.value })}>{config.specialties.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
          <Field label="Reason"><input value={referral.reason} onChange={(e) => setReferral({ ...referral, reason: e.target.value })} placeholder="Clinical reason for the referral" /></Field>
          <div className="registration-grid">
            <Field label="Priority"><select value={referral.priority} onChange={(e) => setReferral({ ...referral, priority: e.target.value as Referral["priority"] })}><option>Routine</option><option>Urgent</option></select></Field>
            <Field label="Authorization"><select value={referral.authorization} onChange={(e) => setReferral({ ...referral, authorization: e.target.value as Referral["authorizationStatus"] })}><option>Not required</option><option>Pending</option><option>Approved</option><option>Denied</option></select></Field>
          </div>
          <button onClick={() => { if (!referral.reason.trim()) return; dispatch({ type: "createReferral", referral: { id: makeId("REF"), patientId: patient.id, specialty: config.specialties.find((s) => s.id === referral.specialtyId)?.name ?? "", reason: referral.reason.trim(), priority: referral.priority, authorizationStatus: referral.authorization, authorizationNumber: referral.authorization === "Approved" ? `AUTH-${Date.now().toString().slice(-6)}` : undefined, createdAt: nowIso() } }); setReferral({ ...referral, reason: "" }); }}>Create referral</button>
        </div>
        <ul className="referral-list">{patientReferrals.map((item) => <li key={item.id}><span>{item.specialty} · {item.reason}</span><Status tone={item.authorizationStatus === "Approved" || item.authorizationStatus === "Not required" ? "good" : item.authorizationStatus === "Denied" ? "danger" : "warn"}>{item.priority} · {item.authorizationStatus}{item.authorizationNumber ? ` ${item.authorizationNumber}` : ""}</Status></li>)}{!patientReferrals.length && <li className="empty">No referrals for {patient.name}.</li>}</ul>
      </Panel>
    </div>
  </div>;
}
