"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { Icon } from "@/components/ui/Icon";
import { ROLE_BLURBS } from "@/lib/navigation";
import { initials } from "@/lib/patient";
import type { CourseRole, Patient, Role } from "@/lib/types";

interface Props {
  name: string;
  email: string;
  courseRole: CourseRole;
  role: Role;
  roles: Role[];
  patients: Patient[];
  onRoleChange: (role: Role) => void;
  onOpenPatient: (patientId: string) => void;
  onExport: () => void;
  onImport: (event: ChangeEvent<HTMLInputElement>) => void;
  onReset: () => void;
  onSignOut: () => void;
  onToggleNav: () => void;
  readOnly: boolean;
  configVersion: number;
}

export function TopBar(props: Props) {
  const { name, email, courseRole, role, roles, patients, readOnly, configVersion } = props;
  return (
    <header className="topbar">
      <button type="button" className="icon-button nav-toggle" aria-label="Show or hide navigation" onClick={props.onToggleNav}>
        <Icon name="menu" />
      </button>
      <div className="brand">
        <span className="brand-mark" aria-hidden="true">F</span>
        <div>
          <strong>FordMS</strong>
          <small>Fordham Health · HINF 6105 practice EHR</small>
        </div>
      </div>
      <PatientSearch patients={patients} onOpen={props.onOpenPatient} />
      <div className="top-actions">
        <label className="role-label">
          <span>Working as</span>
          <select aria-label="Select simulated role" value={role} onChange={(event) => props.onRoleChange(event.target.value as Role)} title={ROLE_BLURBS[role]}>
            {roles.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <WorkspaceMenu {...props} />
        <div className="account-chip" title={`${email} · ${courseRole} · config v${configVersion}`}>
          <span className="avatar" aria-hidden="true">{initials(name) || "FL"}</span>
          <span className="account-text">
            <strong>{name}</strong>
            <small>{courseRole}{readOnly ? " · preview" : ""}</small>
          </span>
        </div>
      </div>
    </header>
  );
}

function WorkspaceMenu({ onExport, onImport, onReset, onSignOut, readOnly, configVersion, email }: Props) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    function close(event: MouseEvent) {
      if (ref.current?.open && !ref.current.contains(event.target as Node)) ref.current.open = false;
    }
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);
  return (
    <details className="workspace-menu" ref={ref}>
      <summary aria-label="Workspace menu">Workspace</summary>
      <div className="menu-panel" role="group" aria-label="Workspace actions">
        <p className="menu-caption">{email}<br />Course configuration v{configVersion}</p>
        <button type="button" onClick={onExport} disabled={readOnly}>Export evidence</button>
        <label className="buttonlike">
          Import workspace file
          <input aria-label="Import workspace" type="file" accept="application/json" onChange={onImport} disabled={readOnly} />
        </label>
        <button type="button" className="danger-button" onClick={onReset} disabled={readOnly}>Reset all</button>
        <hr />
        <button type="button" onClick={onSignOut}>Sign out</button>
      </div>
    </details>
  );
}

function PatientSearch({ patients, onOpen }: { patients: Patient[]; onOpen: (patientId: string) => void }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const matches = query.trim().length < 2
    ? []
    : patients.filter((patient) => `${patient.name} ${patient.mrn} ${patient.dob}`.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 6);

  function choose(id: string) {
    onOpen(id);
    setQuery("");
    setOpen(false);
  }

  return (
    <div className="top-search" role="search">
      <Icon name="search" size={16} />
      <input
        aria-label="Find a patient"
        placeholder="Search patients by name, MRN, or DOB"
        value={query}
        onChange={(event) => { setQuery(event.target.value); setOpen(true); }}
        onKeyDown={(event) => {
          if (event.key === "Enter" && matches[0]) choose(matches[0].id);
          if (event.key === "Escape") setOpen(false);
        }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && matches.length > 0 && (
        <ul className="search-results" role="listbox" aria-label="Matching patients">
          {matches.map((patient) => (
            <li key={patient.id} role="option" aria-selected="false">
              <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => choose(patient.id)}>
                <strong>{patient.name}</strong>
                <span>MRN {patient.mrn} · DOB {patient.dob}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
